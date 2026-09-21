export type SafeFetchErrorCode =
  | "UNSAFE_TARGET"
  | "DNS_RESOLUTION_FAILED"
  | "FETCH_TIMEOUT"
  | "FETCH_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "INVALID_REDIRECT"
  | "HTTP_ERROR"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "UNSUPPORTED_CONTENT_ENCODING"
  | "UNSUPPORTED_CHARSET"
  | "RESPONSE_TOO_LARGE"
  | "EMPTY_CONTENT";

const messages: Record<SafeFetchErrorCode, string> = {
  UNSAFE_TARGET: "The URL points to a prohibited network target.",
  DNS_RESOLUTION_FAILED: "The domain name could not be resolved.",
  FETCH_TIMEOUT: "Retrieving the material timed out.",
  FETCH_FAILED: "The material could not be retrieved.",
  TOO_MANY_REDIRECTS: "The URL exceeded the allowed redirect limit.",
  INVALID_REDIRECT: "The server returned an invalid redirect.",
  HTTP_ERROR: "The source server returned an unsupported HTTP status.",
  UNSUPPORTED_CONTENT_TYPE: "The URL does not point to supported text content.",
  UNSUPPORTED_CONTENT_ENCODING: "The server returned an unsupported content encoding.",
  UNSUPPORTED_CHARSET: "The material uses an unsupported character encoding.",
  RESPONSE_TOO_LARGE: "The material exceeds the allowed size limit.",
  EMPTY_CONTENT: "The material does not contain usable text content.",
};

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;

  constructor(code: SafeFetchErrorCode) {
    super(messages[code]);
    this.name = "SafeFetchError";
    this.code = code;
  }
}
