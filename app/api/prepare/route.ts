import { NextResponse } from "next/server";
import { validatePrepareUrl } from "@/lib/validate-prepare-url";

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
    const validation = validatePrepareUrl(url);

    if (!validation.ok) {
      return NextResponse.json(
        { status: "invalid_input", code: validation.code, message: validation.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ status: "ready", url: validation.url });
  } catch {
    return NextResponse.json(internalError, { status: 500 });
  }
}
