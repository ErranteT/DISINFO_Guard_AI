import { NextResponse } from "next/server";
import { EvidenceSynthesisError, synthesizeEvidence } from "@/lib/evidence-synthesis";

export const runtime = "nodejs";

const internalError = {
  status: "error",
  code: "INTERNAL_ERROR",
  message: "We couldn't summarize the evidence. Please try again.",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const result = await synthesizeEvidence(body);
    if ("ok" in result && !result.ok) {
      return NextResponse.json(
        { status: "invalid_input", code: result.code, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EvidenceSynthesisError) {
      return NextResponse.json(
        { status: "error", code: error.code, message: error.message },
        { status: 502 },
      );
    }
    return NextResponse.json(internalError, { status: 500 });
  }
}
