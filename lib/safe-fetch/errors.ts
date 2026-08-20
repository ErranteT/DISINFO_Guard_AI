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
  UNSAFE_TARGET: "Adres prowadzi do niedozwolonego celu sieciowego.",
  DNS_RESOLUTION_FAILED: "Nie udało się rozwiązać adresu domeny.",
  FETCH_TIMEOUT: "Pobieranie materiału przekroczyło limit czasu.",
  FETCH_FAILED: "Nie udało się pobrać materiału.",
  TOO_MANY_REDIRECTS: "Adres przekroczył dozwolony limit przekierowań.",
  INVALID_REDIRECT: "Serwer zwrócił nieprawidłowe przekierowanie.",
  HTTP_ERROR: "Serwer źródłowy zwrócił nieobsługiwany status HTTP.",
  UNSUPPORTED_CONTENT_TYPE: "Podany adres nie prowadzi do obsługiwanego materiału tekstowego.",
  UNSUPPORTED_CONTENT_ENCODING: "Serwer zwrócił nieobsługiwane kodowanie transportowe.",
  UNSUPPORTED_CHARSET: "Materiał używa nieobsługiwanego kodowania znaków.",
  RESPONSE_TOO_LARGE: "Materiał przekracza dozwolony limit rozmiaru.",
  EMPTY_CONTENT: "Materiał nie zawiera użytecznej treści tekstowej.",
};

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;

  constructor(code: SafeFetchErrorCode) {
    super(messages[code]);
    this.name = "SafeFetchError";
    this.code = code;
  }
}
