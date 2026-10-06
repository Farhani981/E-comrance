import type { ReactNode } from 'react';

// ─── Accent palette (index 0..7) ───────────────────────────────────────────
export const ACCENT_COLORS = [
  '#2563eb', // 0 blue
  '#059669', // 1 emerald
  '#7c3aed', // 2 violet
  '#b45309', // 3 amber
  '#db2777', // 4 pink
  '#0891b2', // 5 cyan
  '#dc2626', // 6 red
  '#65a30d', // 7 lime
];

// ─── Shared card base styles (applied identically to every StatCard) ────────
const CARD_BASE: React.CSSProperties = {
  borderRadius: 16,          // rounded-2xl
  padding: '20px 24px',      // py-5 px-6
  minHeight: 120,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  background: '#fff',
  boxShadow: '0 1px 3px 0 rgba(0,0,0,.08)',
  transition: 'box-shadow .15s ease',
};

// ─── StatCard ─────────────────────────────────────────────────────────────
export interface StatCardProps {
  /** Short descriptive label shown above the value */
  label: string;
  /** Primary metric value — string, number, or any ReactNode */
  value: ReactNode;
  /** Optional supporting line (growth %, date range, sub-label …) */
  sub?: ReactNode;
  /** react-icons icon element or any ReactNode rendered in the icon box */
  icon?: ReactNode;
  /**
   * Accent colour (hex string, e.g. '#2563eb').
   * Controls the top border stripe, icon box bg, and icon colour.
   * Defaults to ACCENT_COLORS[0] (blue).
   */
  accent?: string;
}

export function StatCard({ label, value, sub, icon, accent = ACCENT_COLORS[0] }: StatCardProps) {
  return (
    <div
      style={{
        ...CARD_BASE,
        border: `1px solid ${accent}30`,
        borderTop: `3px solid ${accent}`,
        backgroundColor: `${accent}08`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px 0 rgba(0,0,0,.12)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px 0 rgba(0,0,0,.08)';
      }}
    >
      {/* Icon container */}
      {icon && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: `${accent}18`,
            color: accent,
            marginBottom: 12,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}

      {/* Text section */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {label}
        </p>
        <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, wordBreak: 'break-word' }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MetricGrid ───────────────────────────────────────────────────────────
/**
 * Responsive CSS-grid wrapper for StatCard components.
 * `cols` sets the maximum number of columns (default 4).
 */
export default function MetricGrid({
  children,
  cols = 4,
}: {
  children: ReactNode;
  cols?: 2 | 3 | 4 | 5;
}) {
  const colClass: Record<number, string> = {
    2: 'grid grid-cols-1 sm:grid-cols-2 gap-5',
    3: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5',
    4: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5',
    5: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5',
  };
  return <div className={colClass[cols] ?? colClass[4]}>{children}</div>;
}

