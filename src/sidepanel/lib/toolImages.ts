const DATA_URL_RE = /^data:image\/[a-zA-Z0-9.+-]+;base64,/i;

/** Pull image data-URLs out of a tool result so we can render them as <img>. */
export function extractImages(result: unknown): string[] {
  const images: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string' && DATA_URL_RE.test(value)) {
      images.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };
  walk(result);
  return images;
}

/** Replace image data-URLs with a short placeholder for the raw JSON view. */
export function redactImages(value: unknown): unknown {
  if (typeof value === 'string') {
    return DATA_URL_RE.test(value) ? `[image ${Math.round(value.length / 1024)}KB]` : value;
  }
  if (Array.isArray(value)) return value.map(redactImages);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactImages(v)]),
    );
  }
  return value;
}

export function imagesFromToolCalls(
  calls: { status: string; result?: unknown }[],
): string[] {
  return calls
    .filter((c) => c.status === 'done')
    .flatMap((c) => extractImages(c.result));
}
