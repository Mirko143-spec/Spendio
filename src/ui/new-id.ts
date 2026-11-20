/**
 * A random ID (UUID v4) for new transactions, categories, rules and budgets.
 *
 * Built from `crypto.getRandomValues`, which every browser has on every page. `crypto.randomUUID`
 * is missing on plain-HTTP pages (it needs a secure context) and in older Safari, where it made
 * importing and the sample data fail.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
