import { NextResponse } from "next/server";
import { analyzeEvidence, EvidenceAnalysisError } from "@/lib/evidence-analysis";

export const runtime = "nodejs";

const internalError = {
  status: "error",
  code: "INTERNAL_ERROR",
  message: "We couldn't analyze the evidence. Please try again.",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const result = await analyzeEvidence(body);
    if ("ok" in result && !result.ok) {
      return NextResponse.json(
        { status: "invalid_input", code: result.code, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EvidenceAnalysisError) {
      return NextResponse.json(
        { status: "error", code: error.code, message: error.message },
        { status: 502 },
      );
    }
    return NextResponse.json(internalError, { status: 500 });
  }
}
