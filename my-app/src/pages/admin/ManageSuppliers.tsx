import AdminFormPage from "../../component/AdminFormPage";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  FiAlertCircle,
  FiChevronDown,
  FiDollarSign,
  FiDownload,
  FiEdit2,
  FiEye,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiTruck,
} from "react-icons/fi";
import { useAdminAlert } from "../../context/AdminAlertContext";

type Supplier = {
  id: number;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  total_purchases: number | string;
  total_paid: number | string;
  total_due: number | string;
  total_unpaid: number | string;
  purchase_count: number | string;
  last_purchase_date: string | null;
  created_at: string;
};

type SupplierForm = Pick<
  Supplier,
  "name" | "company_name" | "phone" | "email" | "address"
>;

const emptyForm: SupplierForm = {
  name: "",
  company_name: "",
  phone: "",
  email: "",
  address: "",
};

const getToken = () => {
  try {
    return (
      JSON.parse(localStorage.getItem("shophub_user") || "null")?.token || ""
    );
  } catch {
    return "";
  }
};

function SupplierActions({ supplier, onEdit, onDelete }: {
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const id = `supplier-actions-${supplier.id}`;

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
        aria-label={`Actions for ${supplier.name}`}
        aria-expanded={Boolean(position)}
        aria-controls={position ? id : undefined}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
        onClick={() => {
          if (position) return setPosition(null);
          const rect = trigger.current!.getBoundingClientRect();
          setPosition({
            left: Math.max(8, Math.min(rect.right - 192, window.innerWidth - 200)),
            top: rect.bottom + 156 > window.innerHeight ? Math.max(8, rect.top - 156) : rect.bottom + 6,
          });
        }}
      >
        Actions <FiChevronDown aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={dropdown}
          id={id}
          aria-label={`Supplier actions for ${supplier.name}`}
          className="fixed z-[100] w-48 max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          style={position}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setPosition(null);
          }}
        >
          <Link to={`/admin/purchases?supplier=${supplier.id}`} onClick={() => setPosition(null)} className={`${itemClass} text-blue-700 hover:bg-blue-50`}>
            <FiEye aria-hidden="true" /> View purchases
          </Link>
          <button type="button" onClick={() => { setPosition(null); onEdit(); }} className={`${itemClass} text-emerald-700 hover:bg-emerald-50`}>
            <FiEdit2 aria-hidden="true" /> Edit supplier
          </button>
          <button type="button" onClick={() => { setPosition(null); onDelete(); }} className={`${itemClass} text-red-600 hover:bg-red-50`}>
            <FiTrash2 aria-hidden="true" /> Delete supplier
          </button>
        </div>, document.body,
      )}
    </>
  );
}

