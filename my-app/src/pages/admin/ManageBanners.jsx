import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiPlus,
  FiArrowUp,
  FiArrowDown,
  FiEdit2,
  FiTrash2,
  FiEye,
  FiEyeOff,
  FiRefreshCw,
  FiArrowUpRight,
} from "react-icons/fi";
import { useProducts } from "../../context/ProductContext";
import { useAdminAlert } from "../../context/AdminAlertContext";
import ImageUploadInput from "../../component/ImageUploadInput";
import { HeroSlide, PromoCard } from "../../component/Hero";

const freshBanner = (kind) => ({
  title: "",
  description: "",
  buttonText: "Shop now",
  link: "/shop",
  secondaryButtonText: kind === "hero" ? "Explore categories" : "",
  secondaryLink: "/#categories",
  badge: "",
  image: "",
  imageAlt: "",
  imagePosition: "center",
  kind,
  isActive: false,
});

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700";

const fields = [
  ["title", "Main headline", 255, "Style, considered."],
  [
    "description",
    "Supporting text",
    1500,
    "Introduce this collection in a few thoughtful words.",
  ],
  [
    "badge",
    "Promotional badge (optional)",
    80,
    "e.g. Selected styles · 20% off",
  ],
  ["buttonText", "Primary button label (blank to hide)", 100, "Shop now"],
  ["link", "Primary destination", 500, "/shop?category=Topwear"],
  [
    "secondaryButtonText",
    "Secondary button label (blank to hide)",
    100,
    "Explore categories",
  ],
  ["secondaryLink", "Secondary destination", 500, "/#categories"],
  [
    "imageAlt",
    "Image description for screen readers",
    255,
    "Model wearing a neutral linen shirt",
  ],
];

