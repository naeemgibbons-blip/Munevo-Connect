// Edge function: syncs Newark Legistar matters into legistar_matters.
// Filters out PROCEDURAL and HEADER items; only saves ACTIONABLE ones with
// structured extraction. Runs the relationship engine to populate
// legistar_matter_links against properties, parcels, business_licenses,
// contractor_profiles, grants, and departments.

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  classifyMatter,
  extractStructuredFields,
  parseMatterTitle,
} from "../_shared/legistar-parser.ts";

const LEGISTAR_MATTERS_URL = "https://webapi.legistar.com/v1/newark/matters";
const ALLOWED_ROLES = ["admin", "executive", "staff", "supervisor"];

type LegistarApiMatter = {
  MatterId: number;
  MatterFile: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
};

type LinkCandidate = {
  legistar_matter_id: string;
  org_id: string;
  record_type: string;
  record_id: string | null;
  match_basis: string;
  match_text: string;
  confidence: "high" | "medium" | "low" | "needs_review";
  status: "pending";
};

function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// deno-lint-ignore no-explicit-any
type Db = ReturnType<typeof createClient<any>>;

async function buildLinks(
  db: Db,
  orgId: string,
  matterId: string,
  extracted: ReturnType<typeof extractStructuredFields>
): Promise<LinkCandidate[]> {
  const links: LinkCandidate[] = [];

  const push = (
    record_type: string,
    record_id: string | null,
    match_basis: string,
    match_text: string,
    confidence: LinkCandidate["confidence"]
  ) => links.push({ legistar_matter_id: matterId, org_id: orgId, record_type, record_id, match_basis, match_text, confidence, status: "pending" });

  // ── addresses → properties + parcels ──────────────────────────────────────
  for (const addr of extracted.addresses) {
    const [{ data: props }, { data: parcels }] = await Promise.all([
      db.from("properties").select("id").eq("org_id", orgId).ilike("address", `%${addr}%`).limit(5),
      db.from("parcels").select("id").eq("org_id", orgId).ilike("address", `%${addr}%`).limit(5),
    ]);

    if (props?.length) {
      for (const p of props) push("property", p.id, "address", addr, "high");
    } else {
      push("property", null, "address", addr, "needs_review");
    }

    for (const p of (parcels ?? [])) push("parcel", p.id, "address", addr, "high");
  }

  // ── parcel refs → parcels ─────────────────────────────────────────────────
  for (const ref of extracted.parcels) {
    const blockLotMatch = ref.match(/Block\s+(\d+)\s+Lot\s+(\d+)/i);
    if (!blockLotMatch) continue;
    const parcelNumber = `${blockLotMatch[1]}-${blockLotMatch[2]}`;
    const { data: parcels } = await db
      .from("parcels")
      .select("id")
      .eq("org_id", orgId)
      .ilike("parcel_number", `%${parcelNumber}%`)
      .limit(3);
    if (parcels?.length) {
      for (const p of parcels) push("parcel", p.id, "parcel_number", ref, "high");
    } else {
      push("parcel", null, "parcel_number", ref, "needs_review");
    }
  }

  // ── businesses → business_licenses ───────────────────────────────────────
  for (const name of extracted.businesses) {
    const { data: biz } = await db
      .from("business_licenses")
      .select("id")
      .eq("org_id", orgId)
      .ilike("business_name", `%${name}%`)
      .limit(3);
    if (biz?.length) {
      for (const b of biz) push("business_license", b.id, "name", name, "medium");
    } else {
      push("business_license", null, "name", name, "needs_review");
    }
  }

  // ── contractors → contractor_profiles ────────────────────────────────────
  for (const name of extracted.contractors) {
    const { data: ctrs } = await db
      .from("contractor_profiles")
      .select("id")
      .eq("org_id", orgId)
      .ilike("business_name", `%${name}%`)
      .limit(3);
    if (ctrs?.length) {
      for (const c of ctrs) push("contractor", c.id, "name", name, "medium");
    } else {
      push("contractor", null, "name", name, "needs_review");
    }
  }

  // ── funding source → grants ───────────────────────────────────────────────
  if (extracted.fundingSource) {
    const { data: grants } = await db
      .from("grants")
      .select("id")
      .eq("org_id", orgId)
      .ilike("source", `%${extracted.fundingSource}%`)
      .limit(3);
    for (const g of (grants ?? [])) {
      push("grant", g.id, "funding_source", extracted.fundingSource, "medium");
    }
  }

  return links;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const { data: profile, error: profileError } = await callerClient
    .from("profiles")
    .select("org_id, role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile || !ALLOWED_ROLES.includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  const orgId = profile.org_id;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const response = await fetch(`${LEGISTAR_MATTERS_URL}?$top=1000`);
  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: `Legistar API error: ${response.status}` }),
      { status: 502, headers: corsHeaders }
    );
  }
  const matters: LegistarApiMatter[] = await response.json();

  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  let ignored = 0; // PROCEDURAL + HEADER
  let departmentsCreated = 0;
  const departmentCache = new Map<string, string>();

  async function findOrCreateDepartment(name: string | undefined): Promise<string | null> {
    if (!name?.trim()) return null;
    const trimmed = name.trim();
    const cacheKey = trimmed.toLowerCase();
    if (departmentCache.has(cacheKey)) return departmentCache.get(cacheKey)!;

    const { data: existing } = await db
      .from("departments")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", trimmed)
      .maybeSingle();

    if (existing) {
      departmentCache.set(cacheKey, existing.id);
      return existing.id;
    }

    const { data: created, error } = await db
      .from("departments")
      .insert({ org_id: orgId, name: trimmed })
      .select("id")
      .single();

    if (error || !created) return null;
    departmentsCreated += 1;
    departmentCache.set(cacheKey, created.id);
    return created.id;
  }

  for (const matter of matters) {
    scanned += 1;

    if (!matter.MatterTitle) {
      ignored += 1;
      continue;
    }

    // ── Classification filter ─────────────────────────────────────────────
    const category = classifyMatter(matter);
    if (category !== "ACTIONABLE") {
      ignored += 1;
      continue;
    }

    const parsed = parseMatterTitle(matter.MatterTitle);
    const extracted = extractStructuredFields(parsed.fields, matter.MatterTitle);

    const departmentId = await findOrCreateDepartment(
      parsed.fields["Dept/Agency"] ?? parsed.fields["Monitoring Dept/Agency"]
    );

    const { data: existingMatter } = await db
      .from("legistar_matters")
      .select("id")
      .eq("org_id", orgId)
      .eq("matter_id", matter.MatterId)
      .maybeSingle();

    const { data: upsertedMatter, error: upsertError } = await db
      .from("legistar_matters")
      .upsert(
        {
          org_id: orgId,
          matter_id: matter.MatterId,
          matter_file: matter.MatterFile,
          matter_title: matter.MatterTitle,
          matter_type: matter.MatterTypeName,
          matter_status: matter.MatterStatusName,
          department_id: departmentId,
          parsed_fields: parsed.fields,
          classification: parsed.classification,
          synced_at: new Date().toISOString(),
          // Structured extraction columns
          matter_category: category,
          action_type: extracted.actionType,
          resolution_number: extracted.resolutionNumber,
          ordinance_number: extracted.ordinanceNumber,
          funding_source_parsed: extracted.fundingSource,
          meeting_body: extracted.meetingBody,
          extracted_addresses: extracted.addresses.length ? extracted.addresses : null,
          extracted_businesses: extracted.businesses.length ? extracted.businesses : null,
          extracted_contractors: extracted.contractors.length ? extracted.contractors : null,
          extracted_parcels: extracted.parcels.length ? extracted.parcels : null,
          extracted_amounts: extracted.amounts.length ? extracted.amounts : null,
        },
        { onConflict: "org_id,matter_id" }
      )
      .select("id")
      .single();

    if (upsertError || !upsertedMatter) {
      ignored += 1;
      continue;
    }

    if (existingMatter) {
      skipped += 1;
    } else {
      imported += 1;
    }

    // ── Module-specific records ───────────────────────────────────────────
    if (parsed.classification === "property_disposition") {
      const property = parsed.properties[0];
      await db.from("property_dispositions").upsert(
        {
          org_id: orgId,
          legistar_matter_id: upsertedMatter.id,
          department_id: departmentId,
          address: property?.address ?? null,
          block: property?.block ?? null,
          lot: property?.lot ?? null,
          ward: property?.ward ?? null,
          purpose: parsed.fields["Purpose"] ?? null,
          entity_name: parsed.fields["Entity Name/Address"] ?? null,
          action: parsed.action || null,
          sale_amount: parseAmount(parsed.fields["Sale Amount"]),
          assessed_appraised_amount: parsed.fields["Assessed/Appraised Amount"] ?? null,
        },
        { onConflict: "legistar_matter_id" }
      );
    } else if (parsed.classification === "grant") {
      await db.from("grants").upsert(
        {
          org_id: orgId,
          legistar_matter_id: upsertedMatter.id,
          department_id: departmentId,
          title: parsed.fields["Purpose"] || matter.MatterTitle,
          funder: parsed.fields["Entity Name/Address"] || "Unknown",
          source: parsed.fields["Funding Source"] || "Unknown",
          amount: parseAmount(parsed.fields["Total Grant Amount"]) ?? 0,
          status: "Identified",
        },
        { onConflict: "legistar_matter_id" }
      );
    }

    // ── Relationship engine ───────────────────────────────────────────────
    const links = await buildLinks(db, orgId, upsertedMatter.id, extracted);
    if (links.length > 0) {
      await db
        .from("legistar_matter_links")
        .upsert(links, { onConflict: "legistar_matter_id,record_type,match_text" });
    }
  }

  return new Response(
    JSON.stringify({ scanned, imported, skipped, ignored, departmentsCreated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
