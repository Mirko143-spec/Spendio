/**
 * Merchant name cleanup (docs/SPEC.md §5). Bank descriptions carry noise — payment-processor
 * prefixes, store numbers, reference codes — that would stop "ROBLOX.COM 188885825" and
 * "ROBLOX.COM 202233" from being recognized as the same merchant.
 */

export interface Merchant {
  /** Uppercased, for rule matching and grouping. */
  key: string;
  /** Cleaned name in its original casing, for display. */
  display: string;
}

// Payment processors that prefix the real merchant name, e.g. "NMB*Nybergs Konditor", "WL *STEAM PURCHASE".
// An explicit allowlist: a generic "WORD*" rule would also eat real names like "ANTHROPIC* CLAUDE".
const PROCESSOR_PREFIX = /^(?:NMB|WL|PAYPAL|SQ|SUMUP|IZ|ZETTLE|KLARNA)\s*[*_]+\s*/i;

// Trailing tokens that are references, not part of the name:
//   pure digits ("398", "188885825"), star codes containing a digit ("*BB4SS7W", but not "*EATS"),
//   and long letter+digit codes ("P4938CFA38"; short ones like "ST1" are real names).
const NOISE_TOKEN = /^(?:\d+|\*(?=\w*\d)\w+|(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{6,})$/i;

export function cleanMerchant(counterparty: string): Merchant {
  let tokens = counterparty
    .trim()
    .replace(PROCESSOR_PREFIX, '')
    .split(/\s+/)
    .filter(Boolean);

  // Strip trailing noise, but never the first token: "7" or "1177" alone is still a name.
  while (tokens.length > 1 && NOISE_TOKEN.test(tokens[tokens.length - 1]!)) tokens = tokens.slice(0, -1);

  const display = tokens
    .join(' ')
    .replace(/\s*\*\s*/g, ' ') // "ANTHROPIC* CLAUDE SU" → "ANTHROPIC CLAUDE SU"
    .replace(/\s+/g, ' ')
    .trim();

  return { key: display.toLocaleUpperCase('sv-SE'), display };
}
