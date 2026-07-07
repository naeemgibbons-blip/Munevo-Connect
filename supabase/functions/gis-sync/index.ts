// GIS sync edge function.
// Drains the pending_geocode queue in batches, geocodes each address via
// Nominatim (OpenStreetMap) with a Newark NJ default, and upserts results
// into gis_records.
//
// Also accepts a direct geocode request:
//   POST /gis-sync  { mode: "address", address: "...", org_id: "...",
//                     source_module: "...", record_type: "...",
//                     related_record_id: "..." }
// or queue-drain:
//   POST /gis-sync  { mode: "queue", batch_size?: number }

import { createClient } from "jsr:@supabase/supabase-js@2";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const DEFAULT_CITY = "Newark";
const DEFAULT_STATE = "NJ";
const BATCH_SIZE = 20;

// Record-type mapping from source_table to display record_type
const TABLE_TO_RECORD_TYPE: Record<string, string> = {
  requests: "311_request",
  permits: "permit",
  violations: "violation",
  work_orders: "work_order",
  business_licenses: "business",
  properties: "property",
  utility_accounts: "utility_account",
  assets: "asset",
  planning_applications: "planning_application",
  tax_abatements: "tax_abatement",
  field_jobs: "field_job",
  legistar_matters: "legislative_action",
  contractor_profiles: "contractor",
};

type GeocodeResult = {
  latitude: number;
  longitude: number;
  normalizedAddress: string;
  city: string;
  state: string;
  zip: string;
  confidence: "high" | "medium" | "low";
};

function needsCityState(address: string): boolean {
  return !/(newark|nj|new jersey)/i.test(address) && !/,\s*[A-Z]{2}/.test(address);
}

async function geocode(rawAddress: string): Promise<GeocodeResult | null> {
  const query = needsCityState(rawAddress)
    ? `${rawAddress}, ${DEFAULT_CITY}, ${DEFAULT_STATE}`
    : rawAddress;

  const url =
    `${NOMINATIM}?format=json&limit=1&addressdetails=1&countrycodes=us` +
    `&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Munevo GIS Service/1.0 (contact@munevo.com)" },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) return null;

  const hit = data[0];
  const addr = hit.address ?? {};
  const importance = parseFloat(hit.importance ?? "0");

  return {
    latitude: parseFloat(hit.lat),
    longitude: parseFloat(hit.lon),
    normalizedAddress: hit.display_name ?? query,
    city: addr.city ?? addr.town ?? addr.village ?? DEFAULT_CITY,
    state: addr.state_abbr ?? (addr.state?.includes("Jersey") ? "NJ" : addr.state ?? DEFAULT_STATE),
    zip: addr.postcode ?? "",
    confidence: importance > 0.65 ? "high" : importance > 0.4 ? "medium" : "low",
  };
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  // Auth check
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: cors,
    });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode ?? "queue";

  // ── Single address mode ──────────────────────────────────────────────────
  if (mode === "address") {
    const { address, org_id, source_module, record_type, related_record_id, department_id } = body;
    if (!address) {
      return new Response(JSON.stringify({ error: "address required" }), {
        status: 400, headers: cors,
      });
    }

    const result = await geocode(address);
    const status = result
      ? result.confidence === "low" ? "needs_review" : "geocoded"
      : "failed";

    const { error } = await db.from("gis_records").upsert(
      {
        org_id,
        source_module,
        record_type,
        related_record_id,
        department_id: department_id ?? null,
        raw_address: address,
        normalized_address: result?.normalizedAddress ?? null,
        city: result?.city ?? DEFAULT_CITY,
        state: result?.state ?? DEFAULT_STATE,
        zip: result?.zip ?? null,
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        geocode_status: status,
        confidence: result?.confidence ?? null,
        geocoded_at: result ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_module,related_record_id,raw_address" }
    );

    return new Response(
      JSON.stringify({ status, result: result ?? null, error: error?.message ?? null }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // ── Queue drain mode ─────────────────────────────────────────────────────
  const batchSize = Math.min(body.batch_size ?? BATCH_SIZE, 100);

  const { data: jobs } = await db
    .from("pending_geocode")
    .select("*")
    .is("processed_at", null)
    .order("queued_at")
    .limit(batchSize);

  if (!jobs?.length) {
    return new Response(
      JSON.stringify({ processed: 0, message: "Queue empty" }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  let geocoded = 0;
  let needsReview = 0;
  let failed = 0;

  for (const job of jobs) {
    // Rate-limit Nominatim: 1 req/sec
    await new Promise((r) => setTimeout(r, 1050));

    const result = await geocode(job.raw_address);
    const status = result
      ? result.confidence === "low" ? "needs_review" : "geocoded"
      : "failed";

    const recordType = TABLE_TO_RECORD_TYPE[job.source_table] ?? job.source_table;

    await db.from("gis_records").upsert(
      {
        org_id: job.org_id,
        source_module: job.source_table,
        record_type: recordType,
        related_record_id: job.source_id,
        raw_address: job.raw_address,
        normalized_address: result?.normalizedAddress ?? null,
        city: result?.city ?? DEFAULT_CITY,
        state: result?.state ?? DEFAULT_STATE,
        zip: result?.zip ?? null,
        latitude: result?.latitude ?? null,
        longitude: result?.longitude ?? null,
        geocode_status: status,
        confidence: result?.confidence ?? null,
        geocoded_at: result ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_module,related_record_id,raw_address" }
    );

    await db
      .from("pending_geocode")
      .update({
        processed_at: new Date().toISOString(),
        error: result ? null : "Nominatim returned no results",
      })
      .eq("id", job.id);

    if (status === "geocoded") geocoded++;
    else if (status === "needs_review") needsReview++;
    else failed++;
  }

  return new Response(
    JSON.stringify({ processed: jobs.length, geocoded, needsReview, failed }),
    { headers: { ...cors, "Content-Type": "application/json" } }
  );
});
