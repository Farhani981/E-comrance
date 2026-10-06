import useStoreInfo from '../hooks/useStoreInfo';
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiShoppingBag,
  FiHeart,
  FiUser,
  FiSearch,
  FiMenu,
  FiX,
  FiChevronDown,
  FiArrowUpRight,
  FiLayers,
  FiLogOut,
} from "react-icons/fi";
import logo from '../assets/logo.png';
import { useProducts } from "../context/ProductContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../context/AuthContext";
const destination = (parent, sub, type) =>
  "/products?" +
  new URLSearchParams({
    category: parent.slug,
    ...(sub ? { subcategory: sub.slug } : {}),
    ...(type ? { type: type.slug } : {}),
  });

export default function Navbar() {
  const { catalogTree, catalogError, catalogLoading, refreshCatalog } =
    useProducts();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const settings = useStoreInfo();
  const { user, logout } = useAuth();
  const [active, setActive] = useState(null),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState("");
  const dialog = useRef(null),
    menuButton = useRef(null),
    nav = useRef(null);
  const location = useLocation(),
    navigate = useNavigate();
  const close = () => {
    setActive(null);
    setMobile(false);
  };
  useEffect(() => {
    close();
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (mobile) {
      dialog.current?.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
        dialog.current?.close();
        menuButton.current?.focus();
      };
    }
  }, [mobile]);
  useEffect(() => {
    const dismiss = (e) => {
      if (!nav.current?.contains(e.target)) setActive(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const search = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate("/products?" + new URLSearchParams({ search: query.trim() }));
      close();
    }
  };
  const searchForm = (
    <form
      className="men-search flex items-center gap-3 rounded-lg border border-transparent bg-gray-100/80 px-4 py-2 text-slate-500 transition-colors focus-within:border-orange-500 focus-within:bg-white"
      onSubmit={search}
    >
      <FiSearch aria-hidden="true" />
      <input
        className="h-7 w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-500"
        aria-label="Search men's products"
        placeholder="Search your next essential…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors hover:bg-slate-200 hover:text-orange-600"
        aria-label="Submit search"
      >
        <FiArrowUpRight />
      </button>
    </form>
  );
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 bg-slate-950 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white sm:px-8 lg:px-12">
        <span>THE MODERN MAN’S WARDROBE</span>
        <Link
          className="hidden items-center gap-2 text-slate-200 transition-colors hover:text-orange-400 sm:flex"
          to="/contact"
        >
          Need a hand? We’re here to help <FiArrowUpRight />
        </Link>
      </div>

      <div className="mx-auto flex max-w-360 items-center justify-between gap-4 px-4 py-3 sm:px-8 min-[901px]:gap-8 min-[901px]:py-6 lg:px-12">
        {/* Header main bar on mobile (Logo + Hamburger + Actions) */}
        <div className="flex w-full items-center justify-between gap-2 min-[901px]:w-auto min-[901px]:justify-start min-[901px]:gap-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              ref={menuButton}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-800 transition hover:bg-slate-100 min-[901px]:hidden"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
              aria-expanded={mobile}
            >
              <FiMenu className="h-5 w-5" />
            </button>

            <Link
              className="flex shrink-0 items-center gap-2 sm:gap-2.5"
              to="/"
              aria-label={`${settings?.storeName || 'ShopHub'} home`}
            >
              <img
                src={(typeof settings?.logo === 'string' && settings.logo.trim() !== '') ? settings.logo : logo}
                alt={settings?.storeName || 'ShopHub'}
                className="hidden h-7 w-7 rounded-full border border-slate-200 object-contain bg-white shadow-sm min-[340px]:block sm:h-10 sm:w-10"
              />
              <span>
                <span className="block text-xl font-black leading-none tracking-tight text-slate-900 sm:text-2xl min-[901px]:text-3xl">
                  {settings?.storeName || 'ShopHub'}
                </span>
                <span className="mt-1 block text-[7px] font-bold tracking-[0.2em] text-slate-500 sm:text-[8px]">
                  {settings?.storeTagline || 'CURATED FOR MEN'}
                </span>
              </span>
            </Link>
          </div>

          {/* Action icons for mobile */}
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-2 min-[901px]:hidden">
            <Link
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600 sm:h-10 sm:w-10"
              to={user ? "/account" : "/login"}
              aria-label={user ? "My account" : "Sign in"}
            >
              <FiUser className="h-5 w-5" />
            </Link>
            <Link
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600 sm:h-10 sm:w-10"
              to="/wishlist"
              aria-label={`Wishlist, ${wishlistCount} items`}
            >
              <FiHeart className="h-5 w-5" />
              {wishlistCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white">{wishlistCount}</span>}
            </Link>
            <Link
              className="relative flex h-7 w-7 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600 sm:h-10 sm:w-10"
              to="/cart"
              aria-label={`Shopping bag, ${cartCount} items`}
            >
              <FiShoppingBag className="h-5 w-5" />
              {cartCount > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[9px] font-bold text-white">{cartCount}</span>}
            </Link>
          </div>
        </div>

        {/* Search bar (Desktop only - Hidden on mobile, opens inside mobile sidebar drawer) */}
        <div className="hidden w-full min-[901px]:block min-[901px]:max-w-xl min-[901px]:flex-1">
          {searchForm}
        </div>

        {/* Action icons for desktop */}
        <div className="hidden shrink-0 items-center gap-1 sm:gap-3 min-[901px]:flex">
          <Link
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600"
            to={user ? "/account" : "/login"}
            aria-label={user ? "My account" : "Sign in"}
          >
            <FiUser className="h-5 w-5" />
          </Link>
          <Link
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600"
            to="/wishlist"
            aria-label={`Wishlist, ${wishlistCount} items`}
          >
            <FiHeart className="h-5 w-5" />
            {wishlistCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">{wishlistCount}</span>}
          </Link>
          <Link
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100 hover:text-orange-600"
            to="/cart"
            aria-label={`Shopping bag, ${cartCount} items`}
          >
            <FiShoppingBag className="h-5 w-5" />
            {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-orange-600 px-1 text-[10px] font-bold text-white">{cartCount}</span>}
          </Link>
        </div>
      </div>

      <nav
        className="relative hidden border-t border-gray-100 min-[901px]:block"
        ref={nav}
        aria-label="Men's departments"
        onMouseLeave={() => setActive(null)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setActive(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            nav.current?.querySelector('[aria-expanded="true"]')?.focus();
            setActive(null);
          }
        }}
      >
        <div className="mx-auto flex min-h-14 max-w-360 items-center justify-center gap-7 px-6 text-[13px] font-bold text-slate-800 lg:gap-10 [&>a]:transition-colors [&>a:hover]:text-orange-600 [&>button:hover]:text-orange-600">
          <Link
            to="/products"
            className="transition hover:text-orange-600"
            onMouseEnter={() => setActive(null)}
          >
            New arrivals <span />
          </Link>
          {catalogTree.map((parent) => (
            <button
              key={parent.id}
              className="flex items-center gap-1 font-bold transition hover:text-orange-600"
              aria-expanded={active === parent.id}
              aria-controls={`mega-${parent.id}`}
              onMouseEnter={() => setActive(parent.id)}
              onClick={() => setActive(parent.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive(parent.id);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`mega-${parent.id}`)
                      ?.querySelector("a")
                      ?.focus(),
                  );
                }
              }}
            >
              {parent.name}
              <FiChevronDown />
            </button>
          ))}
          <Link
            className="transition hover:text-orange-600"
            to="/about"
            onMouseEnter={() => setActive(null)}
          >
            Our story
          </Link>
          {catalogLoading && !catalogTree.length && (
            <span role="status">Loading departments…</span>
          )}
          {catalogError && !catalogTree.length && (
            <button onClick={refreshCatalog}>Reload departments</button>
          )}
        </div>
        {catalogTree
          .filter((parent) => parent.id === active)
          .map((parent) => (
            <div className="border-t border-slate-100 bg-white" key={parent.id} id={`mega-${parent.id}`}>
              <div className="mx-auto max-w-360 px-4 py-5 sm:px-8 lg:px-12">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500">Explore {parent.name.toUpperCase()}</span>
                  <Link className="flex items-center gap-2 text-sm font-bold text-slate-900 transition hover:text-orange-600" to={destination(parent)} onClick={close}>
                    Shop all {parent.name} <FiArrowUpRight />
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-8">
                  {parent.children.map((sub) => (
                    <div className="space-y-2" key={sub.id}>
                      <Link
                        className="flex items-center gap-2 font-black text-slate-900 transition hover:text-orange-600"
                        to={destination(parent, sub)}
                        onClick={close}
                      >
                        <FiLayers aria-hidden="true" />
                        {sub.name}
                      </Link>
                      {sub.children.map((type) => (
                        <Link
                          key={type.id}
                          className="block text-sm font-semibold text-slate-500 transition hover:text-orange-600"
                          to={destination(parent, sub, type)}
                          onClick={close}
                        >
                          {type.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
      </nav>

      <dialog
        ref={dialog}
        className="rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl outline-none backdrop:bg-slate-950/40"
        aria-label="Men's navigation"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setMobile(false);
          }
        }}
        onCancel={(e) => {
          e.preventDefault();
          setMobile(false);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMobile(false);
        }}
      >
        <div className="w-[320px] max-w-[90vw] p-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-sm font-black uppercase tracking-[0.22em] text-slate-900">Explore the wardrobe</span>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-slate-100"
              onClick={() => setMobile(false)}
              aria-label="Close navigation"
            >
              <FiX />
            </button>
          </div>
          {searchForm}
          <Link className="mt-4 flex items-center justify-between rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white" to="/products" onClick={close}>
            New arrivals <FiArrowUpRight />
          </Link>
          {catalogError && (
            <button className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={refreshCatalog}>Retry loading categories</button>
          )}
          {catalogTree.map((parent) => (
            <details className="mt-4 rounded-xl border border-slate-100 bg-white px-3 py-2" key={parent.id}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-black text-slate-900">
                {parent.name}
                <FiChevronDown />
              </summary>
              <Link
                className="mt-3 block rounded-lg px-2 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
                to={destination(parent)}
                onClick={close}
              >
                Shop all {parent.name}
              </Link>
              {parent.children.map((sub) => (
                <div className="mt-3 border-l border-slate-200 pl-3" key={sub.id}>
                  <Link className="flex items-center justify-between text-xs font-bold text-slate-800 transition hover:text-orange-600" to={destination(parent, sub)} onClick={close}>
                    {sub.name}
                    <FiArrowUpRight />
                  </Link>
                  {sub.children.length > 0 && (
                    <details className="mt-2">
                      <summary className="flex cursor-pointer items-center justify-between gap-4 text-[11px] font-bold text-slate-500">
                        Browse product types
                        <FiChevronDown />
                      </summary>
                      {sub.children.map((type) => (
                        <Link
                          key={type.id}
                          className="mt-2 block text-[11px] font-semibold text-slate-600 transition hover:text-orange-600"
                          to={destination(parent, sub, type)}
                          onClick={close}
                        >
                          {type.name}
                        </Link>
                      ))}
                    </details>
                  )}
                </div>
              ))}
            </details>
          ))}
          <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
            <Link className="flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-orange-600" to={user ? "/account" : "/login"} onClick={close}>
              <FiUser />
              {user ? "My account" : "Sign in / Register"}
            </Link>
            <Link className="flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-orange-600" to="/wishlist" onClick={close}>
              <FiHeart />
              Wishlist ({wishlistCount})
            </Link>
            {user && (
              <>
                <Link className="block text-sm font-bold text-slate-700 transition hover:text-orange-600" to="/orders" onClick={close}>
                  My orders
                </Link>
                <button
                  className="flex items-center gap-2 text-sm font-bold text-slate-700 transition hover:text-orange-600"
                  onClick={() => {
                    logout();
                    close();
                  }}
                >
                  <FiLogOut />
                  Sign out
                </button>
              </>
            )}
            <Link className="block text-sm font-bold text-slate-700 transition hover:text-orange-600" to="/about" onClick={close}>
              Our story
            </Link>
            <Link className="block text-sm font-bold text-slate-700 transition hover:text-orange-600" to="/contact" onClick={close}>
              Contact & support
            </Link>
          </div>
        </div>
      </dialog>
    </header>
  );
}
