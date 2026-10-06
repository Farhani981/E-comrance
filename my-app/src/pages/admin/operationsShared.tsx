import type { ReactNode } from "react";
import { FiRefreshCw, FiSearch } from "react-icons/fi";

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-600";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50";
export const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50";
export const money = (value: number | string) =>
  `Rs. ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function operationsRequest(
  path: string,
  options: RequestInit = {},
) {
  let token = "";
  try {
    token =
      JSON.parse(localStorage.getItem("shophub_user") || "{}").token || "";
  } catch {
    /* Missing session is handled by the API. */
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({
      message: "The API is unavailable. Check that the backend is running.",
    }));
  if (!response.ok || !data.success)
    throw new Error(data.message || "Request failed.");
  return data;
}

export function OperationsHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Core operations & inventory
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  refresh,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  refresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex gap-3">
      <label className="relative flex-1">
        <FiSearch className="absolute left-3 top-3.5 text-slate-400" />
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pl-10`}
        />
      </label>
      <button
        type="button"
        className={secondaryClass}
        onClick={refresh}
        disabled={loading}
      >
        <FiRefreshCw /> Refresh
      </button>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-600">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

export function LoadNotice({
  loading,
  error,
}: {
  loading: boolean;
  error: string;
}) {
  return error ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {error}
    </p>
  ) : loading ? (
    <p role="status" className="py-8 text-center text-sm text-slate-500">
      Loading...
    </p>
  ) : null;
}
