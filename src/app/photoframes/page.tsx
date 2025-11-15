import { getTemplatesPaginated } from "@/lib/templates";
import { PhotoframesView } from "./_components/photoframes-view";
import { redirect } from "next/navigation";

interface PhotoframesPageProps {
  searchParams: Promise<{ page?: string }>;
}

const PhotoframesPage = async ({ searchParams }: PhotoframesPageProps) => {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || "1"));

  const { templates, totalCount, totalPages } = await getTemplatesPaginated(currentPage, 12);

  // Redirect if page is out of range
  if (currentPage > totalPages && totalPages > 0) {
    redirect("/photoframes?page=1");
  }

  return (
    <PhotoframesView
      templates={templates}
      currentPage={currentPage}
      totalPages={totalPages}
      totalCount={totalCount}
    />
  );
};

export default PhotoframesPage;