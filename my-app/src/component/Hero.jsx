import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useProducts } from "../context/ProductContext";

// Standard SVG icons keep the carousel independent of an icon-library download.
function Icon({ name, className = "h-5 w-5" }) {
  const paths = {
    right: "M5 12h14m-6-6 6 6-6 6",
    left: "M19 12H5m6-6-6 6 6 6",
    pause: "M9 5v14M15 5v14",
    play: "m8 5 11 7-11 7V5Z",
    bag: "M5 7h14l1 14H4L5 7Zm3 0V5a4 4 0 0 1 8 0v2",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Zm-4 9 3 3 5-6",
    chat: "M21 11a8 8 0 0 1-8 8H5l-4 3V11a10 10 0 0 1 20 0Z",
  };
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.right} />
    </svg>
  );
}
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500";
const primary = `inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-orange-600 motion-reduce:transform-none motion-reduce:transition-none ${focus}`;
const secondary = `inline-flex min-h-12 items-center justify-center gap-3 rounded-lg border-2 border-white px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white hover:text-slate-800 motion-reduce:transition-none ${focus}`;
const safeLink = (value) =>
  typeof value === "string" &&
  /^\/(?!\/)/.test(value) &&
  !/[\\\s\x00-\x1f]/.test(value)
    ? value
    : "/products";
export function BannerLink({ to, children, ...props }) {
  const link = safeLink(to);
  return link.includes("#") ? (
    <a href={link} {...props}>
      {children}
    </a>
  ) : (
    <Link to={link} {...props}>
      {children}
    </Link>
  );
}
export function BannerImage({ banner, eager = false, fit = "cover" }) {
  const [failedSource, setFailedSource] = useState("");
  const positions = {
    left: "object-left",
    center: "object-center",
    right: "object-right",
    top: "object-top",
    bottom: "object-bottom",
  };
  return (
    <div className={fit === "natural" ? "relative w-full bg-slate-800" : "absolute inset-0 h-full w-full bg-slate-800"}>
      {typeof banner.image === 'string' && banner.image.trim() !== '' && failedSource !== banner.image ? (
        <img
          src={banner.image}
          alt={banner.imageAlt || ""}
          width="1920"
          height="1080"
          className={fit === "natural" ? "block h-auto w-full" : `h-full w-full object-cover ${positions[banner.imagePosition] || positions.center}`}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "low"}
          decoding="async"
          onError={() => setFailedSource(banner.image)}
        />
      ) : (
        <div
          className="campaign-image-fallback flex min-h-80 h-full items-center justify-end bg-slate-800 px-12"
          aria-label="Campaign image unavailable"
        >
          <span className="text-8xl font-black tracking-tighter text-slate-700 sm:text-9xl">
            SH
          </span>
        </div>
      )}
    </div>
  );
}
function HighlightTitle({ title = "" }) {
  // Admins can wrap chosen words in **double asterisks**. Otherwise highlight the last word.
  if (title.includes("**"))
    return title.split(/\*\*(.*?)\*\*/g).map((part, index) =>
      index % 2 ? (
        <span key={index} className="text-orange-500">
          {part}
        </span>
      ) : (
        part
      ),
    );
  const words = title.trim().split(/\s+/);
  const last = words.pop();
  return (
    <>
      {words.join(" ")}
      {words.length > 0 && " "}
      <span className="text-orange-500">{last}</span>
    </>
  );
}
export function HeroSlide({ slide, preview = false, active = true }) {
  const Heading = preview || !active ? "h2" : "h1";
  return (
    <div
      className="relative w-full overflow-hidden bg-slate-800"
    >
      <BannerImage banner={slide} eager={active && !preview} fit="natural" />
      <div className="absolute inset-0 bg-linear-to-r from-slate-900/90 via-slate-900/65 to-slate-900/20" />
      <div
        className={`relative z-10 mx-auto flex max-w-7xl flex-col items-start justify-center py-10 md:absolute md:inset-0 md:py-12 ${preview ? "px-6" : "px-14 sm:px-20 lg:px-24"}`}
      >
        {slide.badge && (
          <span className="mb-4 max-w-full truncate rounded-full border border-orange-500/50 bg-slate-800/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-500 sm:text-xs">
            {slide.badge}
          </span>
        )}
        <Heading
          className={`mb-4 line-clamp-3 max-w-3xl whitespace-pre-line break-words font-extrabold leading-tight tracking-tight text-white ${preview ? "text-3xl" : "text-3xl sm:text-5xl lg:text-6xl xl:text-7xl"}`}
        >
          <HighlightTitle title={slide.title} />
        </Heading>
        {slide.description && (
          <p className="mb-6 line-clamp-2 max-w-xl text-sm leading-relaxed text-gray-200 sm:text-base lg:text-lg">
            {slide.description}
          </p>
        )}
        <div className="flex max-w-full flex-wrap gap-3">
          {slide.buttonText && (
            <BannerLink to={slide.link} className={primary}>
              <span className="line-clamp-1">{slide.buttonText}</span>
              <Icon name="bag" className="h-4 w-4 shrink-0" />
            </BannerLink>
          )}
          {slide.secondaryButtonText && (
            <BannerLink to={slide.secondaryLink} className={secondary}>
              <span className="line-clamp-1">{slide.secondaryButtonText}</span>
              <Icon name="right" className="hidden h-4 w-4 shrink-0 sm:block" />
            </BannerLink>
          )}
        </div>
      </div>
    </div>
  );
}
export function PromoCard({ banner }) {
  return (
    <article className="relative flex min-h-80 overflow-hidden rounded-xl bg-slate-800">
      <BannerImage banner={banner} />
      <div className="absolute inset-0 bg-linear-to-t from-slate-900/95 via-slate-900/60 to-transparent" />
      <div className="relative z-10 flex flex-col items-start justify-end p-7 text-white">
        {banner.badge && (
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-500">
            {banner.badge}
          </p>
        )}
        <h2 className="text-2xl font-bold">
          <HighlightTitle title={banner.title} />
        </h2>
        {banner.description && (
          <p className="mt-3 line-clamp-2 text-sm text-gray-200">
            {banner.description}
          </p>
        )}
        {banner.buttonText && (
          <BannerLink to={banner.link} className={`${primary} mt-5`}>
            {banner.buttonText}
            <Icon name="right" />
          </BannerLink>
        )}
      </div>
    </article>
  );
}

