import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiTag } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext";
import { useAdminAlert } from "../../context/AdminAlertContext";
import AdminFormPage from "../../component/AdminFormPage";
import DeleteConfirmModal from "../../component/DeleteConfirmModal";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500";
const blankValue = () => ({ label: "", color: "#000000" });

async function readResponse(response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "The Attributes API is unavailable. Restart the backend server to load the latest routes, then reload this page.",
    );
  }
  const data = await response.json();
  if (!response.ok || !data.success)
    throw new Error(data.message || "Unable to load attributes.");
  return data;
}

export default function ManageAttributes() {
  const { user } = useAuth();
  const { showAlert } = useAdminAlert();
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function request(path = "", options = {}) {
    const response = await fetch(`/api/attributes${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.token}`,
      },
    });
    return readResponse(response);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/attributes", {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(async (response) => {
        const data = await readResponse(response);
        if (!cancelled) setAttributes(data.attributes);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.token]);

  function start(name = "", type = "text") {
    setError("");
    setForm({ name, type, values: [blankValue()] });
  }

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await request(form.id ? `/${form.id}` : "", {
        method: form.id ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setAttributes((previous) =>
        form.id
          ? previous.map((item) =>
              item.id === form.id ? data.attribute : item,
            )
          : [...previous, data.attribute],
      );
      setForm(null);
      showAlert({ type: "success", message: "Attribute saved successfully." });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await request(`/${deleteTarget.id}`, { method: "DELETE" });
      setAttributes((previous) =>
        previous.filter((item) => item.id !== deleteTarget.id),
      );
      setDeleteTarget(null);
      showAlert({ type: "success", message: "Attribute deleted." });
    } catch (err) {
      showAlert({ type: "error", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  function updateValue(index, changes) {
    setForm((previous) => ({
      ...previous,
      values: previous.values.map((value, i) =>
        i === index ? { ...value, ...changes } : value,
      ),
    }));
  }

  if (form)
    return (
      <AdminFormPage
        backLabel="Back to Attributes"
        onBack={() => {
          if (!busy) {
            setForm(null);
            setError("");
          }
        }}
      >
        <h1 className="text-2xl font-bold">
          {form.id ? "Edit attribute" : "Add attribute"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Create a group such as Color, Size, Material, or Pattern and add its
          available values.
        </p>
        <form onSubmit={save} className="mt-6 max-w-3xl space-y-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                <span>Attribute name</span>
                <input
                  required
                  maxLength={100}
                  className={inputClass}
                  placeholder="e.g. Size"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                <span>Display type</span>
                <select
                  className={inputClass}
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value })
                  }
                >
                  <option value="text">Text (size, material, pattern)</option>
                  <option value="color">Color swatches</option>
                </select>
              </label>
            </div>
            <div className="space-y-3">
              <h2 className="font-semibold">Values</h2>
              <p className="text-sm text-slate-500">
                {form.type === "color"
                  ? "Add color names and choose their swatches, such as Black or Blue."
                  : "Add one value per row, such as S, M, L, XL or Cotton, Linen."}
              </p>
              {form.values.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    aria-label={`Value ${index + 1}`}
                    required
                    maxLength={100}
                    className={inputClass}
                    placeholder={
                      form.type === "color" ? "Color name" : "Value name"
                    }
                    value={value.label}
                    onChange={(event) =>
                      updateValue(index, { label: event.target.value })
                    }
                  />
                  {form.type === "color" && (
                    <input
                      type="color"
                      aria-label={`Swatch for ${value.label || `value ${index + 1}`}`}
                      className="h-10 w-14 shrink-0 cursor-pointer rounded border border-slate-200"
                      value={value.color || "#000000"}
                      onChange={(event) =>
                        updateValue(index, { color: event.target.value })
                      }
                    />
                  )}
                  <button
                    type="button"
                    disabled={form.values.length === 1}
                    aria-label={`Remove value ${index + 1}`}
                    className="rounded-lg p-3 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    onClick={() =>
                      setForm({
                        ...form,
                        values: form.values.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <FiTrash2 />
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={form.values.length >= 100}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                onClick={() =>
                  setForm({ ...form, values: [...form.values, blankValue()] })
                }
              >
                <FiPlus /> Add value
              </button>
            </div>
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
            >
              {busy ? "Saving..." : "Save attribute"}
            </button>
          </fieldset>
        </form>
      </AdminFormPage>
    );

  const filtered = attributes.filter((item) =>
    `${item.name} ${item.values.map((value) => value.label).join(" ")}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attributes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage colors, sizes, materials, and other product options.
          </p>
        </div>
        <button
          disabled={loading || !!error}
          onClick={() => start()}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <FiPlus /> Add attribute
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error} Please reload the page to try again.
        </p>
      )}
      <input
        aria-label="Search attributes"
        className={inputClass}
        placeholder="Search attributes or values..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loading ? (
        <p role="status" className="py-10 text-center text-slate-500">
          Loading attributes...
        </p>
      ) : !error && !attributes.length ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <FiTag className="mx-auto mb-4 text-3xl text-slate-400" />
          <h2 className="text-lg font-bold">Create your first attribute</h2>
          <p className="mt-2 text-sm text-slate-500">
            Start with colors and sizes, or create your own attribute.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              onClick={() => start("Color", "color")}
            >
              Add colors
            </button>
            <button
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              onClick={() => start("Size")}
            >
              Add sizes
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-1">
          {filtered.map((attribute) => (
            <article
              key={attribute.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{attribute.name}</h2>
                  <p className="text-xs text-slate-500">
                    {attribute.type === "color" ? "Color swatches" : "Text"} ·{" "}
                    {attribute.values.length} values
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    aria-label={`Edit ${attribute.name}`}
                    className="rounded-lg p-2 hover:bg-slate-100"
                    onClick={() => {
                      setError("");
                      setForm({
                        ...attribute,
                        values: attribute.values.map((value) => ({
                          color: "#000000",
                          ...value,
                        })),
                      });
                    }}
                  >
                    <FiEdit2 />
                  </button>
                  <button
                    aria-label={`Delete ${attribute.name}`}
                    className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget(attribute)}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {attribute.values.map((value) => (
                  <span
                    key={value.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  >
                    {attribute.type === "color" && (
                      <span
                        className="h-4 w-4 rounded-full border border-slate-300"
                        style={{ backgroundColor: value.color }}
                      />
                    )}
                    {value.label}
                  </span>
                ))}
              </div>
            </article>
          ))}
          {!filtered.length && !error && (
            <p className="text-sm text-slate-500">No matching attributes.</p>
          )}
        </div>
      )}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete attribute"
        message="Delete this attribute and all its values?"
        itemName={deleteTarget?.name}
        confirmText={busy ? "Deleting..." : "Delete"}
        onConfirm={remove}
        onCancel={() => {
          if (!busy) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
