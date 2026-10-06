import { useCallback, useEffect, useState } from "react";
import {
  FiEdit2,
  FiStar,
  FiTrash2,
  FiCheckCircle,
  FiXCircle,
  FiMessageSquare,
  FiClock,
  FiList,
} from "react-icons/fi";
import {
  OperationsHeader,
  SearchBar,
  Field,
  LoadNotice,
  inputClass,
  buttonClass,
  secondaryClass,
  operationsRequest as request,
} from "./operationsShared";
import MetricGrid, { StatCard, ACCENT_COLORS } from "../../component/MetricGrid";

type Review = {
  id: number;
  product_name: string;
  customer_name: string;
  rating: number;
  comment: string;
  status: string;
  created_at: string;
};

export default function ManageReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [editing, setEditing] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReviews((await request("/operations/reviews")).reviews);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(review: Review, method = "PUT") {
    setSaving(true);
    setError("");
    try {
      await request(`/operations/reviews/${review.id}`, {
        method,
        body: method === "PUT" ? JSON.stringify(review) : undefined,
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }

  const filtered = reviews.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.customer_name} ${r.product_name} ${r.comment}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  const pendingCount = reviews.filter((r) => r.status === "Pending").length;
  const approvedCount = reviews.filter((r) => r.status === "Approved").length;
  const rejectedCount = reviews.filter((r) => r.status === "Rejected").length;

  // Dynamic status filter tabs setup
  const sections = [
    { id: "", label: `All Reviews (${reviews.length})`, color: "#0496C7", icon: <FiList size={16} /> },
    { id: "Pending", label: `Pending (${pendingCount})`, color: "#d97706", icon: <FiClock size={16} /> },
    { id: "Approved", label: `Approved (${approvedCount})`, color: "#059669", icon: <FiCheckCircle size={16} /> },
    { id: "Rejected", label: `Rejected (${rejectedCount})`, color: "#dc2626", icon: <FiXCircle size={16} /> },
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <OperationsHeader
        title="Product Reviews & Ratings"
        description="Approve customer reviews before publication, edit content, or remove reviews."
      />

      {/* Top Stats Overview */}
      <MetricGrid cols={3}>
        <StatCard label="Pending Reviews" value={pendingCount} icon={<FiClock size={20} />} accent={ACCENT_COLORS[3]} />
        <StatCard label="Approved Reviews" value={approvedCount} icon={<FiCheckCircle size={20} />} accent={ACCENT_COLORS[1]} />
        <StatCard label="Rejected Reviews" value={rejectedCount} icon={<FiXCircle size={20} />} accent={ACCENT_COLORS[6]} />
      </MetricGrid>

      {/* Dynamic Colored Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => {
            const isActive = status === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-pressed={isActive}
                style={{
                  backgroundColor: isActive ? section.color : `${section.color}15`,
                  color: isActive ? "#ffffff" : section.color,
                  borderColor: `${section.color}40`,
                }}
                onClick={() => setStatus(section.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-all hover:opacity-90"
              >
                {section.icon}
                {section.label}
              </button>
            );
          })}
        </div>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by customer, product name or review comment..."
          refresh={load}
          loading={loading}
        />
      </div>

      <LoadNotice loading={loading} error={error} />

      {/* Edit Form Modal/Section */}
      {editing && (
        <form
          className="bg-white rounded-2xl border border-indigo-200 p-6 shadow-md space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(editing);
          }}
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FiEdit2 className="text-indigo-600" /> Edit Review — {editing.product_name}
            </h2>
            <span className="text-xs text-slate-500">ID: #{editing.id}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rating">
              <select
                className={inputClass}
                value={editing.rating}
                onChange={(e) =>
                  setEditing({ ...editing, rating: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} Stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                className={inputClass}
                value={editing.status}
                onChange={(e) =>
                  setEditing({ ...editing, status: e.target.value })
                }
              >
                {["Pending", "Approved", "Rejected"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Customer Comment">
            <textarea
              required
              maxLength={3000}
              rows={4}
              className={inputClass}
              value={editing.comment}
              onChange={(e) =>
                setEditing({ ...editing, comment: e.target.value })
              }
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className={secondaryClass}
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button className={buttonClass} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* Reviews Cards List */}
      <div className="space-y-4">
        {filtered.map((r) => (
          <article
            key={r.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition duration-200"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">{r.product_name}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <span>{r.customer_name}</span>
                  <span>•</span>
                  <span>{new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</span>
                </div>
              </div>

              {/* Styled Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                  r.status === "Approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : r.status === "Pending"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
              >
                {r.status === "Approved" && <FiCheckCircle className="w-3.5 h-3.5" />}
                {r.status === "Pending" && <FiClock className="w-3.5 h-3.5" />}
                {r.status === "Rejected" && <FiXCircle className="w-3.5 h-3.5" />}
                {r.status}
              </span>
            </div>

            {/* Rating Stars */}
            <div className="mt-3 flex items-center gap-1">
              {[...Array(5)].map((_, index) => (
                <FiStar
                  key={index}
                  className={`w-4 h-4 ${
                    index < r.rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-slate-200"
                  }`}
                />
              ))}
              <span className="ml-1 text-xs font-semibold text-slate-600">{r.rating}.0</span>
            </div>

            {/* Comment Text */}
            <p className="my-4 text-sm leading-relaxed text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
              "{r.comment}"
            </p>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2">
                {r.status !== "Approved" && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void mutate({ ...r, status: "Approved" })}
                  >
                    <FiCheckCircle /> Approve
                  </button>
                )}

                {r.status !== "Rejected" && (
                  <button
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                    disabled={saving}
                    onClick={() => void mutate({ ...r, status: "Rejected" })}
                  >
                    <FiXCircle /> Reject
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  disabled={saving}
                  onClick={() => setEditing({ ...r })}
                >
                  <FiEdit2 /> Edit
                </button>

                <button
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/50 px-3.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition disabled:opacity-50"
                  disabled={saving}
                  onClick={() => {
                    if (window.confirm("Permanently delete this review?"))
                      void mutate(r, "DELETE");
                  }}
                >
                  <FiTrash2 /> Delete
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!loading && !filtered.length && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <FiMessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-medium">No reviews found</p>
          <p className="text-xs text-slate-400">
            No reviews match your filter or search criteria.
          </p>
        </div>
      )}
    </div>
  );
}