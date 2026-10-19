import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { loadDraftData } from "@/lib/draft/data";
import { recommend } from "@/lib/draft/engine";
import { bracketGroupLabel, bracketName } from "@/lib/dota";

const heroId = z.number().int().min(1).max(300);
const heroIds = (max: number) => z.array(heroId).max(max);
const slots = z
  .array(z.object({ heroId, position: z.number().int().min(1).max(5) }))
  .max(5)
  .refine((list) => new Set(list.map((s) => s.position)).size === list.length, {
    message: "Two heroes can't share a position",
  });

const bodySchema = z
  .object({
    allies: slots,
    enemies: slots,
    bans: heroIds(16),
    bracket: z.number().int().min(0).max(8),
    position: z.number().int().min(0).max(5),
    round: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
    poolOnly: z.boolean().default(false),
  })
  .refine(
    (b) => {
      const ids = [...b.allies, ...b.enemies].map((s) => s.heroId).concat(b.bans);
      return new Set(ids).size === ids.length;
    },
    { message: "A hero can only appear once in the draft" },
  );

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request";
    return Response.json({ error: message }, { status: 400 });
  }

  const user = await getCurrentUser();

  try {
    const { data, source, poolError } = await loadDraftData({
      allies: body.allies.map((s) => s.heroId),
      enemies: body.enemies.map((s) => s.heroId),
      bracket: body.bracket,
      accountId: user?.accountId,
    });

    const bracketLabel =
      source === "stratz"
        ? bracketGroupLabel(body.bracket)
        : body.bracket
          ? bracketName(Math.min(body.bracket, 7))
          : "all ranks";

    const result = recommend(
      { ...body, poolOnly: body.poolOnly && Boolean(data.pool), bracketLabel },
      data,
    );

    return Response.json({
      ...result,
      source,
      bracketLabel,
      pool: user ? (poolError ? "error" : "ok") : "signed-out",
    });
  } catch (err) {
    console.error("[draft] failed", err);
    return Response.json(
      { error: "Couldn't load hero data right now. Try again in a moment." },
      { status: 502 },
    );
  }
}
