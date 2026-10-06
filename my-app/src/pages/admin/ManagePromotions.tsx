
import { useCallback, useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
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
type Promotion = {
  id?: number;
  name: string;
  code: string;
  discount_type: string;
  value: string;
  min_subtotal: string;
  product_id: string;
  starts_at: string;
  ends_at: string;
  active: boolean;
};
const fresh = (): Promotion => ({
  name: "",
  code: "",
  discount_type: "Percentage",
  value: "",
  min_subtotal: "0",
  product_id: "",
  starts_at: "",
  ends_at: "",
  active: true,
});
export default function ManagePromotions() {
  const [data, setData] = useState<{
    promotions: Promotion[];
    products: { id: number; name: string }[];
  }>({ promotions: [], products: [] });
  const [form, setForm] = useState<Promotion | null>(null),
    [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await request("/operations/promotions"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(promotion: Promotion, method: string) {
    setSaving(true);
    setError("");
    try {
      await request(
        `/operations/promotions${promotion.id ? `/${promotion.id}` : ""}`,
        {
          method,
          body: method === "DELETE" ? undefined : JSON.stringify(promotion),
        },
      );
      setForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }
  const filtered = data.promotions.filter((p) =>
    `${p.name} ${p.code || ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const update = (key: keyof Promotion, value: string | boolean) =>
    setForm((current) => (current ? { ...current, [key]: value } : null));
  return (
    <div className="space-y-6 pb-8">
      <OperationsHeader
        title="Coupons & Discounts"
        description="Create coupon codes and scheduled automatic discounts for checkout."
      >
        <button className={buttonClass} onClick={() => setForm(fresh())}>
          <FiPlus /> New promotion
        </button>
      </OperationsHeader>
      <LoadNotice loading={loading} error={error} />
      {form ? (
        <form
          className="space-y-6 border-y border-slate-200 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(form, form.id ? "PUT" : "POST");
          }}
        >
          <h2 className="text-xl font-bold">
            {form.id ? "Edit promotion" : "New promotion"}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Promotion name">
              <input
                required
                maxLength={120}
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Coupon code (leave blank for automatic discount)">
              <input
                maxLength={50}
                pattern="[A-Za-z0-9_-]+"
                className={inputClass}
                value={form.code || ""}
                onChange={(e) => update("code", e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER10"
              />
            </Field>
            <Field label="Discount type">
              <select
                className={inputClass}
                value={form.discount_type}
                onChange={(e) => update("discount_type", e.target.value)}
              >
                <option>Percentage</option>
                <option>Fixed</option>
              </select>
            </Field>
            <Field
              label={
                form.discount_type === "Percentage"
                  ? "Discount (%)"
                  : "Discount (Rs.)"
              }
            >
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                max={form.discount_type === "Percentage" ? 100 : 100000000}
                className={inputClass}
                value={form.value}
                onChange={(e) => update("value", e.target.value)}
              />
            </Field>
            <Field label="Minimum cart subtotal (Rs.)">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={form.min_subtotal}
                onChange={(e) => update("min_subtotal", e.target.value)}
              />
            </Field>
            <Field label="Apply to">
              <select
                className={inputClass}
                value={form.product_id || ""}
                onChange={(e) => update("product_id", e.target.value)}
              >
                <option value="">All products</option>
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Starts at (optional, server local time)">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.starts_at || ""}
                onChange={(e) => update("starts_at", e.target.value)}
              />
            </Field>
            <Field label="Ends at (optional, server local time)">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.ends_at || ""}
                onChange={(e) => update("ends_at", e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={Boolean(form.active)}
              onChange={(e) => update("active", e.target.checked)}
            />{" "}
            Active
          </label>
          <p className="text-sm text-slate-500">
            Checkout applies the single best eligible offer. Discounts never
            exceed the eligible products' subtotal.
          </p>
          <button className={buttonClass} disabled={saving}>
            {saving ? "Saving..." : "Save promotion"}
          </button>{" "}
          <button
            type="button"
            className={secondaryClass}
            disabled={saving}
            onClick={() => setForm(null)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search promotion or coupon code"
            refresh={load}
            loading={loading}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex justify-between gap-3">
                  <h2 className="font-bold">{p.name}</h2>
                  <Status>
                    {!p.active
                      ? "Inactive"
                      : p.ends_at && new Date(p.ends_at) < new Date()
                        ? "Expired"
                        : p.starts_at && new Date(p.starts_at) > new Date()
                          ? "Scheduled"
                          : "Active"}
                  </Status>
                </div>
                <p className="text-2xl font-black">
                  {p.discount_type === "Percentage"
                    ? `${p.value}%`
                    : money(p.value)}{" "}
                  off
                </p>
                <p className="text-sm text-slate-500">
                  {p.code ? `Code: ${p.code}` : "Automatic discount"} · Minimum{" "}
                  {money(p.min_subtotal)}
                </p>
                <p className="text-sm text-slate-500">
                  {p.product_id
                    ? data.products.find(
                        (product) => product.id === Number(p.product_id),
                      )?.name
                    : "All products"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={secondaryClass}
                    disabled={saving}
                    onClick={() => setForm({ ...p })}
                  >
                    <FiEdit2 /> Edit
                  </button>
                  <button
                    className={secondaryClass}
                    disabled={saving}
                    onClick={() =>
                      void mutate({ ...p, active: !p.active }, "PUT")
                    }
                  >
                    {p.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className={secondaryClass}
                    disabled={saving}
                    onClick={() => {
                      if (window.confirm(`Delete ${p.name}?`))
                        void mutate(p, "DELETE");
                    }}
                  >
                    <FiTrash2 /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!loading && !filtered.length && (
            <p className="py-10 text-center text-slate-500">
              No promotions yet. Create a coupon or automatic offer to get
              started.
            </p>
          )}
        </>
      )}
    </div>
  );
}
