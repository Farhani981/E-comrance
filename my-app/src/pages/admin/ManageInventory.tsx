import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  FiArrowDownLeft,
  FiArrowUpRight,
  FiBox,
  FiDownload,
  FiEdit2,
  FiChevronDown,
  FiMapPin,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiSliders,
  FiX,
  FiTruck,
} from "react-icons/fi";
import {
  operationsRequest as request,
  money,
  inputClass,
  buttonClass,
  secondaryClass,
  Field,
  LoadNotice,
} from "./operationsShared";
 
type Product = {
  id: number;
  name: string;
  image: string;
  sku: string;
  stock: number;
  price: number;
  low_stock_threshold: number;
  warehouse_id: number | null;
  warehouse_name: string | null;
  purchased_units: number;
  purchase_cost: number;
  average_cost: number | null;
  supplier_names: string | null;
  sold_units: number;
  committed_units: number;
  returned_units: number;
  sales_value: number;
  last_purchase_date: string | null;
  last_sale_date: string | null;
};
type Warehouse = {
  id: number;
  name: string;
  address: string;
  product_count: number;
};
type Movement = {
  id: number;
  product_id: number;
  product_name: string;
  delta: number;
  reason: string;
  actor_name: string | null;
  created_at: string;
};
type Purchase = {
  id: number;
  invoice_no: string;
  purchase_date: string;
  supplier_name: string | null;
  quantity: number;
  cost_price: number;
  total_cost: number;
};
type Order = {
  id: number;
  order_id: string;
  created_at: string;
  order_status: string;
  quantity: number;
  price: number;
  restocked: number;
};
type History = {
  purchases: Purchase[];
  orders: Order[];
  adjustments: Movement[];
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
const qty = (value: number) => Number(value || 0).toLocaleString("en-PK");
const stockStatus = (p: Product) =>
  Number(p.stock) <= 0
    ? "Out of stock"
    : Number(p.stock) <= Number(p.low_stock_threshold)
      ? "Low stock"
      : "In stock";
const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm";
const th =
  "whitespace-nowrap px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";
const td = "px-5 py-4 text-sm text-slate-600";
 
function StockBadge({ product }: { product: Product }) {
  const status = stockStatus(product);
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${status === "In stock" ? "bg-emerald-50 text-emerald-700" : status === "Low stock" ? "bg-slate-50 text-slate-700" : "bg-rose-50 text-rose-700"}`}
    >
      {status}
    </span>
  );
}
function Movements({ rows }: { rows: Movement[] }) {
  const [filter, setFilter] = useState<'ALL' | 'IN' | 'OUT' | 'RETURNS'>('ALL');
  const [query, setQuery] = useState('');

  const filteredRows = rows.filter((r) => {
    const isPositive = Number(r.delta) > 0;
    const isReturn = r.reason?.toLowerCase().includes('return') || r.reason?.toLowerCase().includes('cancel');
    const matchesSearch = !query || r.product_name.toLowerCase().includes(query.toLowerCase()) || r.reason.toLowerCase().includes(query.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filter === 'IN') return isPositive && !isReturn;
    if (filter === 'OUT') return !isPositive;
    if (filter === 'RETURNS') return isReturn;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${filter === 'ALL' ? 'bg-black text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            All Movements ({rows.length})
          </button>
          <button
            onClick={() => setFilter('OUT')}
            className={`px-3 py-1.5 rounded-lg transition ${filter === 'OUT' ? 'bg-black text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Stock Out / Orders (−)
          </button>
          <button
            onClick={() => setFilter('RETURNS')}
            className={`px-3 py-1.5 rounded-lg transition ${filter === 'RETURNS' ? 'bg-black text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Returns &amp; Cancellations (+)
          </button>
          <button
            onClick={() => setFilter('IN')}
            className={`px-3 py-1.5 rounded-lg transition ${filter === 'IN' ? 'bg-black text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
          >
            Manual In / Purchases (+)
          </button>
        </div>
        <input
          type="text"
          placeholder="Filter by product or reason..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-black max-w-xs w-full"
        />
      </div>

      {filteredRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">Timestamp</th>
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">Type</th>
                <th className="py-3 px-4 font-bold">Quantity Change</th>
                <th className="py-3 px-4 font-bold">Reason / Reference</th>
                <th className="py-3 px-4 font-bold text-right">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((a) => {
                const isPositive = Number(a.delta) > 0;
                const isReturn = a.reason?.toLowerCase().includes('return') || a.reason?.toLowerCase().includes('cancel');
                return (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-500 text-xs font-mono">{date(a.created_at)}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{a.product_name}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        isReturn
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : isPositive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {isReturn ? 'RESTOCK RETURN' : isPositive ? 'STOCK IN' : 'SALE DEDUCTION'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <strong className={`font-mono text-sm ${isPositive ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {isPositive ? '+' : ''}{qty(a.delta)}
                      </strong>
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs max-w-sm truncate">{a.reason}</td>
                    <td className="py-3 px-4 text-slate-500 text-xs text-right font-medium">{a.actor_name || 'System / Order Flow'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-8 text-center text-sm text-slate-500">
          No recorded movements match this filter.
        </p>
      )}
    </div>
  );
}

 
export default function ManageInventory() {
  const [data, setData] = useState<{
    products: Product[];
    warehouses: Warehouse[];
    adjustments: Movement[];
  }>({ products: [], warehouses: [], adjustments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("stock");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [direction, setDirection] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyTab, setHistoryTab] = useState("purchases");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [newWarehouse, setNewWarehouse] = useState(false);
  const [warehouseName, setWarehouseName] = useState("");
  const [warehouseAddress, setWarehouseAddress] = useState("");
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [actionsPosition, setActionsPosition] = useState({ top: 0, left: 0 });
  const detailRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLElement>(null);
  const editingProductId = editing?.id;
  const adjustingProductId = adjusting?.id;
  useEffect(() => {
    if (editingProductId == null && adjustingProductId == null) return;
    editorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    editorRef.current?.focus({ preventScroll: true });
  }, [editingProductId, adjustingProductId]);
  useEffect(() => {
    if (openActionsId === null) return;
    const closeAll = () => {
      setOpenActionsId(null);
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-row-dropdown]")) closeAll();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };
    const onScroll = (event: Event) => {
      if (!(event.target as HTMLElement)?.closest?.('[role="menu"]')) closeAll();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', closeAll);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', closeAll);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openActionsId]);
  useEffect(() => {
    if (selected === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/operations/inventory");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (selected === null) return;
    const controller = new AbortController();
    setHistory(null);
    setHistoryError("");
    request(`/operations/inventory/${selected}/history`, {
      signal: controller.signal,
    })
      .then(setHistory)
      .catch((e) => {
        if (!controller.signal.aborted) setHistoryError(e.message);
      });
    return () => controller.abort();
  }, [selected, data]);
  useEffect(() => {
    setPage(1);
  }, [search, status, warehouse, sort]);
 
  const mutate = async (path: string, body: object) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await request(`/operations${path}`, {
        method:
          path.endsWith("/adjust") || path === "/warehouses" ? "POST" : "PUT",
        body: JSON.stringify(body),
      });
      setEditing(null);
      setAdjusting(null);
      setNewWarehouse(false);
      setNotice("Inventory updated successfully.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  };
  const filtered = data.products
    .filter(
      (p) =>
        `${p.name} ${p.sku || ""} ${p.supplier_names || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!status || stockStatus(p) === status) &&
        (!warehouse ||
          (warehouse === "none"
            ? !p.warehouse_id
            : String(p.warehouse_id) === warehouse)),
    )
    .sort((a, b) =>
      sort === "stock"
        ? Number(a.stock) - Number(b.stock)
        : sort === "sold"
          ? Number(b.sold_units) - Number(a.sold_units)
          : sort === "value"
            ? Number(b.stock) * Number(b.average_cost) -
              Number(a.stock) * Number(a.average_cost)
            : a.name.localeCompare(b.name),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const total = (
    key: "stock" | "sold_units" | "committed_units" | "purchased_units",
  ) => data.products.reduce((n, p) => n + Number(p[key]), 0);
  const stockValue = data.products.reduce(
    (n, p) => n + Number(p.stock) * Number(p.average_cost),
    0,
  );
  const missingCost = data.products.filter(
    (p) => Number(p.stock) > 0 && p.average_cost === null,
  ).length;
  const lowStock = data.products.filter((p) => stockStatus(p) !== "In stock");
  const selectedProduct = data.products.find((p) => p.id === selected);
  const movements = data.adjustments.filter(
    (a) =>
      `${a.product_name} ${a.reason} ${a.actor_name || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!direction ||
        (direction === "in" ? Number(a.delta) > 0 : Number(a.delta) < 0)),
  );
  const exportCsv = () => {
    const rows = [
      [
        "Product",
        "SKU",
        "Suppliers",
        "Warehouse",
        "Purchased units",
        "Purchase cost",
        "Average unit cost",
        "Available units",
        "Delivered sold units",
        "Open order units",
        "Returned units",
        "Estimated stock cost",
        "Status",
      ],
      ...filtered.map((p) => [
        p.name,
        p.sku,
        p.supplier_names,
        p.warehouse_name,
        p.purchased_units,
        p.purchase_cost,
        p.average_cost ?? "",
        p.stock,
        p.sold_units,
        p.committed_units,
        p.returned_units,
        p.average_cost === null ? "" : Number(p.stock) * Number(p.average_cost),
        stockStatus(p),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
          })
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "inventory-report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
 const inspect = (id: number, targetTab: string = "purchases") => {
  setSelected(id);
  setHistoryTab(targetTab);
  setOpenActionsId(null);
  window.setTimeout(() => detailRef.current?.focus({ preventScroll: true }), 0);
};
 
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
            Stock & supply
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">
            Inventory overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Know where your stock came from, what it cost, and what sold.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
      <button
  className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
  onClick={exportCsv}
  disabled={loading || !!error || !filtered.length}
>
  <FiDownload /> Export stock
</button>
        <Link className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 shadow-sm transition" to="/admin/purchases">
  <FiPlus /> Record purchase
</Link>
        </div>
      </header>
      <LoadNotice loading={loading} error={error} />
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Available stock",
            value: qty(total("stock")),
            note: "Stock is deducted when an order is placed",
            icon: FiBox,
            theme: "border-blue-200 bg-blue-50",
            accent: "text-blue-700 bg-blue-100",
          },
          {
            label: "Estimated stock cost",
            value: money(stockValue),
            note: missingCost
              ? `${missingCost} stocked products have no purchase cost`
              : "Based on weighted average purchase cost",
            icon: FiTruck,
            theme: "border-violet-200 bg-violet-50",
            accent: "text-violet-700 bg-violet-100",
          },
          {
            label: "Delivered sales · units",
            value: qty(total("sold_units")),
            note: `${qty(total("committed_units"))} units in open orders`,
            icon: FiArrowUpRight,
            theme: "border-emerald-200 bg-emerald-50",
            accent: "text-emerald-700 bg-emerald-100",
          },
          {
            label: "Needs replenishment",
            value: qty(lowStock.length),
            note: `${data.products.filter((p) => Number(p.stock) <= 0).length} out of stock · ${qty(total("purchased_units"))} units purchased`,
            icon: FiRefreshCw,
            theme: "border-amber-200 bg-amber-50",
            accent: "text-amber-700 bg-amber-100",
          },
        ].map((card) => (
          <div
            key={card.label}
            className={`flex h-full flex-col rounded-2xl border p-5 text-slate-900 shadow-sm ${card.theme}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-xs font-semibold leading-5 text-slate-700">
                {card.label}
              </p>
              <card.icon
                className={`h-10 w-10 shrink-0 rounded-xl p-2.5 ${card.accent}`}
                aria-hidden="true"
              />
            </div>
            <p
              title={loading ? undefined : String(card.value)}
              className="mt-4 truncate text-[clamp(1.25rem,2.1vw,1.75rem)] font-extrabold leading-tight tracking-tight tabular-nums"
            >
              {loading ? "—" : card.value}
            </p>
            <p className="mt-auto pt-3 text-xs leading-5 text-slate-600">
              {card.note}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          ["stock", "Stock overview"],
          ["movements", "Stock movements"],
          ["warehouses", "Warehouses"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setTab(key);
              setSearch("");
            }}
            className={tab === key ? buttonClass : secondaryClass}
          >
            {label}
          </button>
        ))}
      </div>
 
      {tab !== "warehouses" && (
        <div className="flex flex-wrap gap-3">
          <label className="relative min-w-52 flex-1">
            <FiSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              className={`${inputClass} pl-10`}
              aria-label="Search inventory"
              placeholder={
                tab === "stock"
                  ? "Search product, SKU or supplier…"
                  : "Search product, reason or staff…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {tab === "stock" ? (
            <>
              <select
                aria-label="Stock status"
                className={`${inputClass} sm:w-auto`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All stock levels</option>
                {["In stock", "Low stock", "Out of stock"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <select
                aria-label="Warehouse"
                className={`${inputClass} sm:w-auto`}
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
              >
                <option value="">All warehouses</option>
                <option value="none">Unassigned</option>
                {data.warehouses.map((w) => (
                  <option value={w.id} key={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Sort inventory"
                className={`${inputClass} sm:w-auto`}
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name A–Z</option>
                <option value="stock">Lowest stock first</option>
                <option value="sold">Best sellers first</option>
                <option value="value">Highest stock cost</option>
              </select>
            </>
          ) : (
            <select
              aria-label="Movement direction"
              className={`${inputClass} sm:w-auto`}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="">All movements</option>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
            </select>
          )}
          <button
            className={secondaryClass}
            onClick={() => void load()}
            disabled={loading}
          >
            <FiRefreshCw /> Refresh
          </button>
        </div>
      )}
 
      {tab === "stock" && (
        <section className={`${panel} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold text-slate-900">
              Product stock{" "}
              <span className="ml-2 text-sm font-normal text-slate-400">
                {filtered.length} products
              </span>
            </h2>
            <p className="text-xs text-slate-500">All-time purchases & sales</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Product",
                    "Supplier / source",
                    "Purchased",
                    "Avg. cost / unit",
                    "Available",
                    "Sold / open",
                    "Stock status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered
                  .slice((currentPage - 1) * 12, currentPage * 12)
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className={td}>
                        <div className="flex min-w-56 items-center gap-3">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt=""
                              loading="lazy"
                              className="h-12 w-12 rounded-xl bg-slate-100 object-contain"
                            />
                          ) : (
                            <FiBox className="h-10 w-10 rounded-lg bg-slate-100 p-2 text-slate-400" />
                          )}
                          <div>
                            <button
                              onClick={() => inspect(p.id)}
                              className="text-left font-bold text-slate-900 hover:text-slate-600"
                            >
                              {p.name}
                            </button>
                            <p className="mt-1 text-sm text-slate-400">
                              {p.sku || "No SKU"} ·{" "}
                              {p.warehouse_name || "Unassigned"}
                            </p>
 
                          </div>
                        </div>
                      </td>
                      <td className={td}>
                        <p className="max-w-48 text-sm font-medium text-slate-700">{p.supplier_names || 'Opening / manual stock'}</p>
                        <p className="mt-1 text-sm text-slate-400">{Number(p.purchased_units) > 0 ? 'Supplier purchases linked to this SKU' : 'No supplier invoice linked'}</p>
                      </td>
                      <td className={td}>
                        <strong className="text-slate-900">
                          {qty(p.purchased_units)}
                        </strong>
                        <p className="mt-1 whitespace-nowrap text-sm">
                          {money(p.purchase_cost)}
                        </p>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {p.average_cost === null
                          ? "Not recorded"
                          : money(p.average_cost)}
                        <p className="mt-1 text-xs text-slate-400">
                          Retail {money(p.price)}
                        </p>
                      </td>
                      <td className={td}>
                        <strong className="text-lg text-slate-900">
                          {qty(p.stock)}
                        </strong>
                        <p className="mt-1 whitespace-nowrap text-xs text-slate-400">
                          Alert at {qty(p.low_stock_threshold)}
                        </p>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        <strong className="text-emerald-700">
                          {qty(p.sold_units)} sold
                        </strong>
                        <p className="mt-1 text-xs">
                          {qty(p.committed_units)} open ·{" "}
                          {qty(p.returned_units)} returned
                        </p>
                      </td>
                      <td className={td}>
                        <StockBadge product={p} />
                      </td>
                      <td className={td}>
                        <div className="flex gap-2">
                          {/* Product actions and ledger history */}
                          <div
                            data-row-dropdown
                            className="relative inline-block text-left"
                          >
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openActionsId === p.id}
                              aria-label={`Open actions for ${p.name}`}
                              title="Product actions"
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-700"
                              onClick={(event) => {
                                const rect = event.currentTarget.getBoundingClientRect();
                                const menuHeight = 300;
                                setActionsPosition({
                                  left: Math.max(8, Math.min(rect.right - 224, window.innerWidth - 232)),
                                  top: rect.bottom + menuHeight > window.innerHeight ? Math.max(8, rect.top - menuHeight) : rect.bottom + 6,
                                });
                                setOpenActionsId(
                                  openActionsId === p.id ? null : p.id,
                                );
                              }}
                            >
                              <FiSettings className="h-4 w-4" /> Actions
                              <FiChevronDown className="h-3 w-3" />
                            </button>
 
                            {openActionsId === p.id && createPortal(
                              <div
                                role="menu"
                                data-row-dropdown
                                style={actionsPosition}
                                className="fixed z-[100] w-56 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg ring-1 ring-black/5 focus:outline-none"
                              >
                                <Link
                                  to={`/admin/purchases?product=${p.id}`}
                                  role="menuitem"
                                  onClick={() => setOpenActionsId(null)}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <FiPlus className="h-3.5 w-3.5" /> Purchase again
                                </Link>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setEditing({ ...p });
                                    setAdjusting(null);
                                    setError("");
                                    setNotice("");
                                    setOpenActionsId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <FiEdit2 className="h-3.5 w-3.5" /> Edit SKU &amp;
                                  warehouse
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setAdjusting(p);
                                    setEditing(null);
                                    setError("");
                                    setNotice("");
                                    setDelta("");
                                    setReason("");
                                    setOpenActionsId(null);
                                  }}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                >
                                  <FiSliders className="h-3.5 w-3.5" /> Adjust stock
                                </button>
                                <div className="my-1 border-t border-slate-100" />
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => inspect(p.id, "purchases")}
                                  className="flex w-full items-center px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                                >
                                  📦 Supplier Purchases
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => inspect(p.id, "orders")}
                                  className="flex w-full items-center px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                                >
                                  🛒 Sales &amp; Orders
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => inspect(p.id, "adjustments")}
                                  className="flex w-full items-center px-4 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
                                >
                                  🔄 Recorded Movements
                                </button>
                              </div>, document.body,
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && !filtered.length && (
            <p className="p-10 text-center text-sm text-slate-500">
              No products match. Clear the filters or add products and record a
              purchase.
            </p>
          )}
          <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
            <span>
              Page {currentPage} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                className={secondaryClass}
                disabled={currentPage <= 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <button
                className={secondaryClass}
                disabled={currentPage >= pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      )}
 
      {(editing || adjusting) && (
        <section ref={editorRef} tabIndex={-1} aria-label={editing ? 'Edit inventory settings' : 'Adjust inventory stock'} className={`${panel} scroll-mt-20 p-6 focus:outline-none`}>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <h2 className="mb-4 text-lg font-bold">
            {editing ? "Product stock settings" : "Adjust stock count"} ·{" "}
            {(editing || adjusting)?.name}
          </h2>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(`/inventory/${editing.id}`, editing);
              }}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="SKU">
                  <input
                    required
                    maxLength={100}
                    className={inputClass}
                    value={editing.sku || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, sku: e.target.value })
                    }
                  />
                </Field>
                <Field label="Low stock alert at">
                  <input
                    type="number"
                    required
                    min="0"
                    max="100000000"
                    step="1"
                    className={inputClass}
                    value={editing.low_stock_threshold}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        low_stock_threshold: Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Warehouse">
                  <select
                    className={inputClass}
                    value={editing.warehouse_id || ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        warehouse_id: Number(e.target.value) || null,
                      })
                    }
                  >
                    <option value="">Unassigned</option>
                    {data.warehouses.map((w) => (
                      <option value={w.id} key={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <button disabled={saving} className={buttonClass}>
                Save settings
              </button>{" "}
              <button
                type="button"
                disabled={saving}
                className={secondaryClass}
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            </form>
          ) : (
            adjusting && (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(`/inventory/${adjusting.id}/adjust`, {
                    delta,
                    reason,
                  });
                }}
              >
                <p className="text-sm text-slate-500">
                  Use for count corrections, damage or loss. Record incoming
                  supplier stock through Purchases to preserve its source and
                  cost.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Quantity change (+ add / − remove)">
                    <input
                      type="number"
                      required
                      min={-Number(adjusting.stock)}
                      max="100000000"
                      step="1"
                      className={inputClass}
                      value={delta}
                      onChange={(e) => setDelta(e.target.value)}
                    />
                    <span className="mt-1 block text-xs">
                      Current: {qty(adjusting.stock)} · After adjustment:{" "}
                      {qty(Number(adjusting.stock) + Number(delta))}
                    </span>
                  </Field>
                  <Field label="Reason">
                    <input
                      required
                      maxLength={500}
                      className={inputClass}
                      value={reason}
                      placeholder="e.g. 2 damaged items found in stock count"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                </div>
                <button
                  disabled={saving || !Number(delta)}
                  className={buttonClass}
                >
                  Confirm adjustment
                </button>{" "}
                <button
                  type="button"
                  disabled={saving}
                  className={secondaryClass}
                  onClick={() => setAdjusting(null)}
                >
                  Cancel
                </button>
              </form>
            )
          )}
        </section>
      )}
 
      {tab === "movements" && (
        <section className={panel}>
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-bold">Recent stock movements</h2>
            <p className="mt-1 text-xs text-slate-500">
              Latest 100 recorded changes. Open a product for its full recorded
              history.
            </p>
          </div>
          <Movements rows={movements} />
        </section>
      )}
      {tab === "warehouses" && (
        <section className="space-y-4">
          <div className="flex flex-wrap justify-between gap-3">
            <p className="text-sm text-slate-500">
              Assign each product to its storage location.
            </p>
           <button
  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
  onClick={() => {
    setNewWarehouse(true);
    setWarehouseName("");
    setWarehouseAddress("");
  }}
>
  <FiPlus /> Add warehouse
</button>
          </div>
          {newWarehouse && (
            <form
              className={`${panel} space-y-4 p-5`}
              onSubmit={(e) => {
                e.preventDefault();
                void mutate("/warehouses", {
                  name: warehouseName,
                  address: warehouseAddress,
                });
              }}
            >
              <Field label="Warehouse name">
                <input
                  required
                  maxLength={120}
                  className={inputClass}
                  value={warehouseName}
                  onChange={(e) => setWarehouseName(e.target.value)}
                />
              </Field>
              <Field label="Address">
                <input
                  maxLength={500}
                  className={inputClass}
                  value={warehouseAddress}
                  onChange={(e) => setWarehouseAddress(e.target.value)}
                />
              </Field>
              <button disabled={saving} className={buttonClass}>
                Save warehouse
              </button>{" "}
              <button
                type="button"
                disabled={saving}
                className={secondaryClass}
                onClick={() => setNewWarehouse(false)}
              >
                Cancel
              </button>
            </form>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {data.warehouses.map((w) => (
              <article className={`${panel} p-5`} key={w.id}>
                <FiMapPin className="mb-4 text-xl text-slate-500" />
                <h3 className="font-bold">{w.name}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {w.address || "No address added"}
                </p>
                <div className="mt-5 flex justify-between text-sm">
                  <span>{qty(w.product_count)} products</span>
                  <strong>
                    {qty(
                      data.products
                        .filter((p) => p.warehouse_id === w.id)
                        .reduce((n, p) => n + Number(p.stock), 0),
                    )}{" "}
                    units
                  </strong>
                </div>
                <button
                  className={`${secondaryClass} mt-4 w-full`}
                  onClick={() => {
                    setWarehouse(String(w.id));
                    setStatus("");
                    setSearch("");
                    setTab("stock");
                  }}
                >
                  View stock
                </button>
              </article>
            ))}
          </div>
          {!loading && !data.warehouses.length && (
            <p className={`${panel} p-8 text-center text-sm text-slate-500`}>
              Add your first warehouse, then assign products using stock
              settings.
            </p>
          )}
        </section>
      )}
 
      {selectedProduct &&
        createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
        <section
          ref={detailRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={`Product history for ${selectedProduct.name}`}
          className="absolute inset-0 flex flex-col bg-white focus:outline-none"
        >
          <div className="flex shrink-0 flex-wrap justify-between gap-3 border-b border-slate-200 bg-slate-50 p-6 text-slate-900">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400">
                Product history
              </p>
              <h2 className="mt-2 text-xl font-bold">{selectedProduct.name}</h2>
              <p className="mt-1 text-sm text-slate-500">
                Last purchase {date(selectedProduct.last_purchase_date)} · Last
                delivered sale {date(selectedProduct.last_sale_date)}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close history"
              title="Close history"
              className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setSelected(null)}
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="grid gap-4 border-b border-slate-100 p-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Total purchasing cost</p>
              <strong>{money(selectedProduct.purchase_cost)}</strong>
            </div>
            <div>
              <p className="text-xs text-slate-500">
                Delivered item sales · before discounts
              </p>
              <strong>{money(selectedProduct.sales_value)}</strong>
            </div>
            <div>
              <p className="text-xs text-slate-500">
                Estimated cost of available stock
              </p>
              <strong>
                {selectedProduct.average_cost === null
                  ? "No purchase cost recorded"
                  : money(
                      Number(selectedProduct.stock) *
                        Number(selectedProduct.average_cost),
                    )}
              </strong>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 p-5">
            {[
              ["purchases", "Supplier purchases"],
              ["orders", "Sales & orders"],
              ["adjustments", "Recorded movements"],
            ].map(([key, label]) => (
              <button
                className={historyTab === key ? buttonClass : secondaryClass}
                key={key}
                onClick={() => setHistoryTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <LoadNotice
            loading={!history && !historyError}
            error={historyError}
          />
          {history &&
            (historyTab === "adjustments" ? (
              <Movements rows={history.adjustments} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {(historyTab === "purchases"
                        ? [
                            "Invoice",
                            "Supplier",
                            "Date",
                            "Units",
                            "Unit cost",
                            "Total cost",
                          ]
                        : ["Order", "Date", "Status", "Units", "Unit price"]
                      ).map((h) => (
                        <th key={h} className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyTab === "purchases"
                      ? history.purchases.map((p) => (
                          <tr key={p.id}>
                            <td className={td}>{p.invoice_no}</td>
                            <td className={td}>
                              {p.supplier_name || "Unknown supplier"}
                            </td>
                            <td className={td}>{date(p.purchase_date)}</td>
                            <td className={td}>{qty(p.quantity)}</td>
                            <td className={td}>{money(p.cost_price)}</td>
                            <td className={td}>{money(p.total_cost)}</td>
                          </tr>
                        ))
                      : history.orders.map((o) => (
                          <tr key={o.id}>
                            <td className={`${td} break-all`}>{o.order_id}</td>
                            <td className={td}>{date(o.created_at)}</td>
                            <td className={td}>
                              {o.order_status}
                              {Number(o.restocked) > 0 &&
                              o.order_status !== "Cancelled"
                                ? " · Returned to stock"
                                : ""}
                            </td>
                            <td className={td}>{qty(o.quantity)}</td>
                            <td className={td}>{money(o.price)}</td>
                          </tr>
                        ))}
                  </tbody>
                </table>
                {!(
                  historyTab === "purchases"
                    ? history.purchases
                    : history.orders
                ).length && (
                  <p className="p-8 text-center text-sm text-slate-500">
                    No records for this product yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        </div>,
          document.body,
        )}
      <p className="text-xs leading-relaxed text-slate-500">
        Sold units include delivered/completed orders, excluding cancellations
        and received returns. Available stock is reduced when an order is placed;
        marking it delivered does not deduct it again. Cancellations and received
        returns restore stock. Stock
        cost uses recorded purchases only; opening stock and manual adjustments
        may have no cost history. Purchase edits update the purchase totals;
        recorded movements preserve subsequent quantity changes.
      </p>
    </div>
  );
}
