export function Card({
  title,
  children,
  onViewAll,
  viewAllLabel = "View all",
}: {
  title: string;
  children: React.ReactNode;
  onViewAll?: () => void;
  viewAllLabel?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="px-4 py-3 flex-1">{children}</div>
      {onViewAll && (
        <div className="px-4 py-2 border-t border-slate-100">
          <button
            onClick={onViewAll}
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            {viewAllLabel} →
          </button>
        </div>
      )}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

export type ChartStatus =
  | "Open"
  | "In Progress"
  | "Passed"
  | "Issued"
  | "Paid"
  | "Active";

export function StatusBadge({ status }: { status: ChartStatus }) {
  const styles: Record<ChartStatus, string> = {
    Open: "bg-red-50 text-red-600",
    "In Progress": "bg-amber-50 text-amber-600",
    Passed: "bg-green-50 text-green-600",
    Issued: "bg-blue-50 text-blue-600",
    Paid: "bg-green-50 text-green-600",
    Active: "bg-green-50 text-green-600",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${styles[status]}`}>
      {status}
    </span>
  );
}

export function ActivityRow({
  date,
  title,
  subtitle,
  status,
}: {
  date: string;
  title: string;
  subtitle: string;
  status: ChartStatus;
}) {
  return (
    <div className="py-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs">{date}</span>
        <StatusBadge status={status} />
      </div>
      <div className="text-slate-800 font-medium">{title}</div>
      <div className="text-slate-500 text-xs">{subtitle}</div>
    </div>
  );
}
