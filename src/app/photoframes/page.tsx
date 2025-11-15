import { getTemplatesPaginated } from "@/lib/templates";
import { PhotoframesView } from "./_components/photoframes-view";

const PhotoframesPage = async () => {
  // Load initial 9 templates (3x3 grid)
  const { templates, totalCount } = await getTemplatesPaginated(1, 9);

  return (
    <PhotoframesView
      initialTemplates={templates}
      totalCount={totalCount}
    />
  );
};

export default PhotoframesPage;