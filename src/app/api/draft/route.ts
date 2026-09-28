import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { loadDraftData } from "@/lib/draft/data";
import { recommend } from "@/lib/draft/engine";
import { bracketGroupLabel, bracketName } from "@/lib/dota";

const heroIds = (max: number) => z.array(z.number().int().min(1).max(300)).max(max);

const bodySchema = z
  .object({
    allies: heroIds(4),
    enemies: heroIds(5),
    bans: heroIds(16),
    bracket: z.number().int().min(0).max(8),
    position: z.number().int().min(0).max(5),
    poolOnly: z.boolean().default(false),
  })
  .refine(
    (b) =>
      new Set([...b.allies, ...b.enemies, ...b.bans]).size ===
      b.allies.length + b.enemies.length + b.bans.length,
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
      allies: body.allies,
      enemies: body.enemies,
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
