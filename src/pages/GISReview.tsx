import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "../integrations/supabase/client";
import { RECORD_TYPE_LABELS, RECORD_TYPE_COLORS } from "../components/GISMap";
import type { GISMarker } from "../components/GISMap";

const GISMap = lazy(() => import("../components/GISMap"));

type GISRecord = {
  id: string;
  org_id: string | null;
  source_module: string;
  record_type: string;
  related_record_id: string | null;
  raw_address: string;
  normalized_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number | null;
  longitude: number | null;
  geocode_status: string;
  confidence: string | null;
  geocoded_at: string | null;
  created_at: string;
};

type ViewMode = "review" | "all";

export default function GISReview() {
  const [records, setRecords] = useState<GISRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("review");
  const [filterType, setFilterType] = useState<string>("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async (mode: ViewMode) => {
    setLoading(true);
    let q = supabase.from("gis_records").select("*").order("created_at", { ascending: false }).limit(300);
    if (mode === "review") q = q.in("geocode_status", ["needs_review", "pending", "failed"]);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setRecords(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(view); }, [view]);

  const recordTypes = [...new Set(records.map((r) => r.record_type))].sort();

  const filtered = records.filter(
    (r) => filterType === "all" || r.record_type === filterType
  );

  const mapMarkers: GISMarker[] = records
    .filter((r) => r.latitude !== null && r.longitude !== null)
    .map((r) => ({
      id: r.id,
      record_type: r.record_type,
      latitude: r.latitude!,
      longitude: r.longitude!,
      raw_address: r.raw_address,
      normalized_address: r.normalized_address,
      source_module: r.source_module,
      related_record_id: r.related_record_id,
      geocode_status: r.geocode_status,
    }));

  const updateStatus = async (id: string, status: "geocoded" | "failed") => {
    setProcessingId(id);
    await supabase.from("gis_records").update({ geocode_status: status }).eq("id", id);
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, geocode_status: status } : r))
    );
    setProcessingId(null);
  };

  const runGisSync = async () => {
    setSyncing(true);
    const { error: fnErr } = await supabase.functions.invoke("gis-sync", {
      body: { mode: "queue", batch_size: 20 },
    });
    if (fnErr) setError(fnErr.message);
    else await load(view);
    setSyncing(false);
  };

  const statusColor: Record<string, string> = {
    geocoded: "bg-green-100 text-green-800",
    needs_review: "bg-amber-100 text-amber-800",
    pending: "bg-slate-100 text-slate-600",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">GIS Location Intelligence</h1>
            <p className="text-xs text-slate-500">Geocoded records · Newark, NJ default</p>
          </div>
          <button
            onClick={runGisSync}
            disabled={syncing}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? "Processing queue…" : "Process Geocode Queue"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            ["Total", records.length, "text-slate-900"],
            ["Geocoded", records.filter((r) => r.geocode_status === "geocoded").length, "text-green-700"],
            ["Needs Review", records.filter((r) => r.geocode_status === "needs_review").length, "text-amber-700"],
            ["Failed/Pending", records.filter((r) => ["failed", "pending"].includes(r.geocode_status)).length, "text-red-700"],
          ].map(([label, value, cls]) => (
            <div key={label as string} className="bg-white rounded-lg border border-slate-200 p-3 text-center shadow-sm">
              <div className={`text-2xl font-bold ${cls}`}>{value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            All Geocoded Records — Newark, NJ
          </h2>
          <Suspense fallback={<div className="h-64 bg-slate-100 rounded animate-pulse" />}>
            <GISMap markers={mapMarkers} height="320px" />
          </Suspense>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
            {(["review", "all"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded text-xs font-medium ${v === view ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {v === "review" ? "Needs Review" : "All Records"}
              </button>
            ))}
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white"
          >
            <option value="all">All types</option>
            {recordTypes.map((t) => (
              <option key={t} value={t}>{RECORD_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && filtered.length === 0 && !error && (
          <p className="text-sm text-slate-500">
            {view === "review"
              ? "No records need review. All addresses geocoded successfully."
              : "No GIS records yet. Run the Geocode Queue to process pending records."}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: RECORD_TYPE_COLORS[r.record_type] + "20",
                        color: RECORD_TYPE_COLORS[r.record_type] ?? "#374151",
                      }}
                    >
                      {RECORD_TYPE_LABELS[r.record_type] ?? r.record_type}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor[r.geocode_status] ?? "bg-slate-100 text-slate-600"}`}>
                      {r.geocode_status}
                    </span>
                    {r.confidence && (
                      <span className="text-xs text-slate-400">
                        confidence: {r.confidence}
                      </span>
                    )}
                  </div>

                  <div className="text-sm font-medium text-slate-800">{r.raw_address}</div>
                  {r.normalized_address && r.normalized_address !== r.raw_address && (
                    <div className="text-xs text-slate-500 mt-0.5">→ {r.normalized_address}</div>
                  )}

                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{r.source_module}</span>
                    {r.latitude && r.longitude && (
                      <span>{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span>
                    )}
                    {r.zip && <span>ZIP {r.zip}</span>}
                  </div>
                </div>

                {(r.geocode_status === "needs_review") && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus(r.id, "geocoded")}
                      disabled={processingId === r.id}
                      className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => updateStatus(r.id, "failed")}
                      disabled={processingId === r.id}
                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
