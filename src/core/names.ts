/**
 * Display form of a private person's name from a bank export (Swish counterparties).
 * Banks often write names in capitals and sometimes surname first: "DOE,JOHN" → "John Doe",
 * "ANNA-KARIN TESTSSON" → "Anna-Karin Testsson". Display only: rules keep matching the original.
 */
export function tidyPersonName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  const comma = trimmed.indexOf(',');
  const ordered =
    comma > 0 && comma < trimmed.length - 1
      ? `${trimmed.slice(comma + 1).trim()} ${trimmed.slice(0, comma).trim()}`
      : trimmed.replace(/,/g, ' ').trim();
  // Only re-case names written all in one case; "McDonald" or "de Vries" typed by a bank stay as they are.
  const oneCase = ordered === ordered.toLocaleUpperCase('sv-SE') || ordered === ordered.toLocaleLowerCase('sv-SE');
  return oneCase ? ordered.toLocaleLowerCase('sv-SE').replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('sv-SE')) : ordered;
}
