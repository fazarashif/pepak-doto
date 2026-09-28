"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { matchNotesSpec, toCoachResult } from "@/lib/llm/narratives";
import type { MatchNotes } from "@/lib/llm/prompts/match-notes";
import type { CoachResult } from "@/lib/llm/result";
import { generateNarrative } from "@/lib/llm/router";
import { isParsed } from "@/lib/match/analyze";
import { buildReport, lookupMatch } from "@/lib/match/data";
import { opendota } from "@/lib/opendota/client";

function validId(matchId: number) {
  return Number.isInteger(matchId) && matchId > 0;
}

export async function requestParse(matchId: number): Promise<{ ok: boolean; message?: string }> {
  if (!validId(matchId)) return { ok: false, message: "That match ID doesn't look right." };
  try {
    await opendota.requestParse(matchId);
    return { ok: true };
  } catch (err) {
    console.error("[match] parse request failed", err);
    return { ok: false, message: "OpenDota didn't accept the request. Try again in a minute." };
  }
}

/** Cek langsung ke OpenDota (tanpa cache) apakah replay sudah selesai di-parse. */
export async function checkParsed(matchId: number): Promise<boolean> {
  if (!validId(matchId)) return false;
  try {
    return isParsed(await opendota.refreshMatch(matchId));
  } catch (err) {
    console.warn("[match] parse check failed", err);
    return false;
  }
}

/** Coach's notes untuk satu pemain di match ini (butuh login). */
export async function requestMatchNotes(
  matchId: number,
  slot: number,
): Promise<CoachResult<MatchNotes>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to get coaching notes." };
  if (!validId(matchId) || !Number.isInteger(slot)) {
    return { ok: false, message: "That match doesn't look right." };
  }
  try {
    const lookup = await lookupMatch(matchId);
    if (lookup.status !== "ok") return { ok: false, message: "This match can't be reviewed." };
    const report = await buildReport(lookup.match, slot);
    return toCoachResult(await generateNarrative(await matchNotesSpec(report), user.id));
  } catch (err) {
    console.error("[match] coaching notes failed", err);
    return { ok: false, message: "Couldn't write notes right now. Try again in a minute." };
  }
}
