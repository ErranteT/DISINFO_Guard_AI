import { contentToText } from "./safe-fetch/content-to-text.ts";
import { controlledFetch, type ControlledFetchDependencies } from "./safe-fetch/controlled-fetch.ts";
import { validatePrepareUrl, type PrepareUrlValidation } from "./validate-prepare-url.ts";

export type PreparedMaterial = {
  status: "ready";
  url: string;
  finalUrl: string;
  contentType: "text/html" | "text/plain";
  text: string;
};

export async function prepareMaterial(
  value: unknown,
  dependencies: ControlledFetchDependencies = {},
): Promise<PreparedMaterial | Exclude<PrepareUrlValidation, { ok: true }>> {
  const validation = validatePrepareUrl(value);
  if (!validation.ok) return validation;
  const fetched = await controlledFetch(validation.url, dependencies);
  return {
    status: "ready",
    url: validation.url,
    finalUrl: fetched.finalUrl,
    contentType: fetched.contentType,
    text: contentToText(fetched.body, fetched.contentType),
  };
}
