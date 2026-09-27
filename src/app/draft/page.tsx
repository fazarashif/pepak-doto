import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Draft" };

export default function DraftPage() {
  return (
    <ComingSoon
      chapter="Chapter I"
      illustration="/brand/spot-draft.svg"
      title="Draft assistant"
      description="This is the next thing being built. You'll enter the heroes picked so far and get suggestions that counter the enemy lineup and fit your team."
    />
  );
}