export default function ManageBanners() {
  const {
    banners,
    twoColumnBanners,
    bannerLoading,
    bannerError,
    refreshBanners,
    saveBanner,
    deleteBanner,
    reorderBanners,
  } = useProducts();
  const { showAlert } = useAdminAlert();
  const [kind, setKind] = useState("hero");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const formRef = useRef(null);
  const records = kind === "hero" ? banners : twoColumnBanners;

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.message || "Changes could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const edit = (banner) => {
    setForm({ ...freshBanner(kind), ...banner });
    setError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      formRef.current?.querySelector("input")?.focus();
    });
  };

  const save = (event) => {
    event.preventDefault();
    void run(async () => {
      const { id, ...fields } = form;
      await saveBanner(
        {
          ...fields,
          position:
            fields.position ??
            Math.max(-1, ...records.map((b) => b.position)) + 1,
        },
        id,
      );
      setForm(null);
      showAlert({
        type: "success",
        title: "Banner saved",
        message: fields.isActive
          ? "Your changes are live on the storefront."
          : "Draft saved. Activate it when you are ready to publish.",
      });
    });
  };

  const move = (id, direction) =>
    run(async () => {
      const ids = records.map((b) => b.id),
        index = ids.indexOf(id),
        next = index + direction;
      if (next < 0 || next >= ids.length) return;
      [ids[index], ids[next]] = [ids[next], ids[index]];
      await reorderBanners(ids, kind);
    });

  return (
    <div className="space-y-7 pb-12">
      <header className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.2em] text-slate-400 mb-2">
            Storefront studio
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Banners & campaigns
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Shape the first impression. Preview, save and publish your latest
            edit.
          </p>
        </div>
        <Link to="/" className={buttonClass}>
          View storefront <FiArrowUpRight className="text-slate-600" />
        </Link>
      </header>

      <div className="flex flex-wrap gap-3 items-center border-b border-slate-200 pb-4">
        {[
          ["hero", "Hero carousel"],
          ["promo", "Promotional cards"],
        ].map(([value, label]) => (
          <button
            key={value}
            disabled={busy || Boolean(form)}
            onClick={() => {
              setKind(value);
              setSearch("");
              setDeleteId(null);
            }}
            className={`${buttonClass} ${
              kind === value
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-white"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-slate-500 ml-auto">
          {records.filter((b) => b.isActive).length} live / {records.length}{" "}
          total
        </span>
      </div>

      {(error || bannerError) && (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-800"
        >
          {error || bannerError}
          <button
            className="ml-4 underline"
            disabled={busy}
            onClick={refreshBanners}
          >
            Retry loading
          </button>
        </div>
      )}

      {form && (
        <form
          ref={formRef}
          onSubmit={save}
          className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 space-y-6"
        >
          <h2 className="font-bold text-xl">
            {form.id ? "Edit campaign" : "Create campaign"}
          </h2>
          <fieldset
            disabled={busy}
            className="grid grid-cols-1 xl:grid-cols-2 gap-8 min-w-0"
          >
            <div className="space-y-5 min-w-0">
              <ImageUploadInput
                label="Campaign image"
                required
                value={form.image}
                onChange={(image) => setForm((prev) => ({ ...prev, image }))}
                maxDimension={1920}
                quality={0.82}
                maxOutputBytes={2 * 1024 * 1024}
                helperText="JPG, PNG or WebP. Automatically compressed. Optimized to 1920px / 2 MB. Landscape 1920x1080 works best for the full-width hero."
              />
              {fields
                .filter(
                  ([key]) => kind === "hero" || !key.startsWith("secondary"),
                )
                .map(([key, label, max, placeholder]) => (
                  <label
                    key={key}
                    className="block text-sm font-medium text-slate-700"
                  >
                    <span className="block mb-2">{label}</span>
                    {["title", "description"].includes(key) ? (
                      <textarea
                        required={key === "title"}
                        rows={key === "title" ? 2 : 3}
                        maxLength={max}
                        className={inputClass}
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <input
                        required={key === "link" || key === "secondaryLink"}
                        maxLength={max}
                        className={inputClass}
                        placeholder={placeholder}
                        value={form[key]}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    )}
                  </label>
                ))}
              <p className="text-xs text-slate-500">
                Wrap headline words in **double asterisks** to highlight them in
                orange. Use storefront paths for buttons, such as /shop,
                /shop?category=Footwear or /#categories. A promotional badge is
                display text; configure actual discounts in Promotions.
              </p>
              <label className="block text-sm font-medium text-slate-700">
                Image focus
                <select
                  value={form.imagePosition}
                  className={`${inputClass} mt-2`}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      imagePosition: e.target.value,
                    }))
                  }
                >
                  {["center", "left", "right", "top", "bottom"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />{" "}
                Live on storefront after saving
              </label>
            </div>
            <div className="min-w-0">
              <div className="sticky top-24">
                <p className="text-xs tracking-widest uppercase text-slate-500 mb-3">
                  Live layout preview
                </p>
                <div
                  className="campaign-preview overflow-hidden rounded-xl border border-slate-200"
                  aria-hidden="true"
                  inert=""
                >
                  {kind === "hero" ? (
                    <div className="campaign">
                      <HeroSlide
                        slide={{
                          ...form,
                          title: form.title || "Your next chapter in style.",
                        }}
                        preview
                      />
                    </div>
                  ) : (
                    <PromoCard
                      banner={{
                        ...form,
                        title: form.title || "Your next chapter in style.",
                      }}
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  {kind === "hero"
                    ? "Preview uses the storefront hero component. It adapts to the available width."
                    : "Promotional cards use a full-image treatment below the hero."}
                </p>
              </div>
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-3 border-t pt-5 border-slate-200">
            <button
              type="submit"
              disabled={busy || !form.image.trim()}
              className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`}
            >
              {busy
                ? "Saving…"
                : form.isActive
                  ? "Save & publish"
                  : "Save draft"}
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() => setForm(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          aria-label="Search banners"
          className={`${inputClass} flex-1 min-w-40`}
          placeholder="Search campaigns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={buttonClass}
          disabled={busy || bannerLoading}
          onClick={refreshBanners}
          aria-label="Refresh banners"
        >
          <FiRefreshCw className="text-slate-600" />
        </button>
        <button
          className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}
          disabled={
            busy || Boolean(form) || bannerLoading || Boolean(bannerError)
          }
          onClick={() => edit(freshBanner(kind))}
        >
          <FiPlus className="text-white" /> Add {kind === "hero" ? "slide" : "card"}
        </button>
      </div>

      {kind === "promo" && (
        <p className="text-xs text-slate-500">
          The first two active cards appear below the hero. Reorder cards to
          choose which appear first.
        </p>
      )}

      {bannerLoading && (
        <p role="status" className="text-sm text-slate-500">
          Loading campaigns…
        </p>
      )}

      <div className="space-y-3">
        {records
          .filter((b) => b.title.toLowerCase().includes(search.toLowerCase()))
          .map((banner) => (
            <article
              key={banner.id}
              className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 p-4 bg-white"
            >
              <img
                src={banner.image}
                alt=""
                loading="lazy"
                className="w-24 h-28 object-cover rounded-lg bg-slate-100"
                style={{ objectPosition: banner.imagePosition }}
              />
              <div className="flex-1 min-w-40">
                <span
                  className={`text-[10px] tracking-wider uppercase ${
                    banner.isActive ? "text-emerald-700" : "text-slate-400"
                  }`}
                >
                  {banner.isActive ? "Live" : "Draft"} · Position{" "}
                  {records.findIndex((b) => b.id === banner.id) + 1}
                </span>
                <h2 className="font-semibold text-slate-900 mt-1 whitespace-pre-line break-words">
                  {banner.title}
                </h2>
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {banner.description}
                </p>
                {banner.badge && (
                  <span className="inline-block bg-slate-50 text-slate-900 text-xs px-2 py-1 mt-2 rounded">
                    {banner.badge}
                  </span>
                )}
              </div>

              {/* ACTION BUTTONS WITH ICON COLORS */}
              <div className="flex flex-wrap gap-2">
                <button
                  className={buttonClass}
                  disabled={
                    busy || Boolean(form) || records[0]?.id === banner.id
                  }
                  onClick={() => move(banner.id, -1)}
                  aria-label={`Move ${banner.title} up`}
                >
                  <FiArrowUp className="text-slate-600" />
                </button>
                <button
                  className={buttonClass}
                  disabled={
                    busy || Boolean(form) || records.at(-1)?.id === banner.id
                  }
                  onClick={() => move(banner.id, 1)}
                  aria-label={`Move ${banner.title} down`}
                >
                  <FiArrowDown className="text-slate-600" />
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || Boolean(form)}
                  onClick={() =>
                    run(() =>
                      saveBanner({ isActive: !banner.isActive }, banner.id),
                    )
                  }
                  aria-label={`${banner.isActive ? "Hide" : "Publish"} ${banner.title}`}
                >
                  {banner.isActive ? (
                    <FiEye className="text-emerald-600" />
                  ) : (
                    <FiEyeOff className="text-slate-400" />
                  )}
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || Boolean(form)}
                  onClick={() => edit(banner)}
                  aria-label={`Edit ${banner.title}`}
                >
                  <FiEdit2 className="text-amber-600" />
                </button>
                <button
                  className={buttonClass}
                  disabled={busy || Boolean(form)}
                  onClick={() => setDeleteId(banner.id)}
                  aria-label={`Delete ${banner.title}`}
                >
                  <FiTrash2 className="text-red-600" />
                </button>
              </div>

              {deleteId === banner.id && (
                <div
                  className="w-full flex flex-wrap gap-3 items-center bg-red-50 text-red-800 p-3 rounded-lg text-sm"
                  role="alert"
                >
                  Permanently delete this campaign?
                  <button
                    disabled={busy}
                    className={buttonClass}
                    onClick={() =>
                      run(async () => {
                        await deleteBanner(banner.id);
                        setDeleteId(null);
                      })
                    }
                  >
                    Delete campaign
                  </button>
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() => setDeleteId(null)}
                  >
                    Keep it
                  </button>
                </div>
              )}
            </article>
          ))}
      </div>

      {!bannerLoading && !records.length && !bannerError && (
        <div className="border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <h2 className="font-semibold text-xl">
            Your next campaign starts here.
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Add a banner, preview your message, then publish when you are ready.
          </p>
        </div>
      )}
    </div>
  );
}