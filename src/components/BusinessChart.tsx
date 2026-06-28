import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, DataRow, StatusBadge, ActivityRow } from "./chart-ui";

type RecordTab = {
  id: string;
  label: string;
  icon: string;
};

const RECORD_TABS: RecordTab[] = [
  { id: "business", label: "ABC Construction LLC", icon: "🏢" },
  { id: "license", label: "License #BL-2024-778", icon: "📄" },
  { id: "inspection", label: "Inspection #IN-44521", icon: "🔍" },
];

const SUB_TABS = [
  "Summary",
  "Licenses",
  "Permits",
  "Inspections",
  "Payments",
  "Violations",
  "Health/Food",
  "Documents",
  "Activity",
];

const QUICK_ACTIONS = [
  "Create Permit",
  "Schedule Inspection",
  "Add Document",
  "Add Note",
  "Send Message",
];

function PaymentRow({
  label,
  amount,
  date,
}: {
  label: string;
  amount: string;
  date: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">{date}</div>
      </div>
      <span className="text-sm font-semibold text-slate-800">{amount}</span>
    </div>
  );
}

function ContextSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{title}</h4>
      {children}
    </div>
  );
}

export default function BusinessChart() {
  const { id } = useParams<{ id: string }>();
  const [activeRecordTab, setActiveRecordTab] = useState("business");
  const [activeSubTab, setActiveSubTab] = useState("Summary");
  const [openTabs, setOpenTabs] = useState(RECORD_TABS.map((t) => t.id));

  const closeTab = (id: string) => {
    setOpenTabs((prev) => prev.filter((t) => t !== id));
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-[1600px] mx-auto bg-slate-50 rounded-lg border border-slate-200 overflow-hidden shadow-sm">
        {/* Header bar */}
        <div className="bg-blue-600 text-white px-4 py-2 text-sm font-semibold tracking-wide flex items-center justify-between">
          <span>BUSINESS CHART (STAFF)</span>
          {id && <span className="text-xs font-normal text-blue-100">Record ID: {id}</span>}
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
              <div className="h-20 bg-slate-200 flex items-center justify-center text-slate-500 text-2xl font-bold">
                ABC
              </div>
              <div className="p-3">
                <div className="text-base font-bold text-slate-900">ABC CONSTRUCTION LLC</div>
                <div className="text-xs text-slate-500 mb-2">General Contractor</div>
                <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700 mb-2">
                  ACTIVE
                </span>
                <div className="text-xs text-slate-500 mt-2">Business ID</div>
                <div className="text-sm text-slate-800 font-medium mb-1">BUS-2024-0091</div>
                <div className="text-xs text-slate-500">License Type</div>
                <div className="text-sm text-slate-800 font-medium mb-1">General Contractor</div>
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm text-slate-800 font-medium mb-1">Active</div>
                <div className="text-xs text-slate-500">License Expires</div>
                <div className="text-sm text-slate-800 font-medium mb-1">12/31/2025</div>
                <div className="text-xs text-slate-500">Phone</div>
                <div className="text-sm text-slate-800 font-medium mb-1">(555) 123-4567</div>
                <div className="text-xs text-slate-500">Email</div>
                <div className="text-sm text-slate-800 font-medium">contact@abcconstruction.com</div>
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
                  <span>⚠️</span> 1 Open Violation
                </li>
                <li className="flex items-center gap-2 text-amber-600">
                  <span>⚠️</span> Insurance Expires 09/15/2025
                </li>
              </ul>
            </div>
          </aside>

          {/* Center workspace */}
          <main className="flex-1 grid grid-cols-2 gap-4 content-start">
            <Card title="Business Overview">
              <DataRow label="Entity Type" value="LLC" />
              <DataRow label="Owner" value="Robert Johnson" />
              <DataRow label="Address" value="450 Industrial Pkwy" />
              <DataRow label="Years in Business" value="8" />
              <DataRow label="Employees" value="24" />
            </Card>

            <Card title="Recent Activity" onViewAll={() => {}}>
              <ActivityRow
                date="05/12/2025"
                title="Payment Received"
                subtitle="Annual License Fee"
                status="Paid"
              />
              <ActivityRow
                date="05/09/2025"
                title="Inspection Completed"
                subtitle="Site Safety Inspection"
                status="Passed"
              />
              <ActivityRow
                date="05/04/2025"
                title="Permit Issued"
                subtitle="Commercial Build-out"
                status="Issued"
              />
            </Card>

            <Card title="Active Licenses" onViewAll={() => {}} viewAllLabel="View all (1)">
              <div className="text-sm text-slate-800 font-medium">General Contractor License</div>
              <div className="text-xs text-slate-500 mb-1">License #BL-2024-778</div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Expires 12/31/2025</span>
                <StatusBadge status="Active" />
              </div>
            </Card>

            <Card title="Active Permits" onViewAll={() => {}} viewAllLabel="View all (2)">
              <div className="text-sm text-slate-800 font-medium">Commercial Build-out</div>
              <div className="text-xs text-slate-500 mb-1">Permit #P25-000456</div>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span>Issued 05/04/2025</span>
                <StatusBadge status="In Progress" />
              </div>
              <div className="text-sm text-slate-800 font-medium">Electrical Upgrade</div>
              <div className="text-xs text-slate-500 mb-1">Permit #P25-000412</div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Issued 04/18/2025</span>
                <StatusBadge status="In Progress" />
              </div>
            </Card>

            <Card title="Upcoming Inspections" onViewAll={() => {}} viewAllLabel="View all inspections">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">Site Safety Inspection</div>
                  <div className="text-xs text-slate-500">Scheduled 06/02/2025</div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Scheduled
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-800">Electrical Final Inspection</div>
                  <div className="text-xs text-slate-500">Scheduled 06/20/2025</div>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  Scheduled
                </span>
              </div>
            </Card>

            <Card title="Payments" onViewAll={() => {}} viewAllLabel="View all payments">
              <PaymentRow label="Annual License Fee" amount="$350.00" date="Paid 05/12/2025" />
              <PaymentRow label="Permit Fee — Commercial Build-out" amount="$1,200.00" date="Paid 05/04/2025" />
              <PaymentRow label="Permit Fee — Electrical Upgrade" amount="$480.00" date="Paid 04/18/2025" />
            </Card>
          </main>

          {/* Right context panel */}
          <aside className="w-64 shrink-0 flex flex-col gap-4">
            <ContextSection title="Actions">
              <ul className="flex flex-col gap-1.5">
                <li>
                  <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline text-left">
                    Renew License
                  </button>
                </li>
                <li>
                  <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline text-left">
                    Flag for Review
                  </button>
                </li>
                <li>
                  <button className="text-sm text-blue-600 hover:text-blue-700 hover:underline text-left">
                    Generate Report
                  </button>
                </li>
              </ul>
            </ContextSection>

            <ContextSection title="Tasks">
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-slate-700">Verify insurance renewal</span>
                  <span className="text-xs text-slate-400">06/01</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-slate-700">Follow up on violation</span>
                  <span className="text-xs text-slate-400">05/30</span>
                </li>
              </ul>
            </ContextSection>

            <ContextSection title="Messages">
              <div className="text-sm text-slate-700">
                <div className="font-medium">Robert Johnson</div>
                <div className="text-xs text-slate-500">"Submitted updated insurance docs."</div>
              </div>
            </ContextSection>

            <ContextSection title="AI Insights">
              <ul className="flex flex-col gap-2 text-sm text-slate-700">
                <li>⚡ License renewal due in 30 days</li>
                <li>⚡ No prior violations before this case</li>
              </ul>
            </ContextSection>
          </aside>
        </div>
      </div>
    </div>
  );
}
