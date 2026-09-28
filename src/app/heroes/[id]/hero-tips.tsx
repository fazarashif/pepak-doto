"use client";

import { CoachFrame } from "@/components/coach-frame";
import { MaskedSvg } from "@/components/brand";
import type { HeroTips } from "@/lib/llm/prompts/hero-tips";
import type { CoachResult } from "@/lib/llm/result";
import { requestHeroTips } from "./actions";

export function HeroTipsPanel({
  heroId,
  heroName,
  bracket,
  initial,
  signedIn,
}: {
  heroId: number;
  heroName: string;
  bracket: number;
  initial: CoachResult<HeroTips> | null;
  signedIn: boolean;
}) {
  return (
    <CoachFrame
      title={`Tips against ${heroName}`}
      intro="Short tips put together from the counters, items and timings below. Once written, everyone sees them until the next patch."
      buttonLabel="Get tips"
      initial={initial}
      signedIn={signedIn}
      signInNext={`/heroes/${heroId}?r=${bracket}`}
      request={() => requestHeroTips(heroId, bracket)}
      render={(t) => (
        <ul className="grid gap-2">
          {t.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <MaskedSvg
                src="/brand/ornament-margin-note.svg"
                className="mt-1.5 size-2.5 shrink-0 text-accent"
              />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
