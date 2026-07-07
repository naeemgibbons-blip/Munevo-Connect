import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import type { LegistarMatter, LegistarMatterLink } from "../integrations/supabase/types";

type MatterWithLinks = LegistarMatter & { links: LegistarMatterLink[] };

const CLASSIFICATION_COLORS: Record<string, string> = {
  grant: "bg-green-50 text-green-700 border-green-200",
  property_disposition: "bg-orange-50 text-orange-700 border-orange-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-slate-100 text-slate-700",
  needs_review: "bg-red-50 text-red-700",
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  property: "Property",
  parcel: "Parcel",
  business_license: "Business",
  contractor: "Contractor",
  grant: "Grant",
  department: "Dept",
};

type Tab = "agenda" | "dispositions" | "grants";

export default function LegislativePortal() {
  const [tab, setTab] = useState<Tab>("agenda");
  const [matters, setMatters] = useState<MatterWithLinks[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: rawMatters, error: mattersErr } = await supabase
        .from("legistar_matters")
        .select("*")
        .eq("matter_category", "ACTIONABLE")
        .order("synced_at", { ascending: false })
        .limit(200);

      if (mattersErr) {
        setError(mattersErr.message);
        setLoading(false);
        return;
      }

      const matterIds = (rawMatters ?? []).map((m) => m.id);
      const { data: rawLinks } = matterIds.length
        ? await supabase
            .from("legistar_matter_links")
            .select("*")
            .in("legistar_matter_id", matterIds)
        : { data: [] };

      const linksByMatter = new Map<string, LegistarMatterLink[]>();
      for (const link of rawLinks ?? []) {
        const list = linksByMatter.get(link.legistar_matter_id) ?? [];
        list.push(link);
        linksByMatter.set(link.legistar_matter_id, list);
      }

      setMatters(
        (rawMatters ?? []).map((m) => ({
          ...m,
          links: linksByMatter.get(m.id) ?? [],
        }))
      );
      setLoading(false);
    };

    fetchData();
  }, []);

  const filtered = matters.filter((m) => {
    if (tab === "dispositions") return m.classification === "property_disposition";
    if (tab === "grants") return m.classification === "grant";
    return true;
  }).filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.matter_title?.toLowerCase().includes(q) ||
      m.matter_file?.toLowerCase().includes(q) ||
      m.action_type?.toLowerCase().includes(q) ||
      m.parsed_fields?.["Dept/Agency"]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Legislative Portal</h1>
          <span className="text-xs text-slate-400">Newark City Council · Legistar</span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1 w-fit">
          {(
            [
              ["agenda", "Agenda Items"],
              ["dispositions", "Property Dispositions"],
              ["grants", "Grants"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === key
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Search by title, file number, action type, or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-slate-200 rounded px-3 py-2 text-sm bg-white w-full"
        />

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && filtered.length === 0 && !error && (
          <p className="text-sm text-slate-500">
            {matters.length === 0
              ? "No actionable agenda items synced yet. Run the Agenda Sync from the admin panel."
              : "No items match the current filter."}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {filtered.map((matter) => {
            const isExpanded = expandedId === matter.id;
            const dept = matter.parsed_fields?.["Dept/Agency"];
            const purpose =
              matter.parsed_fields?.["Purpose"] ?? matter.matter_title ?? "";
            const needsReview = matter.links.filter(
              (l) => l.confidence === "needs_review"
            );
            const confirmed = matter.links.filter(
              (l) => l.confidence !== "needs_review"
            );

            return (
              <div
                key={matter.id}
                className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Header */}
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : matter.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {matter.matter_file && (
                        <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                          {matter.matter_file}
                        </span>
                      )}
                      {matter.action_type && (
                        <span className="text-xs font-medium text-slate-700">
                          {matter.action_type}
                        </span>
                      )}
                      {matter.classification && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${
                          CLASSIFICATION_COLORS[matter.classification] ?? ""
                        }`}
                      >
                        {matter.classification.replace("_", " ")}
                      </span>
                      )}
                      {matter.matter_type && (
                        <span className="text-xs text-slate-400">
                          {matter.matter_type}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2">
                      {purpose}
                    </p>

                    {dept && (
                      <p className="text-xs text-slate-500 mt-0.5">{dept}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {confirmed.length > 0 && (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                        {confirmed.length} linked
                      </span>
                    )}
                    {needsReview.length > 0 && (
                      <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded">
                        {needsReview.length} need review
                      </span>
                    )}
                    <span className="text-slate-300 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 py-3 flex flex-col gap-3">
                    {/* Extracted entities */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {matter.extracted_addresses?.length ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Addresses</div>
                          {matter.extracted_addresses.map((a) => (
                            <div key={a} className="text-slate-700">{a}</div>
                          ))}
                        </div>
                      ) : null}

                      {matter.extracted_businesses?.length ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Businesses</div>
                          {matter.extracted_businesses.map((b) => (
                            <div key={b} className="text-slate-700">{b}</div>
                          ))}
                        </div>
                      ) : null}

                      {matter.extracted_contractors?.length ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Contractors</div>
                          {matter.extracted_contractors.map((c) => (
                            <div key={c} className="text-slate-700">{c}</div>
                          ))}
                        </div>
                      ) : null}

                      {matter.extracted_parcels?.length ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Parcels</div>
                          {matter.extracted_parcels.map((p) => (
                            <div key={p} className="text-slate-700 font-mono">{p}</div>
                          ))}
                        </div>
                      ) : null}

                      {matter.extracted_amounts?.length ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Amounts</div>
                          {matter.extracted_amounts.map((a) => (
                            <div key={a} className="text-slate-700 font-semibold">{a}</div>
                          ))}
                        </div>
                      ) : null}

                      {(matter.resolution_number || matter.ordinance_number) ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Numbers</div>
                          {matter.resolution_number && (
                            <div className="text-slate-700">Res. {matter.resolution_number}</div>
                          )}
                          {matter.ordinance_number && (
                            <div className="text-slate-700">Ord. {matter.ordinance_number}</div>
                          )}
                        </div>
                      ) : null}

                      {matter.funding_source_parsed ? (
                        <div>
                          <div className="text-slate-400 font-medium mb-1">Funding Source</div>
                          <div className="text-slate-700">{matter.funding_source_parsed}</div>
                        </div>
                      ) : null}
                    </div>

                    {/* Related records */}
                    {matter.links.length > 0 && (
                      <div>
                        <div className="text-xs text-slate-400 font-medium mb-2">
                          Related Records
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {matter.links.map((link) => (
                            <div
                              key={link.id}
                              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${
                                CONFIDENCE_COLORS[link.confidence]
                              }`}
                            >
                              <span className="font-medium">
                                {RECORD_TYPE_LABELS[link.record_type] ?? link.record_type}
                              </span>
                              <span className="opacity-70">·</span>
                              <span className="truncate max-w-[140px]" title={link.match_text}>
                                {link.match_text}
                              </span>
                              {link.confidence === "needs_review" && (
                                <span className="font-semibold">· Needs Review</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full purpose */}
                    {matter.parsed_fields?.["Purpose"] &&
                      matter.parsed_fields["Purpose"].length > 100 && (
                        <div>
                          <div className="text-xs text-slate-400 font-medium mb-1">Full Description</div>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {matter.parsed_fields["Purpose"]}
                          </p>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
