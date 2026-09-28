import { after } from "next/server";
import { opendota } from "@/lib/opendota/client";
import { readReplays } from "@/lib/players/data";
import type { PlayerLookup } from "@/lib/players/data";
import type { WardMap } from "@/lib/opendota/types";
import { pct } from "@/lib/dota";

type OkPlayer = Extract<PlayerLookup, { status: "ok" }>;

// Koordinat wardmap OpenDota berupa grid 64..192 (x ke kanan, y ke atas).
const MIN = 64;
const SIZE = 128;

function toPoints(grid: WardMap["obs"]) {
  const out: { x: number; y: number; n: number }[] = [];
  for (const [x, col] of Object.entries(grid)) {
    for (const [y, n] of Object.entries(col)) {
      out.push({ x: Number(x) - MIN, y: SIZE - (Number(y) - MIN), n });
    }
  }
  return out;
}

export async function WardsView({ accountId, player }: { accountId: number; player: OkPlayer }) {
  const map = await opendota.wardmap(accountId).catch(() => null);
  // Untuk akun terdaftar, baca statistik replay yang sudah selesai di-parse setelah halaman terkirim.
  if (player.registered) after(() => readReplays(accountId, 3).catch(() => 0));
  const parsedCount = player.summaries.filter((s) => s.parsed).length;
  const obs = map ? toPoints(map.obs) : [];
  const sen = map ? toPoints(map.sen) : [];
  const total = (list: typeof obs) => list.reduce((s, p) => s + p.n, 0);

  const withReplay = player.summaries.filter((s) => s.replay);
  const lifetimes = withReplay
    .map((s) => s.replay?.obsLifetime)
    .filter((v): v is number => typeof v === "number");
  const placed = withReplay.reduce((s, m) => s + (m.replay?.obsPlaced ?? 0), 0);
  const dewarded = withReplay.reduce((s, m) => s + (m.replay?.obsDewarded ?? 0), 0);
  const avgLife = lifetimes.length ? lifetimes.reduce((s, v) => s + v, 0) / lifetimes.length : null;

  if (!obs.length && !sen.length) {
    return (
      <p className="rounded-lg border border-border bg-surface p-5">
        No ward data yet. Ward positions come from parsed replays.{" "}
        {player.registered
          ? "Your new matches are sent for parsing every day, so this fills in over time."
          : "Signed-in players get their matches parsed automatically."}
      </p>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <figure className="grid gap-3">
        <WardMapSvg obs={obs} sen={sen} />
        <figcaption className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-accent" aria-hidden />
            Observer ({total(obs)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-full border-2 border-fg" aria-hidden />
            Sentry ({total(sen)})
          </span>
          <span>Bigger circles mean more wards on that spot. From all parsed matches.</span>
        </figcaption>
      </figure>

      <section aria-labelledby="ward-stats" className="grid gap-3">
        <h2 id="ward-stats" className="font-display text-xl font-bold">
          Recent games
        </h2>
        {withReplay.length ? (
          <dl className="grid gap-2">
            <Row
              label="Games with replay data"
              value={`${withReplay.length} of ${player.summaries.length}`}
            />
            <Row label="Observers per game" value={(placed / withReplay.length).toFixed(1)} />
            {avgLife !== null ? (
              <Row
                label="Average observer life"
                value={`${Math.floor(avgLife / 60)}:${String(Math.round(avgLife % 60)).padStart(2, "0")}`}
                note="An observer lasts 6:00 if nobody finds it."
              />
            ) : null}
            {placed ? (
              <Row
                label="Found by the enemy"
                value={pct(dewarded / placed, 0)}
                note="Short-lived wards usually mean spots the enemy checks often."
              />
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted">
            {parsedCount && player.registered
              ? `${parsedCount} of the last ${player.summaries.length} matches have a parsed replay. Their ward stats are being read and will show up here shortly.`
              : parsedCount
                ? `${parsedCount} of the last ${player.summaries.length} matches have a parsed replay. Ward stats per game are only read for players who have signed in to Pepak Doto.`
                : `None of the last ${player.summaries.length} matches has a parsed replay yet.`}
          </p>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="grid gap-0.5 rounded-lg border border-border bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
      {note ? <dd className="text-xs text-muted">{note}</dd> : null}
    </div>
  );
}

function WardMapSvg({
  obs,
  sen,
}: {
  obs: { x: number; y: number; n: number }[];
  sen: { x: number; y: number; n: number }[];
}) {
  const max = Math.max(1, ...obs.map((p) => p.n), ...sen.map((p) => p.n));
  const r = (n: number) => 1.3 + 2.4 * Math.sqrt(n / max);
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={`Ward map: ${obs.length} observer spots and ${sen.length} sentry spots.`}
      className="aspect-square w-full max-w-xl rounded-lg border border-border bg-surface-2"
    >
      {/* Sungai: dari kiri atas ke kanan bawah melewati tengah */}
      <path
        d="M0,46 C30,50 52,56 64,64 C76,72 98,80 128,84"
        className="fill-none stroke-border"
        strokeWidth={7}
        strokeLinecap="round"
      />
      {/* Lane atas, tengah, bawah */}
      <path
        d="M14,114 L14,14 L114,14 M14,114 L114,14 M14,114 L114,114 L114,14"
        className="fill-none stroke-border-strong"
        strokeWidth={1.2}
        strokeDasharray="2 2"
      />
      {/* Base */}
      <rect
        x={3}
        y={103}
        width={22}
        height={22}
        rx={3}
        className="fill-radiant/25 stroke-radiant"
        strokeWidth={0.6}
      />
      <rect
        x={103}
        y={3}
        width={22}
        height={22}
        rx={3}
        className="fill-dire/25 stroke-dire"
        strokeWidth={0.6}
      />
      <text x={5} y={100} className="fill-radiant font-mono text-[4px]">
        Radiant
      </text>
      <text x={104} y={30} className="fill-dire font-mono text-[4px]">
        Dire
      </text>

      {sen.map((p) => (
        <circle
          key={`s${p.x}-${p.y}`}
          cx={p.x}
          cy={p.y}
          r={r(p.n)}
          className="fill-none stroke-fg/80"
          strokeWidth={0.6}
        />
      ))}
      {obs.map((p) => (
        <circle key={`o${p.x}-${p.y}`} cx={p.x} cy={p.y} r={r(p.n)} className="fill-accent/70" />
      ))}
    </svg>
  );
}
