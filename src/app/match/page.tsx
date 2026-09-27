import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Match review" };

export default function MatchPage() {
  return (
    <ComingSoon
      chapter="Chapter III"
      illustration="/brand/spot-review.svg"
      title="Match review"
      description="Coming together with the draft assistant. Paste a match ID and you'll see how your laning, farm, deaths and item timings compare with other players on the same hero."
    />
  );
}
