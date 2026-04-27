const HTML_TAG_RE = /<[^>]*>/g;
const DANGEROUS_ATTRS_RE = /\s*(on\w+)\s*=\s*[^>]*/gi;
const DANGEROUS_URI_RE = /(?:javascript|vbscript)\s*:/gi;

export function sanitizeString(input: string): string {
  return input
    .replace(DANGEROUS_ATTRS_RE, "")
    .replace(DANGEROUS_URI_RE, "")
    .replace(HTML_TAG_RE, "")
    .trim();
}

export function sanitizeRecord<T extends Record<string, unknown>>(
  record: T,
  fields: (keyof T)[]
): T {
  const result = { ...record };
  for (const field of fields) {
    if (typeof result[field] === "string") {
      (result as Record<string, unknown>)[field as string] = sanitizeString(
        result[field] as string
      );
    }
  }
  return result;
}
