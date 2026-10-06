import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import {
  OperationsHeader,
  SearchBar,
  Field,
  LoadNotice,
  Status,
  inputClass,
  buttonClass,
  secondaryClass,
  money,
  operationsRequest as request,
} from "./operationsShared";
type ReturnRecord = {
  id: number;
  order_id: string;
  reason: string;
  status: string;
  admin_notes: string;
  refund_amount: string;
  refund_reference: string;
  customer_name: string;
  total_amount: string;
  payment_status: string;
};
type Order = {
  id: string;
  customer_name: string;
  order_status: string;
  payment_status: string;
  total_amount: string;
};
const transitions: Record<string, string[]> = {
  Requested: ["Approved", "Rejected"],
  Approved: ["Received", "Rejected"],
  Received: ["Refunded"],
  Refunded: [],
  Rejected: [],
};
export default function ManageReturns() {
  const [data, setData] = useState<{
    returns: ReturnRecord[];
    orders: Order[];
  }>({ returns: [], orders: [] });
  const [editing, setEditing] = useState<ReturnRecord | null>(null),
    [newReturn, setNewReturn] = useState<{
      order_id: string;
      reason: string;
    } | null>(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [tab, setTab] = useState("returns");
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request("/operations/returns"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(path: string, method: string, body?: unknown) {
    setSaving(true);
    setError("");
    try {
      await request(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setEditing(null);
      setNewReturn(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }
  const filtered = data.returns.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.order_id} ${r.customer_name} ${r.reason}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const sections = [
  {
    id: "returns",
    label: `Return requests (${data?.returns?.length || 0})`,
    color: "#FF7E00"// Blue color
    // icon: <FiRotateCcw size={16} /> // Ya jo bhi icon aap use kar rahe hain
  
  },
  {
    id: "orders",
    label: "Order cancellation",
    color: "#7F00FF" // Red color (ya apni marzi ka koi bhi hex)
    // icon: <FiXCircle size={16} />
  }
];
  return (
    <div className="space-y-6 pb-8">
      <OperationsHeader
        title="Returns & Refunds"
        description="Manage whole-order returns, cancel unshipped orders and record completed refunds."
      >
        <button
          className={buttonClass}
          onClick={() => {
            setNewReturn({ order_id: "", reason: "" });
            setEditing(null);
          }}
        >
          <FiPlus /> New return
        </button>
      </OperationsHeader>
      <LoadNotice loading={loading} error={error} />
      {newReturn && (
        <form
          className="space-y-4 border-y border-slate-200 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate("/operations/returns", "POST", newReturn);
          }}
        >
          <Field label="Order">
            <select
              required
              className={inputClass}
              value={newReturn.order_id}
              onChange={(e) =>
                setNewReturn({ ...newReturn, order_id: e.target.value })
              }
            >
              <option value="">Select an order</option>
              {data.orders
                .filter(
                  (o) =>
                    ["Delivered", "Completed", "Cancelled"].includes(
                      o.order_status,
                    ) && !data.returns.some((r) => r.order_id === o.id),
                )
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id} · {o.customer_name} · {money(o.total_amount)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Reason">
            <textarea
              required
              maxLength={1000}
              className={inputClass}
              value={newReturn.reason}
              onChange={(e) =>
                setNewReturn({ ...newReturn, reason: e.target.value })
              }
            />
          </Field>
          <button className={buttonClass} disabled={saving}>
            Create return
          </button>{" "}
          <button
            type="button"
            className={secondaryClass}
            disabled={saving}
            onClick={() => setNewReturn(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {editing && (
        <form
          className="space-y-4 border-y border-slate-200 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(`/operations/returns/${editing.id}`, "PUT", editing);
          }}
        >
          <h2 className="text-xl font-bold">
            Manage return — {editing.order_id}
          </h2>
          <Field label="Status">
            <select
              className={inputClass}
              value={editing.status}
              onChange={(e) =>
                setEditing({ ...editing, status: e.target.value })
              }
            >
              {[
                data.returns.find((r) => r.id === editing.id)?.status || "",
                ...(transitions[
                  data.returns.find((r) => r.id === editing.id)?.status || ""
                ] || []),
              ]
                .filter(
                  (s) => s !== "Refunded" || editing.payment_status === "Paid",
                )
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </Field>
          {editing.status === "Received" && (
            <p className="text-sm text-slate-500">
              Mark received only after all returned units have arrived. This
              restores the order's stock once.
            </p>
          )}
          {editing.status === "Refunded" && (
            <>
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-900">
                Issue the refund through your payment provider or bank first,
                then record its reference here. Saving this form records the
                refund; it does not transfer funds.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={`Refund amount (maximum ${money(editing.total_amount)})`}
                >
                  <input
                    required
                    type="number"
                    min="0.01"
                    max={Number(editing.total_amount)}
                    step="0.01"
                    className={inputClass}
                    value={editing.refund_amount}
                    onChange={(e) =>
                      setEditing({ ...editing, refund_amount: e.target.value })
                    }
                  />
                </Field>
                <Field label="Completed refund reference">
                  <input
                    required
                    maxLength={255}
                    className={inputClass}
                    value={editing.refund_reference}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        refund_reference: e.target.value,
                      })
                    }
                  />
                </Field>
              </div>
            </>
          )}
          <Field label="Internal notes">
            <textarea
              maxLength={1000}
              rows={3}
              className={inputClass}
              value={editing.admin_notes}
              onChange={(e) =>
                setEditing({ ...editing, admin_notes: e.target.value })
              }
            />
          </Field>
          <button className={buttonClass} disabled={saving}>
            Save return
          </button>{" "}
          <button
            type="button"
            className={secondaryClass}
            disabled={saving}
            onClick={() => setEditing(null)}
          >
            Cancel
          </button>
        </form>
      )}
     <div className="flex gap-2 overflow-x-auto pb-2">
  {sections.map((section) => (
    <button
      key={section.id}
      type="button"
      aria-pressed={tab === section.id}
      style={{
        backgroundColor: tab === section.id ? section.color : `${section.color}10`,
        color: tab === section.id ? '#fff' : section.color,
        borderColor: `${section.color}40`
      }}
      onClick={() => setTab(section.id)}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
        tab === section.id
          ? 'shadow-xs font-bold'
          : 'border hover:opacity-80'
      }`}
    >
      {/* {section.icon} */}
      {section.label}
    </button>
  ))}
</div>
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search order or customer"
        refresh={load}
        loading={loading}
      />
      {tab === "returns" ? (
        <>
          <select
            aria-label="Filter return status"
            className={`${inputClass} sm:max-w-xs`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {Object.keys(transitions).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <div className="space-y-4">
            {filtered.map((r) => (
              <article
                key={r.id}
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex justify-between gap-3">
                  <h2 className="font-bold">
                    {r.order_id} · {r.customer_name}
                  </h2>
                  <Status>{r.status}</Status>
                </div>
                <p className="text-sm text-slate-600">{r.reason}</p>
                <p className="text-sm text-slate-500">
                  Order total: {money(r.total_amount)} · Payment:{" "}
                  {r.payment_status}
                </p>
                {r.status === "Refunded" ? (
                  <p className="text-sm font-semibold text-emerald-700">
                    Refund recorded: {money(r.refund_amount)} ·{" "}
                    {r.refund_reference}
                  </p>
                ) : (
                  r.status !== "Rejected" && (
                    <button
                      className={secondaryClass}
                      onClick={() => {
                        setEditing({ ...r });
                        setNewReturn(null);
                      }}
                    >
                      Manage return
                    </button>
                  )
                )}
              </article>
            ))}
          </div>
          {!loading && !filtered.length && (
            <p className="py-8 text-center text-slate-500">
              No return requests match these filters.
            </p>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {data.orders
            .filter(
              (o) =>
                ["Pending", "Processing"].includes(o.order_status) &&
                `${o.id} ${o.customer_name}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <div>
                  <p className="font-bold">
                    {o.id} · {o.customer_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {o.order_status} · {o.payment_status} ·{" "}
                    {money(o.total_amount)}
                  </p>
                </div>
                <button
                  className={secondaryClass}
                  disabled={saving}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Cancel ${o.id} and restore its stock? Paid orders will enter the refund queue.`,
                      )
                    )
                      void mutate(`/operations/orders/${o.id}/cancel`, "POST");
                  }}
                >
                  Cancel order
                </button>
              </div>
            ))}
          {!loading &&
            !data.orders.some((o) =>
              ["Pending", "Processing"].includes(o.order_status),
            ) && (
              <p className="py-8 text-slate-500">
                No orders are eligible for cancellation.
              </p>
            )}
        </div>
      )}
    </div>
  );
}
