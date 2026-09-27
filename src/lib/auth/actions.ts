"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, getCurrentUser } from "./session";
import { deleteUser, updatePreferences } from "./users";

export async function signOut() {
  await clearSession();
  redirect("/");
}

const preferencesSchema = z.object({
  preferredBracket: z.coerce.number().int().min(0).max(8),
  preferredPosition: z.coerce.number().int().min(0).max(5),
});

export type PreferencesState = { status: "idle" | "saved" | "error"; message?: string };

export async function savePreferences(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", message: "Your session has ended. Sign in again." };

  const parsed = preferencesSchema.safeParse({
    preferredBracket: formData.get("preferredBracket"),
    preferredPosition: formData.get("preferredPosition"),
  });
  if (!parsed.success) return { status: "error", message: "Pick a valid rank and position." };

  try {
    await updatePreferences(user.id, parsed.data);
  } catch {
    return { status: "error", message: "Couldn't save right now. Try again in a moment." };
  }
  revalidatePath("/profile");
  return { status: "saved", message: "Preferences saved." };
}

export async function deleteAccount() {
  const user = await getCurrentUser();
  if (user) await deleteUser(user.id);
  await clearSession();
  redirect("/?deleted=1");
}
