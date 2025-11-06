import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PostgrestError } from "@supabase/supabase-js";

import type {
  FrameTemplate,
  TemplatePersistencePayload,
} from "@/types/frame";
import {
  getSupabaseServerClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

const TABLE_NAME = "templates";
const LOCAL_TEMPLATE_DIR = path.join(process.cwd(), ".dist", "templates");

const ensureLocalDirectory = async () => {
  await mkdir(LOCAL_TEMPLATE_DIR, { recursive: true });
};

const normalizeTemplate = (input: {
  slug: string;
  data: TemplatePersistencePayload;
  overlay_data_url?: string;
  created_at?: string;
  updated_at?: string;
}): FrameTemplate => ({
  slug: input.slug,
  name: input.data.templateName,
  description: input.data.templateDescription,
  layout: input.data.layout,
  images: input.data.images,
  stickers: input.data.stickers,
  overlayDataUrl: input.overlay_data_url ?? input.data.overlayDataUrl,
  createdAt: input.created_at,
  updatedAt: input.updated_at,
});

const mapSupabaseError = (error: PostgrestError) => {
  const base = new Error(error.message);
  base.name = "SupabaseError";
  return base;
};

export const saveTemplate = async (
  payload: TemplatePersistencePayload,
): Promise<{ slug: string }> => {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .upsert(
        {
          slug: payload.slug,
          data: payload,
          overlay_data_url: payload.overlayDataUrl,
        },
        { onConflict: "slug" },
      )
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return { slug: data.slug };
  }

  await ensureLocalDirectory();
  const filePath = path.join(LOCAL_TEMPLATE_DIR, `${payload.slug}.json`);
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
  return { slug: payload.slug };
};

export const getTemplate = async (
  slug: string,
): Promise<FrameTemplate | null> => {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("slug, data, overlay_data_url, created_at, updated_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw mapSupabaseError(error);
    }

    if (!data) {
      return null;
    }

    return normalizeTemplate({
      slug: data.slug,
      data: data.data as TemplatePersistencePayload,
      overlay_data_url: data.overlay_data_url as string | undefined,
      created_at: data.created_at as string | undefined,
      updated_at: data.updated_at as string | undefined,
    });
  }

  try {
    const filePath = path.join(LOCAL_TEMPLATE_DIR, `${slug}.json`);
    const file = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(file) as TemplatePersistencePayload;
    return normalizeTemplate({
      slug,
      data: parsed,
      overlay_data_url: parsed.overlayDataUrl,
      created_at: parsed.createdAt,
      updated_at: parsed.updatedAt,
    });
  } catch {
    return null;
  }
};

export const supabaseAvailable = (): boolean => isSupabaseConfigured();