export default function ManageSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { showAlert } = useAdminAlert();

  const request = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(`${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
        ...(options.headers || {}),
      },
    });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : {
          success: false,
          message: `Supplier API returned ${response.status} ${response.statusText}. Restart the backend server.`,
        };
    if (!response.ok || !data.success)
      throw new Error(data.message || "Request failed");
    return data;
  };

  const loadSuppliers = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request("/api/admin/suppliers");
      setSuppliers(data.suppliers || []);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load suppliers",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((supplier) =>
        [
          supplier.name,
          supplier.company_name,
          supplier.email,
          supplier.phone,
        ].some((value) =>
          value?.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      ),
    [suppliers, searchTerm],
  );

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name || "",
      company_name: supplier.company_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await request(
        editingId
          ? `/api/admin/suppliers/${editingId}`
          : "/api/admin/suppliers",
        {
          method: editingId ? "PUT" : "POST",
          body: JSON.stringify(form),
        },
      );
      setShowForm(false);
      await loadSuppliers();
      showAlert(
        editingId
          ? "Supplier updated successfully."
          : "Supplier added successfully.",
        "success",
      );
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Could not save supplier",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await request(`/api/admin/suppliers/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      await loadSuppliers();
      showAlert(
        "Supplier deleted. Existing purchases remain in the ledger.",
        "success",
      );
    } catch (error) {
      showAlert(
        error instanceof Error ? error.message : "Could not delete supplier",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const money = (value: number | string) =>
    `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

  const totals = useMemo(
    () =>
      suppliers.reduce(
        (result, supplier) => ({
          purchases: result.purchases + Number(supplier.total_purchases || 0),
          paid: result.paid + Number(supplier.total_paid || 0),
          due:
            result.due +
            Number(supplier.total_unpaid ?? supplier.total_due ?? 0),
          invoices: result.invoices + Number(supplier.purchase_count || 0),
        }),
        { purchases: 0, paid: 0, due: 0, invoices: 0 },
      ),
    [suppliers],
  );

  const exportCsv = () => {
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = filteredSuppliers.map((supplier) =>
      [
        supplier.name,
        supplier.company_name,
        supplier.phone,
        supplier.email,
        supplier.purchase_count,
        supplier.total_purchases,
        supplier.total_paid,
        supplier.total_unpaid ?? supplier.total_due,
        supplier.last_purchase_date,
      ]
        .map(quote)
        .join(","),
    );
    const csv = [
      "Name,Company,Phone,Email,Invoices,Total purchases,Paid,Outstanding,Last purchase",
      ...rows,
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `suppliers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (showForm)
    return (
      <AdminFormPage
        backLabel="Back to suppliers"
        onBack={() => setShowForm(false)}
      >
        <form onSubmit={handleSubmit} className="w-full bg-white p-4 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-bold">
              {editingId ? "Edit Supplier" : "Add Supplier"}
            </h1>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["name", "Supplier Name", true],
                ["company_name", "Company Name", false],
                ["phone", "Phone", false],
                ["email", "Email", false],
              ] as const
            ).map(([key, label, required]) => (
              <label key={key} className="text-sm font-medium text-slate-700">
                {label}
                <input
                  type={
                    key === "email" ? "email" : key === "phone" ? "tel" : "text"
                  }
                  required={required}
                  value={form[key] ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-400"
                />
              </label>
            ))}
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Address
              <textarea
                rows={3}
                value={form.address ?? ""}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-400"
              />
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Update Supplier"
                  : "Save Supplier"}
            </button>
          </div>
        </form>
      </AdminFormPage>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            Supplier Management
          </h1>
          <p className="mt-1 text-slate-600">
            Manage your product suppliers and balances.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            disabled={!filteredSuppliers.length}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-100 hover:text-green-600 disabled:opacity-40"
          >
            <FiDownload /> Export CSV
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white hover:bg-blue-300 hover:text-blue-600"
          >
            <FiPlus size={18} /> Add Supplier
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Purchase value",
            value: money(totals.purchases),
            icon: <FiTrendingUp />,
            color: "bg-slate-50 text-slate-700",
          },
          {
            label: "Paid amount",
            value: money(totals.paid),
            icon: <FiDollarSign />,
            color: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Unpaid amount",
            value: money(totals.due),
            icon: <FiAlertCircle />,
            color: "bg-red-50 text-red-700",
          },
          {
            label: "Suppliers / invoices",
            value: `${suppliers.length} / ${totals.invoices}`,
            icon: <FiTruck />,
            color: "bg-slate-50 text-slate-700",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className={`inline-flex rounded-xl p-2.5 ${card.color}`}>
              {card.icon}
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-black text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="relative mb-6 max-w-md">
          <FiSearch
            className="absolute left-3 top-3 text-slate-400"
            size={18}
          />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search suppliers..."
            className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        {loading ? (
          <p className="flex items-center justify-center py-12 text-center text-slate-500">
            <FiRefreshCw className="mr-2 animate-spin" /> Loading suppliers...
          </p>
        ) : error ? (
          <div className="py-12 text-center">
            <FiAlertCircle className="mx-auto text-red-500" size={32} />
            <p className="mt-2 font-semibold text-red-700">{error}</p>
            <button
              onClick={loadSuppliers}
              className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[1050px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  {[
                    "Supplier / Company",
                    "Total Purchases",
                    "Paid Amount",
                    "Unpaid Amount",
                    "Invoices",
                    "Contact details",
                    "Last Purchase",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={
                        "whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-600 " +
                        ([
                          "Total Purchases",
                          "Paid Amount",
                          "Unpaid Amount",
                        ].includes(heading)
                          ? "text-right"
                          : ["Invoices", "Actions"].includes(heading)
                            ? "text-center"
                            : "text-left")
                      }
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr
                    key={supplier.id}
                    className="align-middle hover:bg-slate-50/60"
                  >
                    <td className="min-w-[150px] max-w-[200px] break-words px-3 py-4 font-semibold text-slate-900">
                      {supplier.name}
                      <span className="mt-1 block text-xs font-normal text-slate-500">
                        {supplier.company_name || "?"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-slate-900">
                      {money(supplier.total_purchases)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-emerald-700">
                      {money(supplier.total_paid)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums text-slate-700">
                      {money(supplier.total_unpaid ?? supplier.total_due)}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold">
                        {Number(supplier.purchase_count || 0)}
                      </span>
                    </td>
                    <td className="min-w-[180px] max-w-[230px] break-words px-3 py-4 text-xs leading-5 text-slate-600">
                      <span className="block">{supplier.phone || "?"}</span>
                      <span className="block">{supplier.email || "?"}</span>
                      <span className="block text-slate-400">
                        {supplier.address || "?"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-500">
                      {supplier.last_purchase_date
                        ? new Date(
                            supplier.last_purchase_date,
                          ).toLocaleDateString("en-PK")
                        : "Never"}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <SupplierActions
                        supplier={supplier}
                        onEdit={() => openEdit(supplier)}
                        onDelete={() => setDeleteTarget(supplier)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredSuppliers.length && (
              <p className="py-12 text-center text-slate-400">
                <FiTruck className="mx-auto mb-2" size={32} />
                No suppliers found.
              </p>
            )}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            !deleting &&
            setDeleteTarget(null)
          }
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
              <FiTrash2 size={21} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Delete {deleteTarget.name}?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The supplier profile will be removed. Existing purchase invoices
              will stay in the ledger for accurate financial and stock history.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete supplier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
