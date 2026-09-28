// Coach's notes untuk satu match. Fakta diambil dari laporan match yang sudah dihitung.

import { formatClock } from "@/lib/dota";
import type { MatchReport } from "@/lib/match/analyze";
import { nameError, str, STYLE, type Vocabulary } from "./common";

export const MATCH_NOTES_VERSION = 1;

export interface MatchNotes {
  summary: string;
  focus: { title: string; why: string; drill: string }[];
  keepDoing: string | null;
}

export const MATCH_NOTES_SYSTEM = [
  "You are a Dota 2 coach writing short notes for a player about one of their matches.",
  STYLE,
  "Keep the advice practical for the player's rank and role.",
  'Shape: {"summary": string (2 or 3 sentences), "focus": [{"title": string (at most 8 words), "why": string (1 or 2 sentences that cite the numbers), "drill": string (one concrete thing to do next game)}] (1 to 3 items, in the order of "priorities"), "keep_doing": string or null (one sentence based on "strengths")}.',
].join(" ");

export function matchNotesFacts(
  report: MatchReport,
  ctx: { heroName: string; heroNames: Map<number, string>; rankLabel: string | null },
) {
  const p = report.player;
  const killers = (report.deaths?.topKillers ?? []).map((k) => ({
    hero: ctx.heroNames.get(k.heroId) ?? "Unknown",
    kills: k.count,
  }));
  const facts = {
    hero: ctx.heroName,
    role: p.role,
    rank: ctx.rankLabel,
    result: p.win ? "win" : "loss",
    duration: formatClock(report.duration),
    kda: `${p.kills}/${p.deaths}/${p.assists}`,
    gpm: p.gpm,
    xpm: p.xpm,
    last_hits: p.lastHits,
    grades: report.grades
      .filter((g) => g.relevant)
      .map((g) => ({ area: g.label, grade: g.letter, percentile: Math.round(g.percentile * 100) })),
    laning: report.laning && {
      lane: report.laning.laneLabel,
      last_hits_at_10: report.laning.lh10,
      denies_at_10: report.laning.dn10,
      gold_lead_at_10: report.laning.goldDiff10,
    },
    deaths: report.deaths && {
      total: report.deaths.total,
      by_phase: Object.fromEntries(report.deaths.byPhase.map((b) => [b.label, b.count])),
      killed_most_by: killers,
      minutes_dead: Math.round(report.deaths.timeDead / 60),
    },
    item_timings: report.itemTimings.map((t) => ({
      item: t.item.name,
      bought_at: formatClock(t.time),
      your_win_rate: t.yourWinRate === null ? null : Math.round(t.yourWinRate * 100),
      best_window: t.bestBucket,
      best_win_rate: Math.round(t.bestWinRate * 100),
    })),
    final_items: report.items.map((i) => i.name),
    vision: report.vision,
    strengths: report.strengths,
    priorities: report.improvements.map((i) => ({ title: i.title, detail: i.detail, tip: i.tip })),
  };
  const allowed = [
    ctx.heroName,
    ...killers.map((k) => k.hero),
    ...report.items.map((i) => i.name),
    ...report.itemTimings.map((t) => t.item.name),
  ];
  return { facts, allowed };
}

export function parseMatchNotes(
  json: unknown,
  allowed: string[],
  vocab: Vocabulary,
): { value: MatchNotes } | { error: string } {
  const o = json as Record<string, unknown>;
  const summary = str(o?.summary, 700);
  if (!summary) return { error: "Missing summary" };
  if (!Array.isArray(o.focus) || o.focus.length < 1 || o.focus.length > 3) {
    return { error: "focus must have 1 to 3 items" };
  }
  const focus: MatchNotes["focus"] = [];
  for (const f of o.focus as Record<string, unknown>[]) {
    const title = str(f?.title, 90);
    const why = str(f?.why, 450);
    const drill = str(f?.drill, 450);
    if (!title || !why || !drill) return { error: "Incomplete focus item" };
    focus.push({ title, why, drill });
  }
  const keepDoing = o.keep_doing == null ? null : str(o.keep_doing, 300);
  const value = { summary, focus, keepDoing };
  const bad = nameError(value, allowed, vocab);
  return bad ? { error: bad } : { value };
}

/** Cadangan tanpa LLM: prioritas dari analisis aplikasi apa adanya. */
export function matchNotesTemplate(report: MatchReport): MatchNotes {
  const top = report.improvements[0];
  const result = report.player.win ? "You won this one" : "This one was a loss";
  return {
    summary: top
      ? `${result}. The biggest thing to work on: ${top.title.charAt(0).toLowerCase()}${top.title.slice(1)}.`
      : `${result}. Nothing stood out as a big problem in this match.`,
    focus: report.improvements
      .slice(0, 3)
      .map((i) => ({ title: i.title, why: i.detail, drill: i.tip })),
    keepDoing: report.strengths[0] ?? null,
  };
}
