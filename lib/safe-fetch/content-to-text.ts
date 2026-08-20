import { parse, type DefaultTreeAdapterMap } from "parse5";
import { SafeFetchError } from "./errors.ts";

type Node = DefaultTreeAdapterMap["node"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function findBody(node: Node): Node | undefined {
  if (node.nodeName === "body") return node;
  if ("childNodes" in node) {
    for (const child of node.childNodes) {
      const body = findBody(child);
      if (body) return body;
    }
  }
}

function collectText(node: Node, output: string[]): void {
  if (["script", "style", "noscript"].includes(node.nodeName)) return;
  if (node.nodeName === "#text" && "value" in node) output.push(node.value);
  if ("childNodes" in node) {
    for (const child of (node as ParentNode).childNodes) collectText(child, output);
  }
}

export function contentToText(body: Uint8Array, contentType: "text/html" | "text/plain"): string {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(body);
  let text: string;
  if (contentType === "text/plain") {
    text = normalizeWhitespace(decoded);
  } else {
    const document = parse(decoded);
    const output: string[] = [];
    collectText(findBody(document) ?? document, output);
    text = normalizeWhitespace(output.join(" "));
  }
  if (!text) throw new SafeFetchError("EMPTY_CONTENT");
  return text;
}
