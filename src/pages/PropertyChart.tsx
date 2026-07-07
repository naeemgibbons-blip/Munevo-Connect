import { useEffect, useState, lazy, Suspense } from "react";
import { Card, DataRow, StatusBadge, ActivityRow } from "../components/chart-ui";
import { supabase } from "../integrations/supabase/client";
import type { LegistarMatter } from "../integrations/supabase/types";
import type { GISMarker } from "../components/GISMap";

const GISMap = lazy(() => import("../components/GISMap"));

type RecordTab = {
  id: string;
  label: string;
  icon: string;
};

const RECORD_TABS: RecordTab[] = [
  { id: "property", label: "123 Main St", icon: "🏠" },
  { id: "permit", label: "Permit #24-0156", icon: "📄" },
  { id: "workorder", label: "WO #24-8891", icon: "🛠️" },
  { id: "party", label: "Jane Smith", icon: "👤" },
];

const SUB_TABS = [
  "Summary",
  "GIS Map",
  "All Records",
  "Permits",
  "311 Requests",
  "Violations",
  "Inspections",
  "Utilities & Bills",
  "Payments",
  "Planning/Zoning",
  "Parties",
  "Documents",
  "Activity",
];

const QUICK_ACTIONS = [
  "Create Permit",
  "Create 311 Request",
  "Create Work Order",
  "Add Document",
  "Add Note",
  "Schedule Inspection",
  "Add Party",
];

function BillRow({
  label,
  balance,
  due,
}: {
  label: string;
  balance: string;
  due: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">Due {due}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-800">{balance}</span>
        <button className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded">
          Pay Now
        </button>
      </div>
    </div>
  );
}

// Hardcoded address for the demo property record.
const DEMO_ADDRESS = "123 Main St";

