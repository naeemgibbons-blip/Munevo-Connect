// Edge function: syncs Newark Legistar matters into legistar_matters and
// classifies/upserts them into property_dispositions or grants.
// Triggered by the admin "Agenda sync" page.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { parseMatterTitle } from "../_shared/legistar-parser.ts";

const LEGISTAR_MATTERS_URL = "https://webapi.legistar.com/v1/newark/matters";
const ALLOWED_ROLES = ["admin", "executive", "staff", "supervisor"];

type LegistarApiMatter = {
  MatterId: number;
  MatterFile: string | null;
  MatterTitle: string | null;
  MatterTypeName: string | null;
  MatterStatusName: string | null;
};

function parseAmount(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : null;
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
  let ignored = 0;
  let departmentsCreated = 0;
  const departmentCache = new Map<string, string>();

  async function findOrCreateDepartment(name: string | undefined): Promise<string | null> {
    if (!name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const cacheKey = trimmed.toLowerCase();
    if (departmentCache.has(cacheKey)) return departmentCache.get(cacheKey)!;

    const { data: existing } = await db
      .from("departments")
      .select("id, name")
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

    const parsed = parseMatterTitle(matter.MatterTitle);
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
  }

  return new Response(
    JSON.stringify({ scanned, imported, skipped, ignored, departmentsCreated }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
