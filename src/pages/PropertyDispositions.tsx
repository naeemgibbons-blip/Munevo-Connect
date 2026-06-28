import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import type { PropertyDisposition } from "../integrations/supabase/types";

function formatAmount(amount: number | null): string {
  if (amount === null) return "—";
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function PropertyDispositions() {
  const [records, setRecords] = useState<PropertyDisposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("property_dispositions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message);
        else setRecords(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-lg font-semibold text-slate-900 mb-4">Property Dispositions</h1>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          {records.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-4"
            >
              <div className="text-sm font-semibold text-slate-900">
                {record.address ?? "Address unknown"}
              </div>
              <div className="text-xs text-slate-500 mb-2">
                {[
                  record.block && `Block ${record.block}`,
                  record.lot && `Lot ${record.lot}`,
                  record.ward && `${record.ward} Ward`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>

              <div className="text-sm text-slate-700 mb-1">{record.purpose}</div>
              <div className="text-xs text-slate-500 mb-3">{record.entity_name}</div>

              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                  {record.action ?? "—"}
                </span>
                <div className="text-right">
                  <div className="text-slate-800 font-semibold">
                    {formatAmount(record.sale_amount)}
                  </div>
                  {record.assessed_appraised_amount && (
                    <div className="text-slate-400">{record.assessed_appraised_amount}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && records.length === 0 && !error && (
          <p className="text-sm text-slate-500">No property dispositions synced yet.</p>
        )}
      </div>
    </div>
  );
}
