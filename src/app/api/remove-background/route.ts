import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

const BACKGROUND_REMOVAL_SERVICE_URL =
  process.env.BACKGROUND_REMOVAL_SERVICE_URL || "http://localhost:8000";

const extractBase64 = (dataUrl: string) => {
  const [, base64] = dataUrl.split(",");
  return base64 ?? dataUrl;
};

export const POST = async (request: NextRequest) => {
  try {
    console.log("Background removal service URL:", BACKGROUND_REMOVAL_SERVICE_URL);
    const { imageBase64 } = (await request.json()) as {
      imageBase64?: string;
    };

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 field is required" },
        { status: 400 },
      );
    }

    const base64 = extractBase64(imageBase64);
    const buffer = Buffer.from(base64, "base64");

    // Prepare form data for the rembg service
    const serviceFormData = new FormData();
    serviceFormData.append(
      "file",
      new Blob([buffer], { type: "image/png" }),
      "image.png",
    );

    // Call the local rembg background removal service
    const response = await fetch(`${BACKGROUND_REMOVAL_SERVICE_URL}/remove-background`, {
      method: "POST",
      body: serviceFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Background removal service error:", {
        status: response.status,
        url: `${BACKGROUND_REMOVAL_SERVICE_URL}/remove-background`,
        error: errorText
      });
      return NextResponse.json(
        {
          error: `Background removal service error: ${errorText}`,
        },
        { status: response.status },
      );
    }

    // Get the processed image buffer
    const arrayBuffer = await response.arrayBuffer();
    const result = Buffer.from(arrayBuffer).toString("base64");

    return NextResponse.json({
      imageBase64: `data:image/png;base64,${result}`,
    });
  } catch (error) {
    console.error("Background removal error:", error);
    return NextResponse.json(
      { error: "Error occurred during background removal processing" },
      { status: 500 },
    );
  }
};