function PendingCouncilActions({ address }: { address: string }) {
  const [items, setItems] = useState<LegistarMatter[]>([]);

  useEffect(() => {
    supabase
      .from("legistar_matters")
      .select("id, matter_file, action_type, parsed_fields")
      .eq("matter_category", "ACTIONABLE")
      .contains("extracted_addresses", JSON.stringify([address]))
      .limit(5)
      .then(({ data }) => setItems(data ?? []));
  }, [address]);

  if (items.length === 0) return null;

  return (
    <Card title="Pending Council Actions">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              {item.matter_file && (
                <span className="text-xs font-mono font-semibold text-amber-800">
                  {item.matter_file}
                </span>
              )}
              {item.action_type && (
                <span className="text-xs text-amber-700 font-medium">{item.action_type}</span>
              )}
            </div>
            <p className="text-xs text-amber-900 leading-snug">
              {item.parsed_fields?.["Purpose"] ?? "Pending legislative action"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PropertyGISTab({ address }: { address: string }) {
  const [markers, setMarkers] = useState<GISMarker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("gis_records")
      .select("id, record_type, latitude, longitude, raw_address, normalized_address, source_module, related_record_id")
      .not("latitude", "is", null)
      .ilike("raw_address", `%${address.split(",")[0]}%`)
      .limit(50)
      .then(({ data }) => {
        setMarkers(
          (data ?? []).map((r) => ({
            id: r.id,
            record_type: r.record_type,
            latitude: r.latitude!,
            longitude: r.longitude!,
            raw_address: r.raw_address,
            normalized_address: r.normalized_address,
            source_module: r.source_module,
            related_record_id: r.related_record_id,
          }))
        );
        setLoading(false);
      });
  }, [address]);

  const TYPE_COLORS: Record<string, string> = {
    "311_request": "#3B82F6", permit: "#10B981", inspection: "#8B5CF6",
    violation: "#EF4444", work_order: "#F97316", project: "#14B8A6",
    legislative_action: "#F59E0B", business: "#6366F1", utility_account: "#64748B",
  };

  const TYPE_LABELS: Record<string, string> = {
    "311_request": "311 Request", permit: "Permit", inspection: "Inspection",
    violation: "Violation", work_order: "Work Order", project: "Project",
    legislative_action: "Legislative Action", business: "Business",
    utility_account: "Utility Account",
  };

  if (loading) return <p className="text-sm text-slate-500 py-4">Loading map…</p>;

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-64 bg-slate-100 rounded animate-pulse" />}>
        <GISMap markers={markers} height="360px" />
      </Suspense>

      {markers.length === 0 && (
        <p className="text-xs text-slate-500">
          No geocoded records found for this address. GIS markers appear automatically
          when address-bearing records are created.
        </p>
      )}

      {markers.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-slate-500 uppercase">
            {markers.length} Related Record{markers.length !== 1 ? "s" : ""}
          </h3>
          {markers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                style={{ background: TYPE_COLORS[m.record_type] ?? "#64748B" }}
              />
              <span className="font-medium text-slate-700">
                {TYPE_LABELS[m.record_type] ?? m.record_type}
              </span>
              <span className="text-slate-400 truncate">{m.raw_address}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropertyChart() {
  const [activeRecordTab, setActiveRecordTab] = useState("property");
  const [activeSubTab, setActiveSubTab] = useState("Summary");
  const [openTabs, setOpenTabs] = useState(RECORD_TABS.map((t) => t.id));

  const closeTab = (id: string) => {
    setOpenTabs((prev) => prev.filter((t) => t !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-[1400px] mx-auto bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {/* Header bar */}
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold tracking-wide">
          PROPERTY CHART (STAFF)
        </div>

        {/* Record tab bar */}
        <div className="flex items-center bg-white border-b border-slate-200 px-2">
          <button className="text-xs text-slate-500 px-3 py-2 hover:text-slate-700">
            ← Back to Search
          </button>
          <div className="flex items-center flex-1 overflow-x-auto">
            {RECORD_TABS.filter((t) => openTabs.includes(t.id)).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRecordTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-slate-200 whitespace-nowrap ${
                  activeRecordTab === tab.id
                    ? "bg-blue-50 text-blue-700 font-medium border-b-2 border-b-blue-600"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="text-slate-400 hover:text-slate-700 ml-1"
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <button className="text-slate-400 px-3 py-2">…</button>
        </div>

        {/* Sub tab row */}
        <div className="flex items-center gap-5 bg-white border-b border-slate-200 px-4 overflow-x-auto">
          {SUB_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`text-sm py-2.5 whitespace-nowrap border-b-2 ${
                activeSubTab === tab
                  ? "border-blue-600 text-blue-700 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex gap-4 p-4">
          {/* Left identity rail */}
          <aside className="w-64 shrink-0 flex flex-col gap-4">
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-32 bg-slate-200 flex items-center justify-center text-slate-400 text-xs">
                Property Photo
              </div>
              <div className="p-3">
                <div className="text-base font-bold text-slate-900">123 MAIN ST</div>
                <div className="text-xs text-slate-500 mb-2">Anytown, MD 21000</div>
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 mb-2">
                  ACTIVE
                </span>
                <div className="text-xs text-slate-500 mt-2">Parcel ID</div>
                <div className="text-sm text-slate-800 font-medium mb-1">17-000-1234</div>
                <div className="text-xs text-slate-500">Property Type</div>
                <div className="text-sm text-slate-800 font-medium mb-1">
                  Single Family Residential
                </div>
                <div className="text-xs text-slate-500">Owner</div>
                <div className="text-sm text-slate-800 font-medium">JOHN DOE</div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">
                Quick Actions
              </h4>
              <ul className="flex flex-col gap-1.5">
                {QUICK_ACTIONS.map((action) => (
                  <li key={action}>
                    <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline text-left">
                      {action}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Alerts</h4>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center gap-2 text-red-600">
                  <span>⚠️</span> 2 Open Violations
                </li>
                <li className="flex items-center gap-2 text-amber-600">
                  <span>⚠️</span> 1 Expired Permit
                </li>
                <li className="flex items-center gap-2 text-slate-600">
                  <span>📅</span> Next Payment Due 06/05/2025
                </li>
              </ul>
            </div>
          </aside>

          {/* Center workspace */}
          <main className="flex-1 min-w-0">
            {activeSubTab === "GIS Map" && (
              <PropertyGISTab address={DEMO_ADDRESS} />
            )}
            {activeSubTab !== "GIS Map" && (
            <div className="grid grid-cols-2 gap-4 content-start">
            <Card title="Property Information">
              <DataRow label="Zoning" value="R-1" />
              <DataRow label="Lot Size" value="0.25 acres" />
              <DataRow label="Year Built" value="1998" />
              <DataRow label="Living Area" value="2,200 sqft" />
              <DataRow label="Use" value="Single Family" />
            </Card>

            <Card title="Recent Activity" onViewAll={() => {}}>
              <ActivityRow
                date="05/10/2025"
                title="311 Request Created"
                subtitle="Pothole in driveway"
                status="Open"
              />
              <ActivityRow
                date="05/08/2025"
                title="Inspection Completed"
                subtitle="Building Final"
                status="Passed"
              />
              <ActivityRow
                date="05/05/2025"
                title="Permit Issued"
                subtitle="Deck Addition"
                status="Issued"
              />
            </Card>

            <Card title="Active Permits" onViewAll={() => {}} viewAllLabel="View all (2)">
              <div className="text-sm text-slate-800 font-medium">Deck Addition</div>
              <div className="text-xs text-slate-500 mb-1">Permit #P25-000123</div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>Issued 05/15/2025</span>
                <StatusBadge status="In Progress" />
              </div>
              <div className="text-sm text-slate-800 font-medium">Shed Installation</div>
              <div className="text-xs text-slate-500 mb-1">Permit #P25-000110</div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Issued 04/20/2025</span>
                <StatusBadge status="In Progress" />
              </div>
            </Card>

            <Card title="Open Violations" onViewAll={() => {}} viewAllLabel="View all (2)">
              <div className="text-sm text-slate-800 font-medium">Tall grass</div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>Issued 05/10/2025</span>
                <StatusBadge status="Open" />
              </div>
              <div className="text-sm text-slate-800 font-medium">Trash on property</div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Issued 04/10/2025</span>
                <StatusBadge status="Open" />
              </div>
            </Card>

            <Card title="Utilities & Bills" onViewAll={() => {}} viewAllLabel="View all bills">
              <BillRow label="Water Balance" balance="$45.62" due="06/05/2025" />
              <BillRow label="Sewer Balance" balance="$38.10" due="06/05/2025" />
              <BillRow label="Trash Balance" balance="$22.75" due="06/05/2025" />
            </Card>

            <PendingCouncilActions address={DEMO_ADDRESS} />

            <Card title="Next Inspection" onViewAll={() => {}} viewAllLabel="View all inspections">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">Deck Final Inspection</div>
                  <div className="text-xs text-slate-500">Scheduled 06/01/2025</div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Scheduled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">Building Final Inspection</div>
                  <div className="text-xs text-slate-500">Scheduled 06/15/2025</div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Scheduled
                </span>
              </div>
            </Card>
            </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
