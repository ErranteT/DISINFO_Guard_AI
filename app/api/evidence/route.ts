import { NextResponse } from "next/server";
import { EvidenceRetrievalError, retrieveEvidence } from "@/lib/evidence-retrieval";

export const runtime = "nodejs";

const internalError = {
  status: "error",
  code: "INTERNAL_ERROR",
  message: "We couldn't search for evidence. Please try again.",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const result = await retrieveEvidence(body);
    if ("ok" in result && !result.ok) {
      return NextResponse.json(
        { status: "invalid_input", code: result.code, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EvidenceRetrievalError) {
      const status = error.code === "EVIDENCE_PROVIDER_TIMEOUT" ? 504
        : error.code === "EVIDENCE_RATE_LIMITED" ? 429
        : error.code === "EVIDENCE_CONFIGURATION_ERROR" ? 500
        : 502;
      return NextResponse.json(
        { status: "error", code: error.code, message: error.message },
        { status },
      );
    }
    return NextResponse.json(internalError, { status: 500 });
  }
}
