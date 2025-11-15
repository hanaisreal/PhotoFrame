import { NextRequest, NextResponse } from "next/server";

export const POST = async (request: NextRequest) => {
  return NextResponse.json(
    {
      error: "Background removal is now handled client-side. Please use the client-side background removal utility instead.",
      migrationNote: "This API endpoint has been deprecated in favor of client-side processing using @imgly/background-removal"
    },
    { status: 410 }, // Gone - resource no longer available
  );
};
