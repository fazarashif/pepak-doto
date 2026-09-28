"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { isProviderId } from "@/lib/llm/providers";
import { saveLlmSettings, testModel } from "@/lib/llm/router";
import { settingsSchema } from "@/lib/llm/settings";

export type LlmFormState = { status: "idle" | "saved" | "error"; message?: string };

export async function saveLlmSettingsAction(
  _prev: LlmFormState,
  formData: FormData,
): Promise<LlmFormState> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return { status: "error", message: "Admins only." };

  const chain = [0, 1, 2]
    .map((i) => ({
      provider: String(formData.get(`provider${i}`) ?? ""),
      model: String(formData.get(`model${i}`) ?? "").trim(),
    }))
    .filter((c) => c.provider && c.provider !== "none" && c.model);

  const parsed = settingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    chain,
    perUserPerDay: Number(formData.get("perUserPerDay")),
    globalPerDay: Number(formData.get("globalPerDay")),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Check the settings." };
  }
  try {
    await saveLlmSettings(parsed.data, user.id);
  } catch (err) {
    console.error("[admin] saving LLM settings failed", err);
    return { status: "error", message: "Couldn't save right now." };
  }
  revalidatePath("/admin");
  return { status: "saved", message: "Saved. The new order applies to the next request." };
}

export async function testLlmModel(provider: string, model: string) {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) return { ok: false, message: "Admins only." };
  if (!isProviderId(provider) || !model.trim()) {
    return { ok: false, message: "Pick a provider and a model." };
  }
  return testModel({ provider, model: model.trim() });
}
