import { Buffer } from "node:buffer";

import { NextRequest, NextResponse } from "next/server";

const REMOVE_BG_ENDPOINT = "https://api.remove.bg/v1.0/removebg";

const extractBase64 = (dataUrl: string) => {
  const [, base64] = dataUrl.split(",");
  return base64 ?? dataUrl;
};

export const POST = async (request: NextRequest) => {
  try {
    const { imageBase64 } = (await request.json()) as {
      imageBase64?: string;
    };

    if (!imageBase64) {
      return NextResponse.json(
        { error: "imageBase64 필드가 필요합니다." },
        { status: 400 },
      );
    }

    const apiKey = process.env.REMOVE_BG_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "REMOVE_BG_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요.",
        },
        { status: 501 },
      );
    }

    const base64 = extractBase64(imageBase64);
    const buffer = Buffer.from(base64, "base64");

    const formData = new FormData();
    formData.append(
      "image_file",
      new Blob([buffer], { type: "image/png" }),
      "image.png",
    );
    formData.append("size", "auto");

    const response = await fetch(REMOVE_BG_ENDPOINT, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error:
            text ||
            "remove.bg API 요청에 실패했습니다. 요청 형식과 API 키를 확인해주세요.",
        },
        { status: response.status },
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const result = Buffer.from(arrayBuffer).toString("base64");
    return NextResponse.json({
      imageBase64: `data:image/png;base64,${result}`,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "배경 제거 처리 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
};
