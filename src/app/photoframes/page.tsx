import { getAllTemplates } from "@/lib/templates";
import { PhotoframesView } from "./_components/photoframes-view";

const PhotoframesPage = async () => {
  const templates = await getAllTemplates();

  return <PhotoframesView templates={templates} />;
};

export default PhotoframesPage;