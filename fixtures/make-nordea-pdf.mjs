// Generates fixtures/nordea-pdf-sample.pdf: an invented two-page transaction list laid out like
// Nordea's PDF ("Kontohändelser"): account summary, a Datum/Namn/Belopp/Saldo table with a
// pending row and month heading, a page break, and a totals box. All data is made up; the only
// ID is the 000000-0000 placeholder. Run: node fixtures/make-nordea-pdf.mjs
import { writeFileSync } from 'node:fs';

// Helvetica advance widths (1/1000 em) for the characters used in numbers, to right-align amounts.
const WIDTHS = { ' ': 278, ',': 278, '-': 333, '.': 278 };
const textWidth = (text, size) => [...text].reduce((w, c) => w + (WIDTHS[c] ?? 556), 0) * (size / 1000);

// PDF string in WinAnsiEncoding (å, ä, ö are Latin-1), with ( ) \ escaped.
const pdfString = (text) =>
  '(' +
  [...text]
    .map((c) => {
      const code = c.charCodeAt(0);
      if (c === '(' || c === ')' || c === '\\') return '\\' + c;
      return code > 126 ? '\\' + code.toString(8).padStart(3, '0') : c;
    })
    .join('') +
  ')';

const SIZE = 8;
const at = (x, y, text, size = SIZE) => `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y} Tm ${pdfString(text)} Tj ET`;
const right = (edge, y, text) => at(edge - textWidth(text, SIZE), y, text);
const row = (y, date, text, amount, balance) => [at(28, y, date), at(113, y, text), right(336, y, amount), right(568, y, balance)];

const header = [at(480, 799, 'Skapad av PROV,PERSON', 7), at(493, 789, '2026-11-19 09:30:00', 7)];
const page1 = [
  ...header,
  at(28, 757, 'Summering kontoutdrag', 12),
  at(28, 729, 'Konto'),
  at(454, 729, 'Period'),
  at(28, 717, 'Namn:'),
  at(113, 717, 'PRIVATKONTO'),
  at(454, 717, 'Från:'),
  at(521, 717, '2026-10-20'),
  at(28, 706, 'Kontonummer:'),
  at(113, 706, '000000-0000'),
  at(454, 706, 'Till:'),
  at(521, 706, '2026-11-19'),
  at(28, 587, 'Kontohändelser från 2026-10-20 till 2026-11-19', 10),
  at(28, 564, 'Datum'),
  at(113, 564, 'Namn'),
  at(309, 564, 'Belopp'),
  at(542, 564, 'Saldo'),
  at(28, 553, 'Ej bokfört'),
  at(28, 541, 'Reserverat'),
  at(113, 541, 'Reservation Kortköp EXEMPELKIOSKEN'),
  right(336, 541, '-24,00'),
  at(28, 519, 'November 2026'),
  ...row(507, '2026-11-18', 'Kortköp 261117 WILLYS EXEMPELGATAN', '-412,50', '9 618,40'),
  ...row(496, '2026-11-17', 'Swish inbetalning EVA PROV', '150,00', '10 030,90'),
  ...row(485, '2026-11-14', 'Autogiro Exempelbostäder AB', '-7 450,00', '9 880,90'),
  ...row(473, '2026-11-12', 'Kortköp 261111 ESPRESSO HOUSE 12', '-62,00', '17 330,90'),
  ...row(462, '2026-11-10', 'Swish betalning OLLE TEST', '-300,00', '17 392,90'),
];
const page2 = [
  ...header,
  ...row(757, '2026-11-05', 'Kortköp 261104 SL APP', '-1 060,00', '17 692,90'),
  ...row(746, '2026-10-27', 'Autogiro Vattenfall', '-2 000,00', '18 752,90'),
  at(28, 734, 'Oktober 2026'),
  ...row(723, '2026-10-23', 'LÖN Exempelbolaget AB', '19 500,00', '20 752,90'),
  at(28, 142, 'Saldon på kontoutdraget', 10),
  at(28, 128, 'Ingående saldo:'),
  right(568, 128, '1 252,90'),
  at(28, 113, 'Utbetalningar (6):'),
  right(568, 113, '-11 284,50'),
  at(28, 99, 'Inbetalningar (2):'),
  right(568, 99, '19 650,00'),
  at(28, 85, 'Utgående saldo:'),
  right(568, 85, '9 618,40'),
  at(28, 28, 'Det här dokumentet har skapats via'),
  at(28, 14, 'Ekonomi > Konton > Kontohändelser & detaljer'),
  at(527, 14, 'Sida 2 av 2'),
];

// Objects: 1 catalog, 2 page tree, 3 font, then a page and its content stream per page.
const pages = [page1, page2];
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
];
for (const [i, ops] of pages.entries()) {
  const stream = ops.join('\n');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
  objects.push(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
}

let pdf = '%PDF-1.4\n';
const offsets = objects.map((body, i) => {
  const offset = Buffer.byteLength(pdf, 'latin1');
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  return offset;
});
const xref = Buffer.byteLength(pdf, 'latin1');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

writeFileSync(new URL('./nordea-pdf-sample.pdf', import.meta.url), Buffer.from(pdf, 'latin1'));
