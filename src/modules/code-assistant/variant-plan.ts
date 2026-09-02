export interface AIVariantOption {
  id: string;
  title: string;
  direction: string;
  instruction: string;
  tradeoffs: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateVariantOptions(value: unknown): AIVariantOption[] {
  if (!isRecord(value) || !Array.isArray(value.variants)) {
    throw new Error('AI did not return a valid variants object.');
  }

  const output: AIVariantOption[] = [];
  const seenIds = new Set<string>();

  for (const raw of value.variants.slice(0, 4)) {
    if (!isRecord(raw)) continue;
    const title = cleanText(raw.title, 100);
    const direction = cleanText(raw.direction, 500);
    const instruction = cleanText(raw.instruction, 1_500);
    if (!title || !direction || !instruction) continue;

    const rawId = cleanText(raw.id, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const id = rawId || `variant-${output.length + 1}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const tradeoffs = Array.isArray(raw.tradeoffs)
      ? raw.tradeoffs
          .map((entry) => cleanText(entry, 240))
          .filter(Boolean)
          .slice(0, 4)
      : [];

    output.push({ id, title, direction, instruction, tradeoffs });
  }

  if (output.length < 2) throw new Error('AI returned too few usable variant options.');
  return output;
}
