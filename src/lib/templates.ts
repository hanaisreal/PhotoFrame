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

const readTemplateFromDisk = async (
  slug: string,
): Promise<FrameTemplate | null> => {
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
  texts: input.data.texts ?? [],
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
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .upsert(
          {
            slug: payload.slug,
            data: payload,
            overlay_data_url: payload.overlayDataUrl || '',
          },
          { onConflict: "slug" },
        )
        .select()
        .single();

      if (error) {
        console.error("Supabase save error:", error);
        throw mapSupabaseError(error);
      }

      return { slug: data.slug };
    } catch (error) {
      console.warn(
        "[templates] Failed to save via Supabase. Falling back to local file storage.",
        error,
      );
    }
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
    try {
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
    } catch (error) {
      console.warn(
        "[templates] Failed to read via Supabase. Falling back to local file storage.",
        error,
      );
    }
  }

  return readTemplateFromDisk(slug);
};

export const getAllTemplates = async (): Promise<FrameTemplate[]> => {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("slug, data, overlay_data_url, created_at, updated_at")
        .order("updated_at", { ascending: false });

      if (error) {
        console.warn(
          "[templates] Failed to read all templates via Supabase. Falling back to local file storage.",
          error,
        );
      } else if (data) {
        return data.map((item) =>
          normalizeTemplate({
            slug: item.slug,
            data: item.data as TemplatePersistencePayload,
            overlay_data_url: item.overlay_data_url as string | undefined,
            created_at: item.created_at as string | undefined,
            updated_at: item.updated_at as string | undefined,
          }),
        );
      }
    } catch (error) {
      console.warn(
        "[templates] Failed to read all templates via Supabase. Falling back to local file storage.",
        error,
      );
    }
  }

  // Fallback to local file storage
  try {
    await ensureLocalDirectory();
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(LOCAL_TEMPLATE_DIR);
    const jsonFiles = files.filter((file) => file.endsWith(".json"));

    const templates = await Promise.allSettled(
      jsonFiles.map(async (file) => {
        const slug = file.replace(".json", "");
        return await readTemplateFromDisk(slug);
      }),
    );

    return templates
      .filter((result): result is PromiseFulfilledResult<FrameTemplate> =>
        result.status === "fulfilled" && result.value !== null
      )
      .map((result) => result.value)
      .sort((a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
  } catch {
    return [];
  }
};

export const supabaseAvailable = (): boolean => isSupabaseConfigured();
