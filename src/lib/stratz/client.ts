import "server-only";
import { cached, HOUR } from "@/lib/cache";
import { recordUsage } from "@/lib/usage";
import { toStratzBracket } from "./brackets";

const ENDPOINT = "https://api.stratz.com/graphql";

export class StratzError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export function isStratzConfigured() {
  return Boolean(process.env.STRATZ_TOKEN);
}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.STRATZ_TOKEN;
  if (!token) throw new StratzError("STRATZ_TOKEN is not set", 0);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      // STRATZ menolak request tanpa User-Agent ini
      "User-Agent": "STRATZ_API",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  void recordUsage("stratz", Number(res.headers.get("x-ratelimit-remaining-day")));

  if (!res.ok) throw new StratzError(`STRATZ ${res.status}`, res.status);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new StratzError(body.errors[0].message, res.status);
  return body.data as T;
}

/** Satu pasangan hero. `synergy` dalam poin persen (positif = menguntungkan hero utama). */
export interface HeroPair {
  heroId2: number;
  matchCount: number;
  winCount: number;
  synergy: number;
}

export interface HeroMatchups {
  heroId: number;
  with: HeroPair[];
  vs: HeroPair[];
}

const MATCHUP_QUERY = /* GraphQL */ `
  query HeroMatchups($heroId: Short!, $brackets: [RankBracketBasicEnum]) {
    heroStats {
      heroVsHeroMatchup(heroId: $heroId, bracketBasicIds: $brackets, take: 200) {
        advantage {
          heroId
          with {
            heroId2
            matchCount
            winCount
            synergy
          }
          vs {
            heroId2
            matchCount
            winCount
            synergy
          }
        }
      }
    }
  }
`;

export const stratz = {
  /** Synergy (satu tim) dan keunggulan (lawan) satu hero terhadap semua hero lain. */
  heroMatchups: (heroId: number, bracket: number) => {
    const b = toStratzBracket(bracket);
    return cached(
      `stratz:matchups:${heroId}:${b}`,
      12 * HOUR,
      async () => {
        const data = await gql<{
          heroStats: { heroVsHeroMatchup: { advantage: HeroMatchups[] } | null };
        }>(MATCHUP_QUERY, { heroId, brackets: b === "ALL" ? null : [b] });
        const row = data.heroStats.heroVsHeroMatchup?.advantage[0];
        return row ?? { heroId, with: [], vs: [] };
      },
      { persist: true },
    );
  },
};
