"use server";

import { opendota } from "@/lib/opendota/client";

export async function requestParse(matchId: number): Promise<{ ok: boolean; message?: string }> {
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return { ok: false, message: "That match ID doesn't look right." };
  }
  try {
    await opendota.requestParse(matchId);
    return { ok: true };
  } catch (err) {
    console.error("[match] parse request failed", err);
    return { ok: false, message: "OpenDota didn't accept the request. Try again in a minute." };
  }
}
