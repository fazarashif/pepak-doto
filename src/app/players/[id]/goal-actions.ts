"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { isGoalMetric } from "@/lib/players/goals";

/** Batas target aktif per user, supaya daftarnya tetap berguna. */
const MAX_ACTIVE = 10;

const goalSchema = z.object({
  metric: z.string().refine(isGoalMetric, "Pick a metric from the list."),
  direction: z.enum(["atLeast", "atMost"]),
  target: z.coerce.number().finite().min(0).max(100_000),
  games: z.coerce.number().int().min(1).max(50),
  heroId: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(1).max(300).nullable(),
  ),
});

export type GoalFormState = { status: "idle" | "saved" | "error"; message?: string };

export async function createGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again." };

  const parsed = goalSchema.safeParse({
    metric: formData.get("metric"),
    direction: formData.get("direction"),
    target: formData.get("target"),
    games: formData.get("games"),
    heroId: formData.get("heroId"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the goal." };
  }

  try {
    const db = await getDb();
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.goals)
      .where(and(eq(schema.goals.userId, user.id), isNull(schema.goals.archivedAt)));
    if (n >= MAX_ACTIVE) {
      return {
        status: "error",
        message: `You already have ${MAX_ACTIVE} goals. Remove one before adding another.`,
      };
    }
    await db.insert(schema.goals).values({ userId: user.id, ...parsed.data });
  } catch (err) {
    console.error("[goals] create failed", err);
    return { status: "error", message: "Couldn't save right now. Try again in a moment." };
  }

  revalidatePath(`/players/${user.accountId}`);
  return { status: "saved", message: "Goal added. Your next matches count toward it." };
}

export async function archiveGoal(goalId: string) {
  const user = await getCurrentUser();
  if (!user || !z.string().uuid().safeParse(goalId).success) return;
  const db = await getDb();
  await db
    .update(schema.goals)
    .set({ archivedAt: new Date() })
    .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, user.id)));
  revalidatePath(`/players/${user.accountId}`);
}
