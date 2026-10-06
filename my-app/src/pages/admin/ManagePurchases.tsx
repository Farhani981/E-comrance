import ProductCategoryFields from '../../component/ProductCategoryFields';
import { useProducts } from '../../context/ProductContext';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ElementType } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiChevronDown,
  FiArrowLeft,
  FiCreditCard,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiEye,
  FiPackage,
  FiPlus,
  FiPrinter,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiTruck,
  FiX,
} from "react-icons/fi";
import { useAdminAlert } from "../../context/AdminAlertContext";

function PurchaseActions({ purchase, onView, onEdit, onPayment, onDelete }: {
  purchase: Purchase;
  onView: () => void;
  onPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const id = `purchase-actions-${purchase.id}`;

  useEffect(() => {
    if (!position) return;
    dropdown.current?.querySelector<HTMLElement>('a, button')?.focus();
    const outside = (event: PointerEvent) => {
      if (!dropdown.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setPosition(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPosition(null);
        trigger.current?.focus();
      }
    };
    const close = () => setPosition(null);
    const scroll = (event: Event) => {
      if (!dropdown.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', scroll, true);
    };
  }, [position]);

  const itemClass = 'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`Actions for ${purchase.invoice_no}`}
        aria-expanded={Boolean(position)}
        aria-controls={position ? id : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        onClick={() => {
          if (position) return setPosition(null);
          const rect = trigger.current!.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(rect.right - 192, window.innerWidth - 200)),
            top: rect.bottom + 200 > window.innerHeight ? Math.max(8, rect.top - 200) : rect.bottom + 6,
          });
        }}
      >
        Actions <FiChevronDown aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={dropdown}
          id={id}
          aria-label={`Purchase actions for ${purchase.invoice_no}`}
          className="fixed z-[100] w-48 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          style={position}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setPosition(null);
          }}
        >
          <button type="button" onClick={() => { setPosition(null); onView(); }} className={`${itemClass} text-slate-700 hover:bg-slate-50`}>
            <FiEye aria-hidden="true" /> View purchase
          </button>
          <button type="button" onClick={() => { setPosition(null); onEdit(); }} className={`${itemClass} text-emerald-700 hover:bg-emerald-50`}>
            <FiEdit2 aria-hidden="true" /> Edit purchase
          </button>
          <button type="button" onClick={() => { setPosition(null); onPayment(); }} className={`${itemClass} text-emerald-700 hover:bg-emerald-50`}>
            <FiCreditCard aria-hidden="true" /> Payment
          </button>
          <button type="button" onClick={() => { setPosition(null); onDelete(); }} className={`${itemClass} text-red-600 hover:bg-red-50`}>
            <FiTrash2 aria-hidden="true" /> Delete purchase
          </button>
        </div>, document.body,
      )}
    </>
  );
}

const ADMIN_API = "/api/admin";
const PRODUCTS_API = "/api/products";
const PAGE_SIZE = 10;

const getToken = () => {
  try {
    return JSON.parse(localStorage.getItem("shophub_user") || "{}").token || "";
  } catch {
    return "";
  }
};

const request = async <T,>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success)
    throw new Error(data.message || `Request failed (HTTP ${response.status})`);
  return data as T;
};

interface PurchaseItem {
  id: number;
  product_id: number | null;
  product_variant_id?: number | null;
  product_name: string | null;
  product_sku: string | null;
  quantity: number;
  cost_price: number;
  subtotal: number;
}
interface Purchase {
  id: number;
  supplier_id: number | null;
  invoice_no: string;
  supplier_name: string | null;
  supplier_company: string | null;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: "Paid" | "Unpaid" | "Partial";
  payment_method: "Cash" | "Bank Transfer";
  items_count: number;
  items: PurchaseItem[];
}
interface Supplier {
  id: number;
  name: string;
  company_name: string | null;
}
interface Product {
  hasVariants?: boolean;
  variants?: { id: number; sku: string; stockQuantity: number; isActive: boolean; options: { label: string }[] }[];
  id: number;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
}
interface FormItem {
  product_id: string;
  quantity: string;
  cost_price: string;
}
interface PurchaseForm {
  supplier_id: string;
  invoice_no: string;
  purchase_date: string;
  payment_method: "Cash" | "Bank Transfer";
  paid_amount: string;
}
interface QuickProductForm {
  name: string;
  sku: string;
  price: string;
  category_name: string;
  subcategory: string;
  product_type: string; fit: string; occasion: string;
}

