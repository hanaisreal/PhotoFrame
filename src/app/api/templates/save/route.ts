import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { saveTemplate } from "@/lib/templates";
import type { TemplatePersistencePayload } from "@/types/frame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const preferredRegion = "auto";
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
};

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as TemplatePersistencePayload;

    if (!payload?.slug || !payload.layout || !payload.images) {
      return NextResponse.json(
        { error: "Invalid template payload" },
        { status: 400 },
      );
    }

    const { slug } = await saveTemplate(payload);

    revalidatePath(`/booth/${slug}`);
    revalidatePath("/editor", "page");
    revalidatePath("/photoframes");

    return NextResponse.json({ slug });
  } catch (error) {
    console.error("Failed to save template:", error);
    return NextResponse.json(
      { error: "Failed to save template" },
      { status: 500 },
    );
  }
}
