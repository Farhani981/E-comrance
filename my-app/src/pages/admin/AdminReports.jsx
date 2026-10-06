import { useEffect, useState } from "react";
import {
  FiActivity,
  FiArrowUpRight,
  FiArrowDownRight,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import MetricGrid, { StatCard, ACCENT_COLORS } from "../../component/MetricGrid";

const sections = [
  "overview",
  "sales",
  "orders",
  "products",
  "categories",
  "customers",
  "inventory",
  "payments",
  "discounts",
  "reports",
];
const ranges = {
  today: "Today",
  yesterday: "Yesterday",
  last7: "Last 7 Days",
  last30: "Last 30 Days",
  month: "This Month",
  lastMonth: "Last Month",
  year: "This Year",
  custom: "Custom Date Range",
};
const label = (key) =>
  key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const moneyKeys = new Set([
  "revenue",
  "booked_value",
  "gross_sales",
  "discounts",
  "shipping",
  "tax",
  "refunds",
  "sales_refunds",
  "refunded_amount",
  "average_order_value",
  "average_customer_spending",
  "spent",
  "total",
  "price",
  "cost",
  "inventory_value",
  "order_amount",
  "refund_amount",
  "discount_amount",
]);
const display = (key, value) =>
  value == null
    ? "Unavailable"
    : typeof value === "number"
      ? `${moneyKeys.has(key) ? "Rs. " : ""}${value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}`
      : String(value);
const control = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
// Report colors live here so they can be edited without shared CSS overrides.
const palette = ['#2563eb', '#7c3aed', '#0d9488', '#c2410c', '#db2777', '#0891b2'];
const statusColors = { 
  Pending: '#d97706',    // Warm Amber/Yellow
  Processing: '#2563eb', // Vivid Blue
  Shipped: '#8b5cf6',    // Bright Purple
  Delivered: '#10b981',  // Emerald Green
  Completed: '#0284c7',  // Sky Blue / Teal Accent (Delivered se alag)
  Cancelled: '#ef4444',  // Bright Red
  Returned: '#f97316',   // Bright Orange
  Refunded: '#ec4899'    // Pink / Rose
};
const metricColors = { revenue:'#059669', orders:'#2563eb', units_sold:'#7c3aed', pending_orders:'#b45309', completed_orders:'#059669', cancelled_orders:'#dc2626', refunded_amount:'#db2777' };
const chartColor = (name, index = 0) => statusColors[name] || metricColors[name] || palette[index % palette.length];
const definitions = {
  overview:
    "Revenue is non-cancelled booked order value less recorded refunds on those orders. It includes shipping and tax. It is not cash collected. Completed means Delivered or Completed.",
  sales:
    "Sales follow original order dates. Gross sales, discounts, shipping and tax use stored breakdowns. Refunds shown here belong to non-cancelled orders in this cohort; no refund-completion date is stored.",
  orders:
    "Return/refund state is derived from return requests. Refunded and Returned override the original status in this table. Overview completed/cancelled cards retain the original order status.",
  products:
    "Performance means delivered/completed units that have not been restocked. Revenue is gross item value before order-wide discounts, shipping, tax and refunds. Current products and archived products with sales are shown using current categories.",
  categories:
    "Category revenue is delivered, non-restocked gross item value before order-wide adjustments. Category assignments are current; historical category snapshots do not exist.",
  customers:
    "Total/new customers count registered customer accounts. Active/returning buyers include guests grouped by normalized email and accounts grouped by user ID. Returning means an order before this period. Customer spending uses non-cancelled orders less refunds.",
  inventory:
    "Current snapshot, independent of date range. Active variants are separate SKUs. Valuation uses recorded weighted-average purchase cost per SKU, matching the existing purchase-cost approach. Missing cost is unavailable; the total includes only costed stock.",
  payments:
    "These are recorded order payment states, not a payment-attempt ledger. Transaction count uses distinct stored transaction IDs. Failed attempts and cash collection dates are not recorded. Amount is order value, not settled cash.",
  discounts:
    "Discounts use saved order snapshots, not current promotion definitions. Revenue is associated booked order value less refunds, not proof that a coupon caused the sale. Legacy attribution can be unavailable.",
};

export default function AdminReports() {
  const { user } = useAuth();
  const [section, setSection] = useState("overview");
  const [reportType, setReportType] = useState("sales");
  const [filters, setFilters] = useState({
    range: "last30",
    bucket: "daily",
    compare: "previous",
    page: 1,
    limit: 25,
  });
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const type = section === "reports" ? reportType : section;
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== "" && v != null),
  ).toString();
  const key = `${user?.token}:${type}:${query}:${retry}`;
  const loading = state.key !== key;
  const data = !loading ? state.data : null;
  const error = !loading ? state.error : "";
  const update = (patch) =>
    setFilters((previous) => ({
      ...previous,
      ...patch,
      page: patch.page || 1,
    }));
  const changeSection = (next) => {
    setSection(next);
    setFilters((previous) => ({
      range: previous.range,
      start: previous.start,
      end: previous.end,
      bucket: previous.bucket,
      compare: previous.compare,
      page: 1,
      limit: 25,
    }));
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/analytics/${type}?${query}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${user?.token}` },
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success)
          throw new Error(result.message || "Unable to load analytics.");
        return result;
      })
      .then((result) => {
        if (!controller.signal.aborted)
          setState({ key, data: result, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ key, data: null, error: error.message });
      });
    return () => controller.abort();
  }, [key, type, query, user?.token]);
  const download = async (format) => {
    if (exporting) return;
    setExporting(true);
    setExportError("");
    // Open during the click, before fetch loses the browser's user activation.
    const printWindow = format === "print" ? window.open("", "_blank") : null;
    if (format === "print" && !printWindow) {
      setExportError("Your browser blocked the print window. Allow pop-ups for this site and try again.");
      setExporting(false);
      return;
    }
    if (printWindow) {
      printWindow.opener = null;
      printWindow.document.title = "Preparing report";
      printWindow.document.body.textContent = "Preparing your complete filtered report...";
    }
    try {
      const response = await fetch(
        `/api/admin/analytics/${type}?${query}&format=${format}`,
        { headers: { Authorization: `Bearer ${user?.token}` } },
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || "Export failed.");
      }
      if (printWindow) {
        const html = await response.text();
        if (printWindow.closed) throw new Error("The print window was closed. Please try again.");
        // The export endpoint HTML-escapes all report cells and titles.
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        const button = printWindow.document.createElement("button");
        button.textContent = "Print / Save PDF";
        button.className = "report-print-action";
        button.onclick = () => { printWindow.focus(); printWindow.print(); };
        printWindow.document.body.prepend(button);
        const style = printWindow.document.createElement("style");
        style.textContent = ".report-print-action{padding:10px 16px;margin-bottom:16px;cursor:pointer}@media print{.report-print-action{display:none}}";
        printWindow.document.head.append(style);
        printWindow.setTimeout(() => {
          if (!printWindow.closed) { printWindow.focus(); printWindow.print(); }
        }, 250);
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `shophub-${type}-${data.period.start}-${data.period.end}.${format === "excel" ? "xml" : "csv"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      if (printWindow && !printWindow.closed) printWindow.close();
      setExportError(error.message);
    } finally {
      setExporting(false);
    }
  };
  const statusRows = [...new Set(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Refunded', ...(data?.statuses || []).map(row => row.status)])].map(status => ({
    status, orders: Number(data?.statuses.find(row => row.status === status)?.orders || 0),
  }));
  const current = data?.summary.current;
  const metrics = type === "inventory" ? data?.summary.inventory : current;
  const metricKeys =
    {
      overview: [
        "revenue",
        "orders",
        "products_sold",
        "total_customers",
        "average_order_value",
        "pending_orders",
        "completed_orders",
        "cancelled_orders",
        "refunded_amount",
      ],
      sales: [
        "gross_sales",
        "discounts",
        "shipping",
        "tax",
        "sales_refunds",
        "revenue",
      ],
      orders: [
        "orders",
        "pending_orders",
        "completed_orders",
        "cancelled_orders",
      ],
      products: ["products_sold"],
      categories: ["products_sold"],
      customers: [
        "total_customers",
        "new_customers",
        "active_customers",
        "returning_customers",
        "average_customer_spending",
        "average_orders_per_customer",
      ],
      inventory: [
        "products",
        "stock_units",
        "low_stock_products",
        "out_of_stock_skus",
        "out_of_stock_products",
        "inventory_value",
        "uncosted_skus",
      ],
      payments: ["refunded_amount"],
      discounts: ["discounts", "coupons_used"],
    }[type] || [];
  const statusOptions =
    type === "orders"
      ? [
          "Pending",
          "Processing",
          "Shipped",
          "Delivered",
          "Cancelled",
          "Returned",
          "Refunded",
        ]
      : type === "inventory"
        ? ["In Stock", "Low Stock", "Out of Stock"]
        : [];
  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-sm font-bold uppercase text-slate-500">
          ShopHub Admin
        </p>
        <h1 className="text-3xl font-black text-slate-900">
          Reports &amp; Analytics
        </h1>
      </div>
      <nav aria-label="Analytics sections" className="flex flex-wrap gap-2">
        {sections.map((item, index) => (
          <button
            key={item}
            onClick={() => changeSection(item)}
            aria-pressed={section === item}
            style={{ backgroundColor:section === item ? palette[index % palette.length] : `${palette[index % palette.length]}10`, color:section === item ? "#fff" : palette[index % palette.length] }}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${section === item ? "bg-slate-900 text-white" : "bg-white border text-slate-700"}`}
          >
            {label(item)}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4">
        <label className="text-xs font-bold">
          Date range
          <select
            aria-label="Date range"
            className={`${control} block mt-1`}
            value={filters.range}
            onChange={(e) =>
              update({ range: e.target.value, compare: "previous" })
            }
          >
            {Object.entries(ranges).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        {filters.range === "custom" && (
          <>
            <label className="text-xs font-bold">
              From
              <input
                aria-label="Start date"
                type="date"
                className={`${control} block mt-1`}
                value={filters.start || ""}
                onChange={(e) => update({ start: e.target.value })}
              />
            </label>
            <label className="text-xs font-bold">
              Through
              <input
                aria-label="End date"
                type="date"
                className={`${control} block mt-1`}
                value={filters.end || ""}
                onChange={(e) => update({ end: e.target.value })}
              />
            </label>
          </>
        )}
        <label className="text-xs font-bold">
          Trend interval
          <select
            className={`${control} block mt-1`}
            value={filters.bucket}
            onChange={(e) => update({ bucket: e.target.value })}
          >
            {["daily", "weekly", "monthly", "yearly"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold">
          Compare
          <select
            className={`${control} block mt-1`}
            value={filters.compare}
            onChange={(e) =>
              update({
                compare: e.target.value,
                ...(e.target.value === "month"
                  ? { range: "month" }
                  : e.target.value === "year"
                    ? { range: "year" }
                    : {}),
              })
            }
          >
            <option value="previous">Previous equivalent period</option>
            <option value="month">This month to date vs last full month</option>
            <option value="year">This year to date vs last full year</option>
          </select>
        </label>
        {[
          "orders",
          "products",
          "customers",
          "categories",
          "inventory",
          "discounts",
        ].includes(type) && (
          <label className="text-xs font-bold">
            Table search
            <input
              aria-label="Search report"
              className={`${control} block mt-1`}
              placeholder="Search report"
              value={filters.search || ""}
              maxLength={100}
              onChange={(e) => update({ search: e.target.value })}
            />
          </label>
        )}
      </div>
      {section === "reports" && (
        <label>
          Report{" "}
          <select
            className={control}
            value={reportType}
            onChange={(e) => {
              setReportType(e.target.value);
              update({
                sort: "",
                direction: "",
                search: "",
                status: "",
                payment_status: "",
                performance: "",
              });
            }}
          >
            {["sales", "products", "customers", "orders"].map((v) => (
              <option key={v} value={v}>
                {label(v)} Report
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        {definitions[type]}
      </p>
      {loading ? (
        <div role="status" className="p-12 text-center">
          Loading database reports...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-xl bg-red-50 p-5 text-red-800">
          {error}{" "}
          <button
            className="underline ml-3"
            onClick={() => setRetry((v) => v + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        data && (
          <>
            <div className="text-sm text-slate-500">
              {data.period.start} through {data.period.end} · Comparison:{" "}
              {data.period.previousStart} through {data.period.previousEnd} ·{" "}
              {data.period.timezone} · Currency: PKR
            </div>
            {(current.unknown_currency_orders > 0 ||
              current.missing_breakdown_orders > 0) && (
              <p
                role="status"
                className="rounded-xl bg-slate-50 p-4 text-slate-900"
              >
                {current.unknown_currency_orders} orders have
                unknown/unsupported currency and are excluded from monetary
                aggregates. {current.missing_breakdown_orders} non-cancelled
                orders have incomplete pricing breakdowns; component totals are
                partial.
              </p>
            )}
            <MetricGrid cols={4}>
              {metricKeys.map((key, index) => (
                <StatCard
                  key={key}
                  label={label(key)}
                  value={display(key, metrics[key])}
                  icon={<FiActivity size={20} />}
                  accent={ACCENT_COLORS[index % ACCENT_COLORS.length]}
                  sub={
                    type !== "inventory" && data.summary.growth[key] != null
                      ? `${data.summary.growth[key] > 0 ? "+" : ""}${data.summary.growth[key]}% vs comparison`
                      : type !== "inventory" ? "No percentage baseline" : undefined
                  }
                />
              ))}
              {type === "overview" && (
                <StatCard
                  label="Low Stock Products · Now"
                  value={data.summary.inventory.low_stock_products}
                  icon={<FiActivity size={20} />}
                  accent={ACCENT_COLORS[metricKeys.length % ACCENT_COLORS.length]}
                />
              )}
            </MetricGrid>
            {type === "inventory" && (
              <Link
                className="inline-block underline text-sm"
                to="/admin/inventory"
              >
                Manage inventory, warehouses and purchase history
              </Link>
            )}
            {type === "discounts" && (
              <p className="rounded-xl border bg-white p-4">
                Most-used recorded coupon:{" "}
                {data.summary.mostUsedCoupon
                  ? `${data.summary.mostUsedCoupon.code} (${data.summary.mostUsedCoupon.uses} orders)`
                  : "No recorded coupon usage in this period."}
              </p>
            )}
            {["overview", "sales", "orders", "categories", "payments"].includes(type) && <Chart key={type} rows={data.chart} type={type} />}
            {["overview", "orders"].includes(type) && (
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-bold mb-3">Order Status</h2>
                <p className="mb-3 text-xs text-slate-500">Statuses for the selected date range. Completed orders are included in Delivered; returned/refunded orders use their return status.</p>
                <StatusDonut rows={statusRows} />
                <Bars
                  rows={statusRows.map(row => ({ name:row.status, value:Number(row.orders) }))}
                />
              </div>
            )}
            {!current.orders && type === "overview" && (
              <p className="rounded-xl border bg-white p-6">
                No orders in this date range. Current inventory and
                registered-customer counts remain available.
              </p>
            )}
            {data.table && (
              <section className="rounded-2xl border bg-white p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <h2 className="font-black text-lg">{label(type)} Report</h2>
                  <div className="flex flex-wrap gap-2">
                  {[
  ["csv", "CSV"],
  ["excel", "Excel XML"],
  ["print", "Print / Save PDF"],
].map(([format, name]) => {
  let btnColor = "bg-white text-slate-700 border-slate-300 hover:bg-slate-50";

  if (format === "csv") {
    btnColor = "bg-amber-500 text-white border-amber-600 hover:bg-emerald-700";
  } else if (format === "excel") {
    btnColor = "bg-green-700 text-white border-green-700 hover:bg-green-800";
  } else if (format === "print") {
    btnColor = "bg-blue-600 text-white border-slate-800 hover:bg-blue-900";
  }

  return (
    <button
      key={format}
      disabled={exporting}
      className={`rounded-lg px-3 py-2 text-sm font-semibold border transition-colors disabled:opacity-50 ${btnColor}`}
      onClick={() => download(format)}
    >
      {name}
    </button>
  );
})}
                  </div>
                </div>
                {exportError && (
                  <p role="alert" className="text-red-700">
                    {exportError}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  {statusOptions.length > 0 && (
                    <select
                      aria-label="Status filter"
                      className={control}
                      value={filters.status || ""}
                      onChange={(e) => update({ status: e.target.value })}
                    >
                      <option value="">All statuses</option>
                      {statusOptions.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  )}
                  {type === "orders" && (
                    <select
                      aria-label="Payment status"
                      className={control}
                      value={filters.payment_status || ""}
                      onChange={(e) =>
                        update({ payment_status: e.target.value })
                      }
                    >
                      <option value="">All payment statuses</option>
                      {["Paid", "Unpaid", "Refunded", "Partially Refunded"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  )}
                  {type === "products" && (
                    <select
                      aria-label="Product performance"
                      className={control}
                      value={filters.performance || ""}
                      onChange={(e) => update({ performance: e.target.value })}
                    >
                      <option value="">
                        All products · sort Units for best/worst
                      </option>
                      <option value="sold">
                        Products with delivered sales
                      </option>
                      <option value="zero">Zero delivered sales</option>
                    </select>
                  )}
                  <select
                    aria-label="Rows per page"
                    className={control}
                    value={filters.limit}
                    onChange={(e) => update({ limit: Number(e.target.value) })}
                  >
                    {[25, 50, 100].map((n) => (
                      <option key={n} value={n}>
                        {n} rows
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-slate-500">
                  Search and status filters apply to this table and its exports.
                  KPI cards and charts use the global date range. Click a column
                  heading to sort.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        {data.table.columns
                          .filter((c) => !(type === "customers" && c === "id"))
                          .map((c) => (
                            <th key={c} className="p-3 whitespace-nowrap">
                              <button
                                onClick={() =>
                                  update({
                                    sort: c,
                                    direction:
                                      filters.sort === c &&
                                      filters.direction === "ASC"
                                        ? "DESC"
                                        : "ASC",
                                  })
                                }
                              >
                                {label(c)}{" "}
                                {filters.sort === c
                                  ? filters.direction === "ASC"
                                    ? "↑"
                                    : "↓"
                                  : ""}
                              </button>
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.table.rows.map((row, index) => (
                        <tr key={row.id || index} className="border-t">
                          {data.table.columns
                            .filter(
                              (c) => !(type === "customers" && c === "id"),
                            )
                            .map((c) => (
                              <td key={c} className="p-3 whitespace-nowrap">
                                {c === "total" && row.currency !== "PKR"
                                  ? `${Number(row[c]).toLocaleString()} (${row.currency || "unknown currency"})`
                                  : display(c, row[c])}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.table.rows.length && (
                  <p className="p-6 text-center text-slate-500">
                    No records match these filters.
                  </p>
                )}
                <div className="flex justify-between items-center gap-3 text-sm">
                  <button
                    className={control}
                    disabled={filters.page <= 1}
                    onClick={() => update({ page: filters.page - 1 })}
                  >
                    Previous
                  </button>
                  <span>
                    {data.table.pagination.total} rows · Page {filters.page} of{" "}
                    {Math.max(1, data.table.pagination.pages)}
                  </span>
                  <button
                    className={control}
                    disabled={filters.page >= data.table.pagination.pages}
                    onClick={() => update({ page: filters.page + 1 })}
                  >
                    Next
                  </button>
                </div>
              </section>
            )}
          </>
        )
      )}
    </div>
  );
}

function Bars({ rows, color }) {
  const maximum = Math.max(1, ...rows.map((row) => Math.abs(row.value)));
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={row.name}>
          <div className="flex justify-between gap-3 text-xs mb-1">
            <span>{row.name}</span>
            <span>
              {row.value.toLocaleString("en-PK", { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="bg-slate-100 rounded h-2">
            <div
              className="bg-slate-800 rounded h-2"
              style={{ backgroundColor:color || chartColor(row.name, index), width: `${(Math.abs(row.value) / maximum) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
export function Chart({ rows, type }) {
  const [metric, setMetric] = useState(type === "orders" || type === "overview" ? "orders" : "revenue");
  const trend = ["overview", "sales", "orders"].includes(type);
  const selected = trend
    ? metric
    : type === "payments"
      ? "order_amount"
      : "revenue";
  const plotted = rows.map((row) => ({
    name: row.period || row.category || row.payment_method,
    value: Number(row[selected] || 0),
  }));
  return (
    <section className="rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <h2 className="font-bold">
          {trend
            ? "Revenue & Order Trend"
            : type === "payments"
              ? "Payment Method · Order Amount"
              : "Category Revenue"}
        </h2>
        {trend && (
          <select
            aria-label="Chart metric"
            className={control}
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
          >
            {["revenue", "orders", "units_sold"].map((k) => (
              <option key={k} value={k}>
                {label(k)}
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-4">
        {trend
          ? "Periods containing order records. Weekly buckets start Monday. Values are computed by the backend."
          : "Top 20 groups by amount; the table provides all groups."}
      </p>
      {!rows.length ? <p role="status" className="rounded-xl bg-slate-50 p-6 text-sm text-slate-600">No chart data in this date range. Select a wider date range.</p> : <>
        {trend && <TrendLine rows={plotted} color={chartColor(selected)} />}
        {trend && plotted.every(row => row.value === 0) && <p className="mb-3 text-sm text-slate-600">All reported {label(selected).toLowerCase()} values are zero.{selected === 'revenue' ? ' Orders with unknown currency are excluded from revenue; select Orders to see order activity.' : ''}</p>}
        {trend && plotted.length === 1 && <p className="mb-3 text-sm text-slate-600">Only one period has records, so the trend shows one point. Select a wider date range for more periods.</p>}
      </>}
      <div className="max-h-96 overflow-y-auto pr-2">
        <Bars rows={plotted} color={trend ? chartColor(selected) : undefined} />
      </div>
    </section>
  );
}

// Visualizations reuse the exact response values; no extra queries or financial calculations.
function TrendLine({ rows, color }) {
  const values = rows.map((row) => row.value);
  const low = Math.min(0, ...values),
    high = Math.max(1, ...values);
  const y = (value) => 170 - ((value - low) / (high - low)) * 145;
  const x = (index) => rows.length === 1 ? 350 : 55 + (index / (rows.length - 1)) * 590;
  const points = rows
    .map((row, index) => x(index) + "," + y(row.value))
    .join(" ");
  return (
    <div className="mb-6 overflow-x-auto rounded-xl bg-slate-50/60 p-3">
      <svg
        viewBox="0 0 680 210"
        className="w-full min-w-75"
        role="img"
        aria-label="Selected metric over the reported periods; exact values follow below"
      >
        {[0, 0.5, 1].map((step) => {
          const value = low + (high - low) * step;
          return (
            <g key={step}>
              <line
                className="stroke-slate-200" strokeDasharray="4 5"
                x1="55"
                x2="645"
                y1={y(value)}
                y2={y(value)}
              />
              <text
                className="fill-slate-500 text-[11px]"
                x="48"
                y={y(value) + 4}
                textAnchor="end"
              >
                {Intl.NumberFormat("en", { notation: "compact" }).format(value)}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
        {rows.map((row, index) => (
          <circle
            key={row.name}
            cx={x(index)}
            cy={y(row.value)}
            r="5"
            fill={color}
            stroke="white"
            strokeWidth="2"
          >
            <title>
              {row.name}: {row.value.toLocaleString()}
            </title>
          </circle>
        ))}
        <text className="fill-slate-500 text-[11px]" x="55" y="199">
          {rows[0]?.name}
        </text>
        <text className="fill-slate-500 text-[11px]" x="645" y="199" textAnchor="end">
          {rows.length > 1 ? rows.at(-1)?.name : ""}
        </text>
      </svg>
    </div>
  );
}
export function StatusDonut({ rows }) {
  const total = rows.reduce((sum, row) => sum + Number(row.orders), 0);
  return (
    <div className="mb-6 flex flex-wrap items-center gap-8 rounded-xl bg-slate-50 p-5">
      <svg
        viewBox="0 0 160 160"
        width="160"
        height="160"
        role="img"
        aria-label={total + " orders by status"}
      >
        <circle
          cx="80"
          cy="80"
          r="60"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="18"
        />
        {rows.map((row, index) => {
          const fraction = total ? (Number(row.orders) / total) * 100 : 0;
          const start = total
            ? (rows
                .slice(0, index)
                .reduce((sum, item) => sum + Number(item.orders), 0) /
                total) *
              100
            : 0;
          return (
            <circle
              key={row.status}
              cx="80"
              cy="80"
              r="60"
              pathLength="100"
              fill="none"
              stroke={chartColor(row.status, index)}
              strokeWidth="18"
              strokeDasharray={fraction + " " + (100 - fraction)}
              strokeDashoffset={-start}
              transform="rotate(-90 80 80)"
            >
              <title>
                {row.status}: {row.orders}
              </title>
            </circle>
          );
        })}
        <text
          x="80"
          y="80"
          textAnchor="middle"
          fill="#0f172a"
          fontSize="26"
          fontWeight="700"
        >
          {total}
        </text>
        <text x="80" y="100" textAnchor="middle" fill="#64748b" fontSize="12">
          orders
        </text>
      </svg>
      <ul className="flex-1 min-w-37.5 space-y-2 text-sm">
        {!total && <li role="status" className="text-slate-600">No orders in this date range. Select a wider date range.</li>}
        {rows.map((row, index) => (
          <li key={row.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: chartColor(row.status, index) }}
            />
            <span className="flex-1 text-slate-600">{row.status} ({row.orders})</span>
            <span className="font-semibold text-slate-900">
              {total ? ((Number(row.orders) / total) * 100).toFixed(1) : "0"}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
