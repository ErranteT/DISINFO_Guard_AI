import { NextResponse } from "next/server";
import { ClaimExtractorError } from "@/lib/claim-extractor";
import { prepareClaimFlow } from "@/lib/claim-flow";
import { SafeFetchError } from "@/lib/safe-fetch/errors";

export const runtime = "nodejs";

const internalError = {
  status: "error",
  code: "INTERNAL_ERROR",
  message: "We couldn't prepare the URL for analysis. Please try again.",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const result = await prepareClaimFlow(body);

    if ("ok" in result && !result.ok) {
      return NextResponse.json(
        { status: "invalid_input", code: result.code, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SafeFetchError) {
      const status = error.code === "FETCH_TIMEOUT" ? 504
        : error.code === "RESPONSE_TOO_LARGE" ? 413
        : error.code === "UNSAFE_TARGET" || error.code === "INVALID_REDIRECT" || error.code === "TOO_MANY_REDIRECTS" ? 400
        : 422;
      return NextResponse.json(
        { status: "error", code: error.code, message: error.message },
        { status },
      );
    }
    if (error instanceof ClaimExtractorError) {
      const status = error.code === "CLAIM_PROVIDER_TIMEOUT" ? 504
        : error.code === "CLAIM_RATE_LIMITED" ? 429
        : error.code === "CLAIM_CONFIGURATION_ERROR" ? 500
        : 502;
      return NextResponse.json(
        { status: "error", code: error.code, message: error.message },
        { status },
      );
    }
    return NextResponse.json(internalError, { status: 500 });
  }
}
