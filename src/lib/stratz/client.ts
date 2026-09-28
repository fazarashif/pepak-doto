import "server-only";
import { recordUsage } from "@/lib/usage";
import { createGql, type Gql } from "./api";

export function isStratzConfigured() {
  return Boolean(process.env.STRATZ_TOKEN);
}

/**
 * Boleh memanggil STRATZ langsung dari server ini?
 * Di Vercel tidak: IP-nya berganti-ganti, padahal token hanya boleh dipakai dari 2 IP per
 * 15 menit, dan itu bisa menggagalkan sinkron harian. Di sana data dibaca dari hasil sinkron.
 * Di laptop boleh, supaya development tidak perlu menjalankan sinkron dulu.
 */
export function canFetchStratzLive() {
  return isStratzConfigured() && !process.env.VERCEL;
}

let gql: Gql | null = null;

export function stratzGql(): Gql {
  const token = process.env.STRATZ_TOKEN;
  if (!token) throw new Error("STRATZ_TOKEN is not set");
  gql ??= createGql(token, (info) => void recordUsage("stratz", info.remainingDay));
  return gql;
}
