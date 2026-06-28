import { useState } from "react";
import { supabase } from "../../integrations/supabase/client";

type SyncSummary = {
  scanned: number;
  imported: number;
  skipped: number;
  ignored: number;
  departmentsCreated: number;
};

export default function AgendaSync() {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSync = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    const { data, error: invokeError } = await supabase.functions.invoke<SyncSummary>(
      "legistar-sync"
    );

    if (invokeError) {
      setError(invokeError.message);
    } else if (data) {
      setSummary(data);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-3xl mx-auto bg-slate-50 rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold tracking-wide">
          AGENDA SYNC — NEWARK CITY COUNCIL
        </div>

        <div className="p-4 flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Pulls the latest matters from Legistar, parses the MatterTitle fact sheet, and
            classifies each as a grant, property disposition, or other record.
          </p>

          <button
            onClick={runSync}
            disabled={loading}
            className="self-start px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Syncing…" : "Run Agenda Sync"}
          </button>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          {summary && (
            <div className="grid grid-cols-5 gap-3">
              {([
                ["Scanned", summary.scanned],
                ["Imported", summary.imported],
                ["Skipped", summary.skipped],
                ["Ignored", summary.ignored],
                ["Departments Created", summary.departmentsCreated],
              ] as const).map(([label, value]) => (
                <div
                  key={label}
                  className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 text-center"
                >
                  <div className="text-2xl font-bold text-slate-900">{value}</div>
                  <div className="text-xs text-slate-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