export function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const current = slides.length ? index % slides.length : 0;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener("change", change);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (hidden || reducedMotion || slides.length < 2)
      return;
    const timer = setTimeout(
      () => setIndex((value) => (value + 1) % slides.length),
      6500,
    );
    return () => clearTimeout(timer);
  }, [hidden, reducedMotion, slides.length, index]);
  const select = (next) => {
    setIndex((next + slides.length) % slides.length);
  };
  if (!slides.length) return null;
  const control = `flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800/60 text-white backdrop-blur-sm transition-colors hover:bg-orange-500 motion-reduce:transition-none sm:h-12 sm:w-12 ${focus}`;
  return (
    <section
      className="campaign relative w-full overflow-hidden bg-slate-800"
      aria-label="Featured collections"
      aria-roledescription="carousel"
    >
      {slides.map((slide, i) => (
        <div
          key={slide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${slides.length}`}
          aria-hidden={i !== current}
          inert={i !== current}
          className={`transition-opacity duration-700 ease-in-out motion-reduce:transition-none ${i === current ? "relative z-10 opacity-100" : "absolute inset-0 pointer-events-none z-0 opacity-0"}`}
        >
          <HeroSlide slide={slide} active={i === current} />
        </div>
      ))}
      {slides.length > 1 && (
        <div className="campaign-controls">
          <button
            className={`${control} absolute left-2 top-1/2 z-20 -translate-y-1/2 sm:left-4`}
            onClick={() => select(current - 1)}
            aria-label="Previous slide"
          >
            <Icon name="left" />
          </button>
          <button
            className={`${control} absolute right-2 top-1/2 z-20 -translate-y-1/2 sm:right-4`}
            onClick={() => select(current + 1)}
            aria-label="Next slide"
          >
            <Icon name="right" />
          </button>

        </div>
      )}
    </section>
  );
}
export default function Hero({ showFeatures = true }) {
  const {
    banners,
    twoColumnBanners,
    bannerLoading,
    bannerError,
    refreshBanners,
  } = useProducts();
  const slides = banners.filter((b) => b.isActive);
  const promos = twoColumnBanners.filter((b) => b.isActive).slice(0, 2);
  if (bannerLoading && !slides.length && !promos.length)
    return (
      <div
        className="flex h-[500px] w-full items-center justify-center bg-slate-800 text-slate-300 md:h-[650px]"
        role="status"
      >
        Loading the latest collection…
      </div>
    );
  if (bannerError && !slides.length && !promos.length)
    return (
      <section className="bg-slate-800 px-6 py-20 text-center text-white">
        <h1 className="mb-6 text-3xl font-bold">
          Discover your next everyday favourite.
        </h1>
        <Link to="/products" className={primary}>
          Explore the shop
        </Link>
        <button
          onClick={refreshBanners}
          className="mx-auto mt-5 block text-sm text-slate-300 underline"
        >
          Reload highlights
        </button>
      </section>
    );
  return (
    <>
      <HeroCarousel slides={slides} />
      {showFeatures && (
        <div
          className="grid gap-6 bg-slate-800 px-6 py-7 text-white sm:grid-cols-3 lg:px-20"
          aria-label="Shopping services"
        >
          {[
            {
              icon: "bag",
              title: "Delivered to your door",
              text: "Delivery options at checkout",
              link: "/policies?tab=shipping",
            },
            {
              icon: "shield",
              title: "Shop with confidence",
              text: "Clear payment & return policies",
              link: "/policies",
            },
            {
              icon: "chat",
              title: "Here to help",
              text: "Contact our support team",
              link: "/contact",
            },
          ].map((item) => (
            <Link
              key={item.title}
              to={item.link}
              className={`flex items-center gap-4 sm:justify-center ${focus}`}
            >
              <Icon
                name={item.icon}
                className="h-6 w-6 shrink-0 text-orange-500"
              />
              <span>
                <strong className="block text-sm font-semibold">
                  {item.title}
                </strong>
                <small className="mt-1 block text-xs text-slate-300">
                  {item.text}
                </small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
