"use server";

import { isParsed } from "@/lib/match/analyze";
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
