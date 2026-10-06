import { useState } from "react";
import { useProducts } from "../../context/ProductContext";
import { useAuth } from "../../context/AuthContext";

export default function ManageNavigation() {
  const { catalogTree, catalogLoading, catalogError, refreshCatalog } =
    useProducts();
  const { user } = useAuth();
  const [form, setForm] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remove, setRemove] = useState(null);
  const input =
    "w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white";
  const button =
    "rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50";
  const request = async (path, method, body) => {
    const res = await fetch("/api/catalog" + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user?.token || ""}`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      throw new Error(data.message || "Could not save navigation.");
  };
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await refreshCatalog();
      setForm(null);
      setRemove(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const editor = (node, parent) =>
    setForm(
      node
        ? { ...node }
        : {
            name: "",
            parent_id: parent.id,
            parentName: parent.name,
            position: parent.children.length,
            image: "",
            promo_title: "",
          },
    );
  const row = (node) => (
    <div className="flex flex-wrap items-center gap-3 py-2">
      <span className="flex-1 text-sm font-semibold">{node.name}</span>
      <button
        type="button"
        className={button}
        disabled={busy}
        onClick={() => editor(node)}
      >
        Edit
      </button>
      {node.parent_id && (
        <button
          type="button"
          className={button}
          disabled={busy}
          onClick={() => setRemove(node)}
        >
          Delete
        </button>
      )}
    </div>
  );
  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div>
        <h2 className="text-2xl font-bold">Men’s navigation catalog</h2>
        <p className="text-sm text-slate-500 mt-2">
          These database categories power the navbar and product upload
          dropdowns. Homepage image cards are managed separately below.
        </p>
      </div>
      {(error || catalogError) && (
        <p role="alert" className="text-sm text-red-700">
          {error || catalogError}{" "}
          <button type="button" onClick={refreshCatalog} className="underline">
            Refresh
          </button>
        </p>
      )}
      {catalogLoading && <p role="status">Loading navigation…</p>}
      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() =>
              request(
                form.id ? "/" + form.id : "",
                form.id ? "PUT" : "POST",
                form,
              ),
            );
          }}
          className="rounded-xl bg-slate-50 p-5 space-y-4"
        >
          <h3 className="font-bold">
            {form.id ? "Edit " + form.name : "Add under " + form.parentName}
          </h3>
          <label className="block text-xs font-semibold">
            Name
            <input
              required
              maxLength={100}
              disabled={busy || Boolean(form.id && !form.parent_id)}
              className={input}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block text-xs font-semibold">
            Display order
            <input
              type="number"
              required
              min="0"
              max="1000"
              className={input}
              value={form.position}
              onChange={(e) =>
                setForm({ ...form, position: Number(e.target.value) })
              }
            />
          </label>
          {!form.parent_id && (
            <>
              <label className="block text-xs font-semibold">
                Mega-menu promotional headline
                <input
                  maxLength={150}
                  className={input}
                  value={form.promo_title}
                  onChange={(e) =>
                    setForm({ ...form, promo_title: e.target.value })
                  }
                />
              </label>
              <label className="block text-xs font-semibold">
                Men’s promotional image URL (optional)
                <input
                  className={input}
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
              </label>
            </>
          )}
          <p className="text-xs text-slate-500">
            Existing URL slugs remain stable when names change. Categories with
            assigned products or children cannot be deleted.
          </p>
          <button className={button} disabled={busy}>
            {busy ? "Saving…" : "Save category"}
          </button>{" "}
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={() => setForm(null)}
          >
            Cancel
          </button>
        </form>
      )}
      {remove && (
        <div role="alert" className="bg-red-50 rounded-lg p-4 text-sm">
          Delete {remove.name}?{" "}
          <button
            className={button}
            disabled={busy}
            onClick={() => run(() => request("/" + remove.id, "DELETE"))}
          >
            Confirm delete
          </button>{" "}
          <button
            className={button}
            disabled={busy}
            onClick={() => setRemove(null)}
          >
            Cancel
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {catalogTree.map((parent) => (
          <details
            className="border rounded-xl border-slate-200 p-4"
            key={parent.id}
          >
            <summary className="font-bold cursor-pointer">
              {parent.name}{" "}
              <span className="text-xs text-slate-400">
                ({parent.children.length} subcategories)
              </span>
            </summary>
            {row(parent)}
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => editor(null, parent)}
            >
              + Add subcategory
            </button>
            {parent.children.map((sub) => (
              <details key={sub.id} className="mt-3 rounded-lg bg-slate-50 p-3">
                <summary className="text-sm font-semibold cursor-pointer">
                  {sub.name}
                </summary>
                {row(sub)}
                <button
                  type="button"
                  className={button}
                  disabled={busy}
                  onClick={() => editor(null, sub)}
                >
                  + Add product type
                </button>
                <div className="pl-3 mt-2">
                  {sub.children.map((type) => (
                    <div key={type.id}>{row(type)}</div>
                  ))}
                </div>
              </details>
            ))}
          </details>
        ))}
      </div>
    </section>
  );
}
