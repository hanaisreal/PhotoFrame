"use server";

import { revalidatePath } from "next/cache";

import { saveTemplate } from "@/lib/templates";
import type { TemplatePersistencePayload } from "@/types/frame";

export const persistTemplate = async (payload: TemplatePersistencePayload) => {
  const { slug } = await saveTemplate(payload);
  revalidatePath(`/booth/${slug}`);
  revalidatePath(`/editor`, "page");
  return { slug };
};
