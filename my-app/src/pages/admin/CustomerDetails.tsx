import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiCreditCard,
  FiDownload,
  FiPlus,
  FiShoppingBag,
  FiX,
} from "react-icons/fi";
import MetricGrid, { StatCard, ACCENT_COLORS } from "../../component/MetricGrid";

type Order = {
  id: string;
  created_at: string;
  items_summary: string;
  order_status: string;
  payment_status: string;
  total_amount: number | string;
  payment_method: string;
};
type LedgerEntry = {
  id: string;
  entry_type: "debit" | "credit";
  amount: number | string;
  description: string;
  order_id: string | null;
  payment_method: string | null;
  created_at: string;
};
type CustomerDetailsData = {
  customer: { id: number; name: string; email: string; joined: string };
  orders: Order[];
  ledger: LedgerEntry[];
  summary: {
    totalOrders: number;
    lifetimeSpend: number;
    totalPaid: number;
    balanceDue: number;
  };
};

const token = () =>
  JSON.parse(localStorage.getItem("shophub_user") || "null")?.token || "";
const money = (amount: number | string) =>
  `Rs. ${Number(amount || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

export default function CustomerDetails() {
  const { id } = useParams();
  const [data, setData] = useState<CustomerDetailsData | null>(null);
  const [tab, setTab] = useState<"orders" | "ledger">("orders");
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState({
    amount: "",
    description: "",
    payment_method: "Cash",
  });
  const [saving, setSaving] = useState(false);

  const request = async <T,>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> => {
    const response = await fetch(`${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        ...(options.headers || {}),
      },
    });
    const responseText = await response.text();
    let result: { success?: boolean; message?: string; [key: string]: unknown };
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `Customer API returned ${response.status} ${response.statusText}. Restart the backend server.`,
      );
    }
    if (!response.ok || !result.success)
      throw new Error(result.message || "Request failed");
    return result as T;
  };
  const load = async () =>
    setData(
      await request<CustomerDetailsData>(`/api/admin/customers/${id}/details`),
    );
  useEffect(() => {
    load().catch((error) => alert(error.message));
  }, [id]);

  const escapeHtml = (value: string) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const printInvoice = (order: Order) => {
    const invoice = window.open("", "_blank", "width=700,height=800");
    if (!invoice) return;
    const safeId = escapeHtml(order.id);
    const safeDate = escapeHtml(new Date(order.created_at).toLocaleString());
    const safeStatus = escapeHtml(order.order_status);
    const safeItems = escapeHtml(order.items_summary || "Order items");
    const safeTotal = escapeHtml(money(order.total_amount));

    invoice.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${safeId}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:30px}td,th{border-bottom:1px solid #ddd;padding:12px;text-align:left}.total{text-align:right;font-size:20px;font-weight:bold;margin-top:24px}</style></head><body><h1>ShopHub Invoice</h1><p>Order: <strong>${safeId}</strong><br>Date: ${safeDate}<br>Status: ${safeStatus}</p><table><tr><th>Items</th><th>Total</th></tr><tr><td>${safeItems}</td><td>${safeTotal}</td></tr></table><p class="total">Total: ${safeTotal}</p><script>window.onload=function(){window.print();}</script></body></html>`,
    );
    invoice.document.close();
  };

  const submitPayment = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await request<{ success: true; message: string }>(
        `/api/admin/customers/${id}/payments`,
        { method: "POST", body: JSON.stringify(payment) },
      );
      setPayment({ amount: "", description: "", payment_method: "Cash" });
      setShowPayment(false);
      await load();
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Could not record payment",
      );
    } finally {
      setSaving(false);
    }
  };

  const cards = useMemo(
    () =>
      data
        ? [
            {
              label: "Total Orders",
              value: data.summary.totalOrders,
              Icon: FiShoppingBag,
              color: "text-slate-600",
            },
            {
              label: "Lifetime Spend",
              value: money(data.summary.lifetimeSpend),
              Icon: FiShoppingBag,
              color: "text-emerald-600",
            },
            {
              label: "Total Paid",
              value: money(data.summary.totalPaid),
              Icon: FiCreditCard,
              color: "text-slate-600",
            },
            {
              label: "Balance Due",
              value: money(data.summary.balanceDue),
              Icon: FiCreditCard,
              color: "text-slate-600",
            },
          ]
        : [],
    [data],
  );

  if (!data)
    return (
      <div className="p-8 text-center text-slate-500">
        Loading customer ledger...
      </div>
    );
  return (
    <div className="space-y-6">
      <Link
        to="/admin/customers"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
      >
        <FiArrowLeft /> Back to Customers
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {data.customer.name}
          </h1>
          <p className="mt-1 text-slate-600">{data.customer.email}</p>
        </div>
        <button
          onClick={() => setShowPayment(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white"
        >
          <FiPlus /> Add Manual Payment
        </button>
      </div>
      {/* Metric Cards — uniform MetricGrid + StatCard */}
      <MetricGrid cols={4}>
        {cards.map(({ label, value, Icon }, idx) => (
          <StatCard
            key={label}
            label={label}
            value={value}
            icon={<Icon size={20} />}
            accent={ACCENT_COLORS[idx % ACCENT_COLORS.length]}
          />
        ))}
      </MetricGrid>
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setTab("orders")}
            className={`px-5 py-4 text-sm font-semibold ${tab === "orders" ? "border-b-2 border-black text-slate-900" : "text-slate-500"}`}
          >
            Order History
          </button>
          <button
            onClick={() => setTab("ledger")}
            className={`px-5 py-4 text-sm font-semibold ${tab === "ledger" ? "border-b-2 border-black text-slate-900" : "text-slate-500"}`}
          >
            Payment Ledger
          </button>
        </div>
        {tab === "orders" ? (
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  {[
                    "Order ID",
                    "Date",
                    "Items Summary",
                    "Order Status",
                    "Payment Status",
                    "Total Amount",
                    "Invoice",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-4 py-4 font-semibold">{order.id}</td>
                    <td className="px-4 py-4">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="max-w-[250px] px-4 py-4">
                      {order.items_summary || "—"}
                    </td>
                    <td className="px-4 py-4">{order.order_status}</td>
                    <td className="px-4 py-4">
                      {order.payment_status || "Unpaid"}
                    </td>
                    <td className="px-4 py-4 font-semibold">
                      {money(order.total_amount)}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => printInvoice(order)}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-200 hover:text-blue-900 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                      >
                        <FiDownload />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.orders.length && (
              <p className="py-10 text-center text-slate-400">
                No orders found.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  {[
                    "Date",
                    "Type",
                    "Description",
                    "Payment Method",
                    "Amount",
                  ].map((heading) => (
                    <th key={heading} className="px-4 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ledger.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="px-4 py-4">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-4 font-semibold uppercase ${entry.entry_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {entry.entry_type}
                    </td>
                    <td className="px-4 py-4">{entry.description}</td>
                    <td className="px-4 py-4">{entry.payment_method || "—"}</td>
                    <td
                      className={`px-4 py-4 font-semibold ${entry.entry_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}
                    >
                      {entry.entry_type === "credit" ? "+" : "-"}
                      {money(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.ledger.length && (
              <p className="py-10 text-center text-slate-400">
                No ledger entries found.
              </p>
            )}
          </div>
        )}
      </div>
      {showPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5 flex justify-between">
              <h2 className="text-xl font-bold">Add Manual Payment</h2>
              <button type="button" onClick={() => setShowPayment(false)}>
                <FiX size={22} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-sm font-semibold">
                Amount
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={payment.amount}
                  onChange={(event) =>
                    setPayment({ ...payment, amount: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold">
                Payment Method
                <select
                  value={payment.payment_method}
                  onChange={(event) =>
                    setPayment({
                      ...payment,
                      payment_method: event.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2.5 font-normal"
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Cheque</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Note
                <input
                  value={payment.description}
                  onChange={(event) =>
                    setPayment({ ...payment, description: event.target.value })
                  }
                  placeholder="Optional note"
                  className="mt-1 w-full rounded-lg border px-3 py-2.5 font-normal"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPayment(false)}
                className="rounded-lg bg-slate-100 px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-white"
              >
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