const freshForm = (): PurchaseForm => ({
  supplier_id: "",
  invoice_no: `INV-${new Date().toISOString().replace(/\D/g, "").slice(2, 14)}`,
  purchase_date: new Date().toISOString().slice(0, 10),
  payment_method: "Cash",
  paid_amount: "0",
});

const money = (value: number | string) =>
  `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] || char,
  );

function StatusBadge({ status }: { status: Purchase["payment_status"] }) {
  const styles = {
    Paid: "bg-emerald-100 text-emerald-700",
    Partial: "bg-slate-100 text-slate-700",
    Unpaid: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function ManagePurchases() {
  const { catalogTree, catalogError } = useProducts();
  const { showAlert } = useAdminAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState(
    searchParams.get("supplier") || "",
  );
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [form, setForm] = useState<PurchaseForm>(freshForm);
  const [formItems, setFormItems] = useState<FormItem[]>([
    { product_id: "", quantity: "1", cost_price: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(null);
  const [payment, setPayment] = useState({
    paid_amount: "",
    payment_method: "Cash" as Purchase["payment_method"],
  });
  const [deleteTarget, setDeleteTarget] = useState<Purchase | null>(null);
  const [newProductTarget, setNewProductTarget] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState<QuickProductForm>({
    name: "",
    sku: "",
    price: "",
    category_name: "",
    subcategory: "",
    product_type: "", fit: "", occasion: "",
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [purchaseData, supplierData, productData] = await Promise.all([
        request<{ success: true; purchases: Purchase[] }>(
          `${ADMIN_API}/purchases`,
        ),
        request<{ success: true; suppliers: Supplier[] }>(
          `${ADMIN_API}/suppliers`,
        ),
        request<{ success: true; products: Product[] }>(PRODUCTS_API),
      ]);
      setPurchases(purchaseData.purchases || []);
      setSuppliers(supplierData.suppliers || []);
      setProducts(productData.products || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load purchase data.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter, supplierFilter, fromDate, toDate]);

  const filtered = useMemo(
    () =>
      purchases.filter((purchase) => {
        const query = search.trim().toLowerCase();
        return (
          (!query ||
            [
              purchase.invoice_no,
              purchase.supplier_name,
              purchase.supplier_company,
              ...purchase.items.map((item) => item.product_name),
            ].some((value) => value?.toLowerCase().includes(query))) &&
          (!statusFilter || purchase.payment_status === statusFilter) &&
          (!methodFilter || purchase.payment_method === methodFilter) &&
          (!supplierFilter ||
            String(purchase.supplier_id) === supplierFilter) &&
          (!fromDate || purchase.purchase_date >= fromDate) &&
          (!toDate || purchase.purchase_date <= toDate)
        );
      }),
    [
      purchases,
      search,
      statusFilter,
      methodFilter,
      supplierFilter,
      fromDate,
      toDate,
    ],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedPurchases = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const totals = useMemo(
    () => ({
      value: purchases.reduce(
        (sum, item) => sum + Number(item.total_amount),
        0,
      ),
      paid: purchases.reduce((sum, item) => sum + Number(item.paid_amount), 0),
      due: purchases.reduce((sum, item) => sum + Number(item.due_amount), 0),
    }),
    [purchases],
  );
  const formTotal = formItems.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.cost_price) || 0),
    0,
  );
  const formPaid = Number(form.paid_amount) || 0;
  const formDue = Math.max(0, formTotal - formPaid);
  const formStatus: Purchase["payment_status"] =
    formPaid >= formTotal && formTotal > 0
      ? "Paid"
      : formPaid > 0
        ? "Partial"
        : "Unpaid";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setMethodFilter("");
    setSupplierFilter("");
    setFromDate("");
    setToDate("");
    setSearchParams({});
  };

  const openCreate = () => {
    setEditing(null);
    setForm(freshForm());
    setFormItems([{ product_id: "", quantity: "1", cost_price: "" }]);
    setFormOpen(true);
  };

  useEffect(() => {
    const requested = searchParams.get('product');
    if (loading || !requested) return;
    const product = products.find(p => String(p.id) === requested);
    if (!product) return;
    setEditing(null);
    setForm(freshForm());
    const variants = product.variants || [];
    const selection = product.hasVariants ? (variants.length === 1 ? `${product.id}:${variants[0].id}` : '') : String(product.id);
    setFormItems([{ product_id: selection, quantity: '1', cost_price: '' }]);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams); next.delete('product'); setSearchParams(next, { replace: true });
  }, [loading, products, searchParams, setSearchParams]);

  const openEdit = (purchase: Purchase) => {
    setEditing(purchase);
    setForm({
      supplier_id: purchase.supplier_id ? String(purchase.supplier_id) : "",
      invoice_no: purchase.invoice_no,
      purchase_date: purchase.purchase_date,
      payment_method: purchase.payment_method,
      paid_amount: String(purchase.paid_amount),
    });
    setFormItems(
      purchase.items.map((item) => ({
        product_id: item.product_variant_id ? `${item.product_id}:${item.product_variant_id}` : String(item.product_id || ""),
        quantity: String(item.quantity),
        cost_price: String(item.cost_price),
      })),
    );
    setViewPurchase(null);
    setFormOpen(true);
  };

  const updateItem = (index: number, field: keyof FormItem, value: string) =>
    setFormItems((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );

  const openQuickProduct = (index: number) => {
    setNewProductTarget(index);
    setNewProduct({
      name: "",
      sku: "",
      price: formItems[index]?.cost_price || "",
      category_name: "",
    subcategory: "",
    product_type: "", fit: "", occasion: "",
    });
  };

  const createQuickProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newProductTarget === null) return;
    if (catalogError || !(catalogTree as {name:string;children:{name:string}[]}[]).find(p=>p.name===newProduct.category_name)?.children.some(s=>s.name===newProduct.subcategory)) {
      showAlert({ type: 'error', title: 'Category required', message: 'Select a navbar department and its subcategory.' });
      return;
    }

    const duplicate = products.find(p => p.name.trim().toLowerCase() === newProduct.name.trim().toLowerCase() || (newProduct.sku.trim() && p.sku?.toLowerCase() === newProduct.sku.trim().toLowerCase()));
    if (duplicate) {
      showAlert({ type: 'warning', title: 'Product already exists', message: `Select ${duplicate.name} (${duplicate.sku || 'No SKU'}) in the invoice dropdown to add stock to the same product.` });
      return;
    }
    setCreatingProduct(true);
    try {
      const result = await request<{ success: true; productId: number }>(
        PRODUCTS_API,
        {
          method: "POST",
          body: JSON.stringify({
            name: newProduct.name.trim(),
            sku: newProduct.sku.trim() || undefined,
            price: Number(newProduct.price),
            category_name: newProduct.category_name,
            subcategory: newProduct.subcategory,
            product_type: newProduct.product_type, fit: newProduct.fit, occasion: newProduct.occasion,
            stock: 0,
            status: "Out of Stock",
          }),
        },
      );
      const created: Product = {
        id: result.productId,
        name: newProduct.name.trim(),
        sku: newProduct.sku.trim() || null,
        price: Number(newProduct.price),
        stock: 0,
      };
      setProducts((current) => [created, ...current]);
      updateItem(newProductTarget, "product_id", String(created.id));
      setNewProductTarget(null);
      showAlert({
        type: "success",
        title: "Product created",
        message: `${created.name} was created and selected on this purchase line.`,
      });
    } catch (createError) {
      showAlert({
        type: "error",
        title: "Product not created",
        message:
          createError instanceof Error
            ? createError.message
            : "Request failed.",
      });
    } finally {
      setCreatingProduct(false);
    }
  };

  const submitPurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (formPaid > formTotal) {
      showAlert({
        type: "warning",
        title: "Payment exceeds total",
        message: "Paid amount cannot be greater than the invoice total.",
      });
      return;
    }
    const ids = formItems.map((item) => item.product_id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      showAlert({
        type: "warning",
        title: "Duplicate product",
        message: "Use one line per product or variant and adjust its quantity.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        ...form,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        paid_amount: formPaid,
        items: formItems.map((item) => ({
          product_id: Number(item.product_id.split(":")[0]),
          product_variant_id: item.product_id.includes(":") ? Number(item.product_id.split(":")[1]) : null,
          quantity: Number(item.quantity),
          cost_price: Number(item.cost_price),
        })),
      };
      await request(
        `${ADMIN_API}/purchases${editing ? `/${editing.id}` : ""}`,
        { method: editing ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      showAlert({
        type: "success",
        title: editing ? "Invoice updated" : "Stock received",
        message: editing
          ? "Invoice changes and inventory adjustments were saved."
          : "Purchase invoice was saved and stock was added.",
      });
      setFormOpen(false);
      setEditing(null);
      window.dispatchEvent(new Event('products-updated'));
      await loadData();
    } catch (submitError) {
      showAlert({
        type: "error",
        title: "Could not save invoice",
        message:
          submitError instanceof Error
            ? submitError.message
            : "Request failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPayment = (purchase: Purchase) => {
    setPaymentPurchase(purchase);
    setPayment({
      paid_amount: String(purchase.paid_amount),
      payment_method: purchase.payment_method,
    });
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentPurchase) return;
    setSubmitting(true);
    try {
      await request(`${ADMIN_API}/purchases/${paymentPurchase.id}/payment`, {
        method: "PATCH",
        body: JSON.stringify({
          paid_amount: Number(payment.paid_amount),
          payment_method: payment.payment_method,
        }),
      });
      showAlert({
        type: "success",
        title: "Payment updated",
        message: `Payment balance for ${paymentPurchase.invoice_no} was updated.`,
      });
      setPaymentPurchase(null);
      await loadData();
    } catch (paymentError) {
      showAlert({
        type: "error",
        title: "Payment not saved",
        message:
          paymentError instanceof Error
            ? paymentError.message
            : "Request failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deletePurchase = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const result = await request<{ success: true; message: string }>(
        `${ADMIN_API}/purchases/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      showAlert({
        type: "success",
        title: "Invoice deleted",
        message: result.message,
      });
      setDeleteTarget(null);
      setViewPurchase(null);
      await loadData();
    } catch (deleteError) {
      showAlert({
        type: "error",
        title: "Invoice not deleted",
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "Request failed.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      [
        "Invoice",
        "Supplier",
        "Date",
        "Items",
        "Total",
        "Paid",
        "Due",
        "Status",
        "Method",
      ],
      ...filtered.map((p) => [
        p.invoice_no,
        p.supplier_name || "",
        p.purchase_date,
        String(p.items_count),
        String(p.total_amount),
        String(p.paid_amount),
        String(p.due_amount),
        p.payment_status,
        p.payment_method,
      ]),
    ];
    const sanitizeCell = (value: unknown) => {
      let str = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csv = rows
      .map((row) => row.map(sanitizeCell).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `purchases-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const printInvoice = (purchase: Purchase) => {
    const printable = window.open("", "_blank", "width=850,height=800");
    if (!printable) return;
    const rows = purchase.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.product_name || "Deleted product")}</td><td>${escapeHtml(item.product_sku || "")}</td><td>${item.quantity}</td><td>${money(item.cost_price)}</td><td>${money(item.subtotal)}</td></tr>`,
      )
      .join("");
    printable.document.write(
      `<html><head><title>${escapeHtml(purchase.invoice_no)}</title><style>body{font-family:Arial;padding:40px;color:#172033}h1{margin:0}small{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:28px}th,td{padding:11px;border-bottom:1px solid #ddd;text-align:left}.summary{margin-top:24px;text-align:right;line-height:1.8}</style></head><body><h1>ShopHub Purchase Invoice</h1><small>${escapeHtml(purchase.invoice_no)} · ${escapeHtml(purchase.purchase_date)} · ${escapeHtml(purchase.supplier_name || "No supplier")}</small><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th><th>Unit cost</th><th>Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="summary"><b>Total: ${money(purchase.total_amount)}</b><br>Paid: ${money(purchase.paid_amount)}<br>Due: ${money(purchase.due_amount)}</div><script>window.print()</script></body></html>`,
    );
    printable.document.close();
  };

  const summaryCards: Array<{
    label: string;
    value: string | number;
    icon: ElementType;
    style: string;
  }> = [
    {
      label: "Invoices",
      value: purchases.length,
      icon: FiPackage,
      style: "bg-blue-50 text-blue-600",
    },
    {
      label: "Stock value",
      value: money(totals.value),
      icon: FiTrendingUp,
      style: "bg-amber-50 text-amber-500",
    },
    {
      label: "Paid",
      value: money(totals.paid),
      icon: FiDollarSign,
      style: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Outstanding",
      value: money(totals.due),
      icon: FiAlertCircle,
      style: "bg-red-50 text-red-700",
    },
  ];

  if (loading)
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm font-semibold text-slate-500">
        <FiRefreshCw className="mr-2 animate-spin" /> Loading purchase
        records...
      </div>
    );
  if (error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
        <FiAlertCircle className="mx-auto text-red-500" size={38} />
        <h2 className="mt-3 text-xl font-bold text-red-900">
          Purchases could not be loaded
        </h2>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <button
          onClick={loadData}
          className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white"
        >
          Try again
        </button>
      </div>
    );

  return (
    <div className={formOpen ? "w-full" : "space-y-6 pb-10"}>
      {!formOpen && <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Inventory control
          </p>
          <h1 className="mt-1 text-3xl font-black text-slate-900">
            Purchases & Stock-In
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Receive stock, manage supplier invoices, and track outstanding
            payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/suppliers"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"
          >
            <FiTruck /> Suppliers
          </Link>
          <button
            onClick={exportCsv}
            disabled={!filtered.length}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            <FiDownload /> Export
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white"
          >
            <FiPlus /> New Purchase
          </button>
        </div>
      </div>

      {searchParams.get("payments") === "1" && supplierFilter && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Payments · {suppliers.find((supplier) => String(supplier.id) === supplierFilter)?.name || "Supplier"}</h2>
          <p className="mt-1 text-sm text-slate-500">Select an invoice to update its total paid amount, including earlier payments.</p>
          {loading ? <p className="mt-4 text-sm text-slate-500">Loading invoices...</p> : error ? <p className="mt-4 text-sm text-red-600">{error}</p> : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {purchases.filter((purchase) => String(purchase.supplier_id) === supplierFilter).map((purchase) => (
                <button key={purchase.id} onClick={() => openPayment(purchase)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-400 hover:bg-emerald-50">
                  <span><span className="block font-semibold text-slate-900">{purchase.invoice_no}</span><span className="text-xs text-slate-500">Paid {money(purchase.paid_amount)} · Due {money(purchase.due_amount)}</span></span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><FiCreditCard /> Update payment</span>
                </button>
              ))}
              {!purchases.some((purchase) => String(purchase.supplier_id) === supplierFilter) && <p className="text-sm leading-6 text-slate-500 sm:col-span-2">No invoices are linked to this supplier yet. Use New Purchase and select this supplier to start tracking payments.</p>}
            </div>
          )}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, style }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-xl p-2.5 ${style}`}>
              <Icon size={20} />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(130px,auto))]">
          <label className="relative">
            <FiSearch className="absolute left-3 top-3 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice, supplier, or product..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </label>
          <select
            value={supplierFilter}
            onChange={(e) => {
              setSupplierFilter(e.target.value);
              setSearchParams(
                e.target.value ? { supplier: e.target.value } : {},
              );
            }}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All statuses</option>
            <option>Paid</option>
            <option>Partial</option>
            <option>Unpaid</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All methods</option>
            <option>Cash</option>
            <option>Bank Transfer</option>
          </select>
          <input
            type="date"
            title="From date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            type="date"
            title="To date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        {(search ||
          statusFilter ||
          methodFilter ||
          supplierFilter ||
          fromDate ||
          toDate) && (
          <button
            onClick={clearFilters}
            className="mt-3 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Invoice",
                  "Supplier",
                  "Date",
                  "Lines",
                  "Total",
                  "Paid",
                  "Due",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 font-bold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedPurchases.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-bold text-slate-900">
                    {p.invoice_no}
                    <span className="block text-xs font-normal text-slate-400">
                      {p.payment_method}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {p.supplier_name || (
                      <span className="italic text-slate-400">No supplier</span>
                    )}
                    <span className="block text-xs text-slate-400">
                      {p.supplier_company}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {new Date(
                      `${p.purchase_date}T00:00:00`,
                    ).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-4">{p.items_count}</td>
                  <td className="px-4 py-4 font-bold">
                    {money(p.total_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-emerald-700">
                    {money(p.paid_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-red-600">
                    {money(p.due_amount)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={p.payment_status} />
                  </td>
                  <td className="px-4 py-4">
                    <PurchaseActions
                      purchase={p}
                      onView={() => setViewPurchase(p)}
                      onEdit={() => openEdit(p)}
                      onPayment={() => openPayment(p)}
                      onDelete={() => setDeleteTarget(p)}
                    />
                  </td>
                </tr>
              ))}
              {!pagedPurchases.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-14 text-center text-slate-400"
                  >
                    <FiPackage className="mx-auto mb-2" size={30} />
                    No purchase invoices match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm">
            <span className="text-slate-500">
              Showing {(page - 1) * PAGE_SIZE + 1}-
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((value) => value + 1)}
                className="rounded-lg border px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      </div>}

      {formOpen && (
        <div className="w-full">
          <form
            onSubmit={submitPurchase}
            className="flex min-h-[calc(100dvh-8rem)] w-full flex-col"
          >
            <div className="flex flex-col items-start gap-5 border-b border-slate-200 pb-6">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormOpen(false)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950 disabled:opacity-50"
              >
                <FiArrowLeft /> Back to purchases
              </button>
              <div>
                <h1 className="text-3xl font-black text-slate-900">
                  {editing ? `Edit ${editing.invoice_no}` : "Receive new stock"}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Inventory changes are applied when this invoice is saved.
                </p>
              </div>
            </div>
            <div className="flex-1 py-8">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-xs font-bold text-slate-600">
                  Supplier
                  <select
                    value={form.supplier_id}
                    onChange={(e) =>
                      setForm({ ...form, supplier_id: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="">No supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Invoice number
                  <input
                    required
                    value={form.invoice_no}
                    onChange={(e) =>
                      setForm({ ...form, invoice_no: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Purchase date
                  <input
                    required
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) =>
                      setForm({ ...form, purchase_date: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  />
                </label>
                <label className="text-xs font-bold text-slate-600">
                  Payment method
                  <select
                    value={form.payment_method}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        payment_method: e.target
                          .value as Purchase["payment_method"],
                      })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal"
                  >
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                  </select>
                </label>
              </div>
              <div className="mt-7 flex items-center justify-between">
                {/* Left Section: Heading, Status Badge & Subtext */}
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900">
                    Products received
                  </h3>
                  <StatusBadge status={formStatus} />
                  <span className="text-xs text-gray-500">
                    Invoice is currently {formStatus}
                  </span>
                </div>

                {/* Right Section: Add Line Button */}
                <button
                  type="button"
                  onClick={() =>
                    setFormItems((items) => [
                      ...items,
                      { product_id: "", quantity: "1", cost_price: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1 text-sm font-bold text-slate-700 hover:text-slate-800 transition-colors"
                >
                  <FiPlus /> Add line
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {formItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid items-end gap-3 bg-slate-50 p-3 sm:grid-cols-[1fr_90px_110px_120px_40px]"
                  >
                    {/* Column 1: Product Select */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-500">
                          Product
                        </label>
                        <button
                          type="button"
                          onClick={() => openQuickProduct(index)}
                          className="text-xs font-semibold text-slate-600 hover:underline shrink-0"
                        >
                          + Add
                        </button>
                      </div>
                      <select
                        required
                        value={item.product_id}
                        onChange={(e) =>
                          updateItem(index, "product_id", e.target.value)
                        }
                        className="w-full truncate rounded-lg border bg-white px-3 py-2 text-sm font-normal focus:border-slate-500 focus:outline-none"
                      >
                        <option value="">Select existing product / variant</option>
                        {products.map((p) => p.hasVariants ? (
                          <optgroup key={p.id} label={p.name}>
                            {(p.variants || []).map(variant => <option key={variant.id} value={`${p.id}:${variant.id}`}>
                              {p.name} / {variant.options.map(option => option.label).join(' / ') || 'Default'} / {variant.sku} / Stock {variant.stockQuantity}{!variant.isActive ? ' (Disabled)' : ''}
                            </option>)}
                          </optgroup>
                        ) : (
                          <option key={p.id} value={p.id}>{p.name} / {p.sku || 'No SKU'} / Stock {p.stock}</option>
                        ))}
                      </select>
                    </div>

                    {/* Column 2: Quantity */}
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-bold text-slate-500">
                        Quantity
                      </label>
                      <input
                        required
                        min="1"
                        step="1"
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", e.target.value)
                        }
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal focus:border-slate-500 focus:outline-none"
                      />
                    </div>

                    {/* Column 3: Unit Cost */}
                    <div className="flex flex-col">
                      <label className="mb-1 text-xs font-bold text-slate-500">
                        Unit cost
                      </label>
                      <input
                        required
                        min="0"
                        step="0.01"
                        type="number"
                        value={item.cost_price}
                        onChange={(e) =>
                          updateItem(index, "cost_price", e.target.value)
                        }
                        className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal focus:border-slate-500 focus:outline-none"
                      />
                    </div>

                    {/* Column 4: Total Amount */}
                    <div className="flex h-10 items-center justify-end text-sm font-bold text-slate-900 pr-2">
                      {money(
                        (Number(item.quantity) || 0) *
                          (Number(item.cost_price) || 0)
                      )}
                    </div>

                    {/* Column 5: Delete Button */}
                    <button
                      type="button"
                      disabled={formItems.length === 1}
                      onClick={() =>
                        setFormItems((items) =>
                          items.filter((_, itemIndex) => itemIndex !== index)
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 transition-colors hover:bg-red-600 hover:text-white disabled:opacity-30"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>


              <label className="mt-5 block max-w-xs text-xs font-bold text-slate-600">
                Payment
                <input
                  type="number"
                  min="0"
                  max={formTotal}
                  step="0.01"
                  value={form.paid_amount}
                  onChange={(e) =>
                    setForm({ ...form, paid_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm font-normal right-0 "
                />
              </label>
            </div>
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-5 border-t border-slate-200 bg-slate-100 px-4 py-5 sm:px-6">
              <div className="grid w-full grid-cols-3 gap-3 sm:w-auto sm:flex-1 sm:gap-5">
                <div>
                  <p className="text-xs text-slate-900">Total</p>
                  <b className="text-slate-900">{money(formTotal)}</b>
                </div>
                <div>
                  <p className="text-xs text-slate-900">Paid</p>
                  <b className="text-emerald-400">{money(formPaid)}</b>
                </div>
                <div>
                  <p className="text-xs text-slate-900">Due</p>
                  <b className="text-red-400">{money(formDue)}</b>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : editing
                    ? "Save changes"
                    : "Receive stock"}
              </button>
            </div>
          </form>
        </div>
      )}

      {newProductTarget !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={createQuickProduct}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">
                  Add a new product
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Opening stock will be received through this purchase invoice.
                </p>
              </div>
              <button
                type="button"
                disabled={creatingProduct}
                onClick={() => setNewProductTarget(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <FiX />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700 sm:col-span-2">
                Product name
                <input
                  autoFocus
                  required
                  value={newProduct.name}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, name: e.target.value })
                  }
                  placeholder="e.g. Premium Cotton Shirt"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-slate-300"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                SKU{" "}
                <span className="font-normal text-slate-400">(optional)</span>
                <input
                  value={newProduct.sku}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, sku: e.target.value })
                  }
                  placeholder="Generated if empty"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-slate-300"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                Selling price
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={newProduct.price}
                  onChange={(e) =>
                    setNewProduct({ ...newProduct, price: e.target.value })
                  }
                  placeholder="Retail price"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-slate-300"
                />
              </label>
              <div className="sm:col-span-2"><ProductCategoryFields category={newProduct.category_name} subCategory={newProduct.subcategory} productType={newProduct.product_type} fit={newProduct.fit} occasion={newProduct.occasion} onChange={(category_name, subcategory, product_type, fit, occasion) => setNewProduct(prev => ({ ...prev, category_name, subcategory, product_type, fit, occasion }))} /></div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={creatingProduct}
                onClick={() => setNewProductTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={creatingProduct}
                className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {creatingProduct ? "Creating..." : "Create and select"}
              </button>
            </div>
          </form>
        </div>
      )}

      {viewPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex justify-between border-b p-6">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">
                  Purchase invoice
                </p>
                <h2 className="text-2xl font-black">
                  {viewPurchase.invoice_no}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {viewPurchase.supplier_name || "No supplier"} ·{" "}
                  {viewPurchase.purchase_date}
                </p>
              </div>
              <button onClick={() => setViewPurchase(null)}>
                <FiX />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-slate-400">
                    <th className="py-3">Product</th>
                    <th>Qty</th>
                    <th>Unit cost</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {viewPurchase.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-3 font-bold">
                        {item.product_name || "Deleted product"}
                        <span className="block text-xs font-normal text-slate-400">
                          {item.product_sku}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{money(item.cost_price)}</td>
                      <td className="text-right font-bold">
                        {money(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-5 sm:grid-cols-3">
                <div>
                  Total
                  <br />
                  <b>{money(viewPurchase.total_amount)}</b>
                </div>
                <div className="text-emerald-700">
                  Paid
                  <br />
                  <b>{money(viewPurchase.paid_amount)}</b>
                </div>
                <div className="text-red-600">
                  Due
                  <br />
                  <b>{money(viewPurchase.due_amount)}</b>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t p-4">
              <button
                onClick={() => printInvoice(viewPurchase)}
                className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
              >
                <FiPrinter /> Print
              </button>
              <button
                onClick={() => {
                  openPayment(viewPurchase);
                  setViewPurchase(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800"
              >
                <FiCreditCard /> Payment
              </button>
              <button
                onClick={() => openEdit(viewPurchase)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900"
              >
                <FiEdit2 /> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {paymentPurchase && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={submitPayment}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <h2 className="text-xl font-black">Update payment</h2>
                <p className="text-sm text-slate-800">
                  {paymentPurchase.invoice_no} · Total{" "}
                  {money(paymentPurchase.total_amount)}
                </p>
              </div>
              <button type="button" onClick={() => setPaymentPurchase(null)}>
                <FiX />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-bold">
                Total paid to date
                <input
                  required
                  min="0"
                  max={Number(paymentPurchase.total_amount)}
                  step="0.01"
                  type="number"
                  value={payment.paid_amount}
                  onChange={(e) =>
                    setPayment({ ...payment, paid_amount: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"
                />
              </label>
              <label className="block text-sm font-bold">
                Payment method
                <select
                  value={payment.payment_method}
                  onChange={(e) =>
                    setPayment({
                      ...payment,
                      payment_method: e.target
                        .value as Purchase["payment_method"],
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 font-normal"
                >
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPaymentPurchase(null)}
                className="rounded-xl border px-4 py-2.5"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                className="rounded-xl bg-slate-950 px-5 py-2.5 font-bold text-white disabled:opacity-50"
              >
                Save payment
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <FiTrash2 size={24} />
            </div>
            <h2 className="mt-4 text-xl font-black">
              Delete {deleteTarget.invoice_no}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              The invoice lines will be removed and received stock will be
              reversed. Deletion is blocked if that stock has already been
              consumed.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border px-5 py-2.5"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={deletePurchase}
                className="rounded-xl bg-red-600 px-5 py-2.5 font-bold text-white disabled:opacity-50"
              >
                Delete & reverse stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
