import { NextResponse } from "next/server";
import { prepareMaterial } from "@/lib/prepare-material";
import { SafeFetchError } from "@/lib/safe-fetch/errors";

export const runtime = "nodejs";

const internalError = {
  status: "error",
  code: "INTERNAL_ERROR",
  message: "Nie udało się przygotować adresu do analizy. Spróbuj ponownie.",
};

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }

    const url =
      typeof body === "object" && body !== null && "url" in body
        ? (body as { url: unknown }).url
        : undefined;
    const result = await prepareMaterial(url);

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
    return NextResponse.json(internalError, { status: 500 });
  }
}
