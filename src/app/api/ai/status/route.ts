import { NextResponse } from "next/server";
import { checkAIConnection } from "@/lib/ai/AIConnectionStatus";
import { defaultAISettings } from "@/lib/ai/ObservationAI";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get("model") || defaultAISettings.model;
  const status = await checkAIConnection(model);
  return NextResponse.json(status);
}
