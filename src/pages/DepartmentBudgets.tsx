import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import type { Department, Grant, GrantTransaction } from "../integrations/supabase/types";

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function DepartmentBudgets() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [grantList, setGrantList] = useState<Grant[]>([]);
  const [transactions, setTransactions] = useState<GrantTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expenseGrantId, setExpenseGrantId] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [departmentsRes, grantsRes, transactionsRes] = await Promise.all([
      supabase.from("departments").select("*"),
      supabase.from("grants").select("*"),
      supabase.from("grant_transactions").select("*"),
    ]);

    if (departmentsRes.error || grantsRes.error || transactionsRes.error) {
      setError(
        departmentsRes.error?.message ??
          grantsRes.error?.message ??
          transactionsRes.error?.message ??
          "Failed to load"
      );
    } else {
      setDepartments(departmentsRes.data ?? []);
      setGrantList(grantsRes.data ?? []);
      setTransactions(transactionsRes.data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const spentByGrant = (grantId: string) =>
    transactions
      .filter((t) => t.grant_id === grantId)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(expenseAmount);
    if (!expenseGrantId || !Number.isFinite(amount)) return;

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: grant } = await supabase
      .from("grants")
      .select("org_id")
      .eq("id", expenseGrantId)
      .single();

    await supabase.from("grant_transactions").insert({
      org_id: grant?.org_id,
      grant_id: expenseGrantId,
      amount,
      description: expenseDescription || null,
      recorded_by: userData.user?.id ?? null,
    });

    setExpenseAmount("");
    setExpenseDescription("");
    setSubmitting(false);
    await loadData();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <h1 className="text-lg font-semibold text-slate-900">Department Budgets</h1>

        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {departments.map((dept) => {
          const deptGrants = grantList.filter((g) => g.department_id === dept.id);
          if (deptGrants.length === 0) return null;

          return (
            <div key={dept.id} className="bg-white rounded-lg border border-slate-200 shadow-sm">
              <div className="px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">{dept.name}</h2>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {deptGrants.map((grant) => {
                  const total = Number(grant.total_amount ?? 0);
                  const spent = spentByGrant(grant.id);
                  const remaining = total - spent;
                  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;

                  return (
                    <div key={grant.id} className="border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-800">
                          {grant.purpose ?? grant.entity_name ?? "Grant"}
                        </span>
                        <span className="text-xs text-slate-500">{grant.entity_name}</span>
                      </div>

                      <div className="h-2 bg-slate-100 rounded overflow-hidden mb-2">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Total: {formatAmount(total)}</span>
                        <span>Spent: {formatAmount(spent)}</span>
                        <span>Remaining: {formatAmount(remaining)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold text-slate-800 mb-3">Record an Expense</h2>
          <form onSubmit={submitExpense} className="flex flex-col gap-3">
            <select
              value={expenseGrantId}
              onChange={(e) => setExpenseGrantId(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              required
            >
              <option value="">Select a grant…</option>
              {grantList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.purpose ?? g.entity_name ?? g.id}
                </option>
              ))}
            </select>

            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              required
            />

            <input
              type="text"
              placeholder="Description"
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
            />

            <button
              type="submit"
              disabled={submitting}
              className="self-start px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Recording…" : "Record Expense"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
