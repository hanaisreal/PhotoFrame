import { notFound } from "next/navigation";

import { BoothView } from "@/app/booth/[slug]/_components/booth-view";
import { getTemplate } from "@/lib/templates";

type BoothParams = { slug: string };

interface BoothPageProps {
  params: Promise<BoothParams>;
}

const BoothPage = async ({ params }: BoothPageProps) => {
  const resolvedParams = await Promise.resolve(params);
  const template = await getTemplate(resolvedParams.slug);

  // Debug: Log the loaded template
  console.log('🐛 [Booth Debug] Loaded template:', {
    slug: template?.slug,
    name: template?.name,
    imagesCount: template?.images?.length,
    images: template?.images,
    stickersCount: template?.stickers?.length,
    textsCount: template?.texts?.length
  });

  if (!template) {
    notFound();
  }

  return <BoothView template={template} />;
};

export default BoothPage;
