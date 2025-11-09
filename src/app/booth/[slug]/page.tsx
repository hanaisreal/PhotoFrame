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
  if (!template) {
    notFound();
  }

  return <BoothView template={template} />;
};

export default BoothPage;
