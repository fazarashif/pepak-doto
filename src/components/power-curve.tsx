import { cn } from "@/lib/cn";
import { CURVE_FROM, CURVE_TO } from "@/lib/plan/game-plan";

export interface CurveSeries {
  label: string;
  points: { minute: number; value: number }[];
  variant: "accent" | "muted";
}

const W = 320;
const H = 140;
const PAD = { left: 30, right: 8, top: 10, bottom: 22 };
const RANGE = 0.12;

/** Grafik winrate relatif per durasi game (bin 5 menit). */
export function PowerCurve({
  series,
  label,
  note,
}: {
  series: CurveSeries[];
  /** Ringkasan untuk pembaca layar. */
  label: string;
  note: string;
}) {
  const x = (m: number) =>
    PAD.left + ((m - CURVE_FROM) / (CURVE_TO - CURVE_FROM)) * (W - PAD.left - PAD.right);
  const y = (v: number) => {
    const clamped = Math.max(-RANGE, Math.min(RANGE, v));
    return PAD.top + ((RANGE - clamped) / (2 * RANGE)) * (H - PAD.top - PAD.bottom);
  };
  const path = (points: CurveSeries["points"]) =>
    points
      .map((p, i) => `${i ? "L" : "M"}${x(p.minute).toFixed(1)},${y(p.value).toFixed(1)}`)
      .join(" ");

  return (
    <figure className="grid gap-2 rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(0)}
          y2={y(0)}
          className="stroke-border-strong"
          strokeDasharray="3 3"
        />
        {[15, 30, 45, 60].map((m) => (
          <text
            key={m}
            x={x(m)}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted font-mono text-[9px]"
          >
            {m === 60 ? "60+" : m}
          </text>
        ))}
        <text x={2} y={y(RANGE) + 4} className="fill-muted font-mono text-[9px]">
          better
        </text>
        <text x={2} y={y(-RANGE)} className="fill-muted font-mono text-[9px]">
          worse
        </text>
        {/* Seri "muted" digambar dulu supaya garis utama berada di atas. */}
        {[...series]
          .sort((a, b) => Number(a.variant === "accent") - Number(b.variant === "accent"))
          .map((s) => (
            <path
              key={s.label}
              d={path(s.points)}
              className={cn("fill-none", s.variant === "accent" ? "stroke-accent" : "stroke-muted")}
              strokeWidth={s.variant === "accent" ? 2.5 : 2}
              strokeDasharray={s.variant === "muted" ? "5 4" : undefined}
            />
          ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "w-5",
                s.variant === "accent"
                  ? "h-0.5 bg-accent"
                  : "h-0 border-t-2 border-dashed border-muted",
              )}
            />
            {s.label}
          </span>
        ))}
        <span>{note}</span>
      </figcaption>
    </figure>
  );
}
