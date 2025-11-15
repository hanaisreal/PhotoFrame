// Server-side only imports - conditionally loaded
let nodeFs: typeof import("node:fs/promises") | null = null;
let nodePath: typeof import("node:path") | null = null;

// Dynamically import Node.js modules only on server-side
const getNodeModules = async () => {
  if (typeof window !== 'undefined') return null;
  if (!nodeFs || !nodePath) {
    [nodeFs, nodePath] = await Promise.all([
      import("node:fs/promises"),
      import("node:path")
    ]);
  }
  return { fs: nodeFs, path: nodePath };
};

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

const getLocalTemplateDir = async () => {
  const nodeModules = await getNodeModules();
  if (!nodeModules) return null;
  return nodeModules.path.join(process.cwd(), ".dist", "templates");
};

const ensureLocalDirectory = async () => {
  const nodeModules = await getNodeModules();
  const localDir = await getLocalTemplateDir();
  if (!nodeModules || !localDir) return;
  await nodeModules.fs.mkdir(localDir, { recursive: true });
};

const readTemplateFromDisk = async (
  slug: string,
): Promise<FrameTemplate | null> => {
  try {
    const nodeModules = await getNodeModules();
    const localDir = await getLocalTemplateDir();
    if (!nodeModules || !localDir) return null;

    const filePath = nodeModules.path.join(localDir, `${slug}.json`);
    const file = await nodeModules.fs.readFile(filePath, "utf-8");
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

  const nodeModules = await getNodeModules();
  const localDir = await getLocalTemplateDir();
  if (!nodeModules || !localDir) {
    throw new Error("File system operations not available in client environment");
  }

  await ensureLocalDirectory();
  const filePath = nodeModules.path.join(localDir, `${payload.slug}.json`);
  await nodeModules.fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
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
      // Exclude overlay_data_url to reduce payload size for listing pages
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("slug, data, created_at, updated_at")
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
            overlay_data_url: undefined, // Exclude overlay for listing
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

  // Fallback to local file storage (server-side only)
  if (typeof window === 'undefined') {
    try {
      const nodeModules = await getNodeModules();
      const localDir = await getLocalTemplateDir();
      if (!nodeModules || !localDir) return [];

      await ensureLocalDirectory();
      const files = await nodeModules.fs.readdir(localDir);
      const jsonFiles = files.filter((file) => file.endsWith(".json"));

      const templates = await Promise.allSettled(
        jsonFiles.map(async (file) => {
          const slug = file.replace(".json", "");
          const template = await readTemplateFromDisk(slug);
          // Remove overlay data for listing to reduce payload size
          if (template) {
            return { ...template, overlayDataUrl: undefined };
          }
          return null;
      }),
    );

      return templates
        .filter((result) => result.status === "fulfilled" && result.value !== null)
        .map((result) => (result as PromiseFulfilledResult<FrameTemplate>).value)
        .sort((a, b) =>
          new Date(b.updatedAt || b.createdAt || 0).getTime() -
          new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
    } catch {
      return [];
    }
  }

  // Client-side fallback - return empty array since file system isn't available
  return [];
};

export const supabaseAvailable = (): boolean => isSupabaseConfigured();
