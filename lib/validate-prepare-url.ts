export type PrepareUrlErrorCode =
  | "URL_REQUIRED"
  | "INVALID_URL"
  | "UNSUPPORTED_PROTOCOL"
  | "LOCAL_URL_NOT_ALLOWED";

type ValidationSuccess = { ok: true; url: string };
type ValidationFailure = { ok: false; code: PrepareUrlErrorCode; message: string };

export type PrepareUrlValidation = ValidationSuccess | ValidationFailure;

const messages: Record<PrepareUrlErrorCode, string> = {
  URL_REQUIRED: "Podaj adres URL.",
  INVALID_URL: "Podaj prawidłowy adres URL.",
  UNSUPPORTED_PROTOCOL: "Adres URL musi zaczynać się od http:// lub https://.",
  LOCAL_URL_NOT_ALLOWED: "Lokalne adresy URL nie są dozwolone.",
};

function invalid(code: PrepareUrlErrorCode): ValidationFailure {
  return { ok: false, code, message: messages[code] };
}

function isBlockedLocalHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  return (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost === "::1" ||
    normalizedHost.startsWith("127.")
  );
}

export function validatePrepareUrl(value: unknown): PrepareUrlValidation {
  if (value === undefined || value === null) {
    return invalid("URL_REQUIRED");
  }

  if (typeof value !== "string") {
    return invalid("INVALID_URL");
  }

  const url = value.trim();
  if (!url) {
    return invalid("URL_REQUIRED");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return invalid("INVALID_URL");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return invalid("UNSUPPORTED_PROTOCOL");
  }

  if (isBlockedLocalHost(parsedUrl.hostname)) {
    return invalid("LOCAL_URL_NOT_ALLOWED");
  }

  return { ok: true, url };
}
