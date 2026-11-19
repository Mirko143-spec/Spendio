/**
 * Turns a statement PDF's text into a table (docs/SPEC.md §4.3), so PDFs go through the same
 * pipeline as CSV files: bank presets, the column mapper, dedup and categorization.
 *
 * A text PDF has no rows or columns, only pieces of text placed on the page. Statements still
 * print a table, so: find its header row, sort every line below it into the header's columns by
 * position, and keep the lines that have a date in the date column. Everything else on the page
 * (account details above the table, month headings, pending rows, totals) is dropped.
 */

export interface PdfTextItem {
  text: string;
  /** Left edge and baseline, in PDF units (y grows upwards). */
  x: number;
  y: number;
  width: number;
}

/** One page's text items, in any order. */
export type PdfPage = readonly PdfTextItem[];

export interface StatementTable {
  header: string[];
  rows: string[][];
}

/** Items whose baselines are this close (PDF units) are on the same line. */
const LINE_TOLERANCE = 3;
/** How many lines below a header candidate a dated row must appear for it to count as the header. */
const HEADER_LOOKAHEAD = 6;

const DATE = /^(?:\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{2,4})$/;
const isDate = (text: string) => DATE.test(text.trim());

type Line = PdfTextItem[];

/** Groups a page's items into lines, top to bottom, each sorted left to right. */
function linesOf(page: PdfPage): Line[] {
  const lines: { y: number; items: Line }[] = [];
  for (const item of page) {
    if (!item.text.trim()) continue;
    const line = lines.find((l) => Math.abs(l.y - item.y) <= LINE_TOLERANCE);
    if (line) line.items.push(item);
    else lines.push({ y: item.y, items: [item] });
  }
  return lines.sort((a, b) => b.y - a.y).map((l) => l.items.sort((a, b) => a.x - b.x));
}

const textOf = (line: Line) => line.map((i) => i.text.trim()).join(' ');

/** A header: at least three cells, no digits, and dated rows right below it. */
function isHeader(lines: readonly Line[], index: number): boolean {
  const line = lines[index]!;
  if (line.length < 3 || /\d/.test(textOf(line))) return false;
  return lines.slice(index + 1, index + 1 + HEADER_LOOKAHEAD).some((l) => l.some((i) => isDate(i.text)));
}

/** The header column an item belongs to: the one it overlaps most, else the nearest. */
function columnOf(item: PdfTextItem, header: Line): number {
  let best = 0;
  let bestScore = -Infinity;
  header.forEach((h, i) => {
    const overlap = Math.min(item.x + item.width, h.x + h.width) - Math.max(item.x, h.x);
    const score = overlap > 0 ? overlap : -Math.abs(item.x + item.width / 2 - (h.x + h.width / 2));
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

export function statementTable(pages: readonly PdfPage[]): StatementTable | null {
  const all = pages.flatMap(linesOf);
  const start = all.findIndex((_, i) => isHeader(all, i));
  if (start < 0) return null;

  const headerLine = all[start]!;
  const header = headerLine.map((i) => i.text.trim());
  const headerText = textOf(headerLine);

  const candidates = all
    .slice(start + 1)
    .filter((line) => textOf(line) !== headerText) // header repeated on later pages
    .map((line) => {
      const cells = header.map((): string[] => []);
      for (const item of line) cells[columnOf(item, headerLine)]!.push(item.text.trim());
      return cells.map((parts) => parts.join(' '));
    });

  // The date column is the one most rows have a date in; rows without one there aren't transactions.
  const dateCounts = header.map((_, c) => candidates.filter((cells) => isDate(cells[c]!)).length);
  const dateColumn = dateCounts.indexOf(Math.max(...dateCounts));
  const rows = candidates.filter((cells) => isDate(cells[dateColumn]!));

  return rows.length > 0 ? { header, rows } : null;
}

/** The table as `;`-separated text, the shape the CSV pipeline reads. */
export function toDelimited(table: StatementTable): string {
  const cell = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [table.header, ...table.rows].map((cells) => cells.map(cell).join(';')).join('\n');
}
