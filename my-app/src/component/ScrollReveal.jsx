import { useEffect, useRef, useState } from "react";

/**
 * ScrollReveal - Wraps children in an opacity/translate reveal that triggers
 * when the element enters the viewport. Respects prefers-reduced-motion.
 * Supports a stagger delay for child cards via the `stagger` prop.
 */
export default function ScrollReveal({
  children,
  as: Tag = "div",
  delay = 0,
  duration = 650,
  y = 16,
  stagger = 0,
  threshold = 0.12,
  rootMargin = "0px 0px -8% 0px",
  disabled = false,
  className = "",
  ...props
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(disabled);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }
    const node = ref.current;
    if (!node) return;
    if (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled, threshold, rootMargin]);

  const style = {
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
    transitionDelay: `${delay}ms`,
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : `translateY(${y}px)`,
  };

  return (
    <Tag ref={ref} className={className} style={style} {...props}>
      {stagger ? (
        <div className="flex flex-col" style={{ "--stagger": stagger }}>
          {children}
        </div>
      ) : (
        children
      )}
    </Tag>
  );
}