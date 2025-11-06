import { getTemplate } from "@/lib/templates";
import type { FrameTemplate } from "@/types/frame";

import { EditorView } from "./_components/editor-view";

type SearchParamsValue = Record<string, string | string[] | undefined>;

interface EditorPageProps {
  searchParams:
    | SearchParamsValue
    | Promise<SearchParamsValue>;
}

const resolveSlug = (
  searchParams: SearchParamsValue,
): string | undefined => {
  const slug = searchParams?.slug;
  if (typeof slug === "string") {
    return slug;
  }
  return Array.isArray(slug) ? slug[0] : undefined;
};

const fetchTemplate = async (slug?: string): Promise<FrameTemplate | null> => {
  if (!slug) {
    return null;
  }
  return getTemplate(slug);
};

const EditorPage = async ({ searchParams }: EditorPageProps) => {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const slug = resolveSlug(resolvedSearchParams ?? {});
  const template = await fetchTemplate(slug);

  return <EditorView initialTemplate={template ?? undefined} />;
};

export default EditorPage;
