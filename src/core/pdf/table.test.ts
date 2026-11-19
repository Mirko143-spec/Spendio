import { describe, expect, it } from 'vitest';
import { statementTable, toDelimited, type PdfTextItem } from './table.ts';

// Text item at (x, y); width approximated from the text, as a 9pt font would set it.
const t = (x: number, y: number, text: string): PdfTextItem => ({ text, x, y, width: text.length * 4.6 });
// A transaction line in the layout: date, description, right-aligned amount and balance.
const row = (y: number, date: string, text: string, amount: string, balance: string) => [
  t(28, y, date),
  t(113, y, text),
  t(340 - amount.length * 4.6, y, amount),
  t(570 - balance.length * 4.6, y, balance),
];

const page1 = [
  t(480, 799, 'Skapad av EXEMPEL,PERSON'),
  t(28, 757, 'Summering kontoutdrag'),
  t(28, 729, 'Konto'),
  t(454, 729, 'Period'),
  t(28, 717, 'Namn:'),
  t(113, 717, 'PERSONKONTO'),
  t(454, 717, 'Från:'),
  t(521, 717, '2026-10-21'),
  t(28, 587, 'Kontohändelser från 2026-10-21 till 2026-11-19'),
  t(28, 564, 'Datum'),
  t(113, 564, 'Namn'),
  t(309, 564, 'Belopp'),
  t(542, 564, 'Saldo'),
  t(28, 553, 'Ej bokfört'),
  t(28, 541, 'Reserverat'),
  t(113, 541, 'Reservation Kortköp EXEMPELKIOSKEN'),
  t(324, 541, '-9,90'),
  t(28, 519, 'November 2026'),
  ...row(507, '2026-11-18', 'Kortköp 261117 WILLYS EXEMPEL', '-412,50', '2 087,50'),
  ...row(496, '2026-11-17', 'Swish inbetalning EVA PROV', '150,00', '2 500,00'),
];
const page2 = [
  t(480, 799, 'Skapad av EXEMPEL,PERSON'),
  t(493, 789, '2026-11-19 10:00:00'),
  ...row(757, '2026-10-25', 'LÖN Exempelbolaget AB', '28 000,00', '2 350,00'),
  t(28, 128, 'Ingående saldo:'),
  t(532, 128, '-25 650,00'),
  t(28, 85, 'Utgående saldo:'),
  t(532, 85, '2 087,50'),
  t(28, 14, 'Ekonomi > Konton > Kontohändelser & detaljer'),
  t(527, 14, 'Sida 2 av 2'),
];

describe('statementTable', () => {
  it('reads the transaction table across pages and drops everything around it', () => {
    expect(statementTable([page1, page2])).toEqual({
      header: ['Datum', 'Namn', 'Belopp', 'Saldo'],
      rows: [
        ['2026-11-18', 'Kortköp 261117 WILLYS EXEMPEL', '-412,50', '2 087,50'],
        ['2026-11-17', 'Swish inbetalning EVA PROV', '150,00', '2 500,00'],
        ['2026-10-25', 'LÖN Exempelbolaget AB', '28 000,00', '2 350,00'],
      ],
    });
  });

  it('works whatever order the items come in, and skips a header repeated on later pages', () => {
    const repeated = [t(28, 780, 'Datum'), t(113, 780, 'Namn'), t(309, 780, 'Belopp'), t(542, 780, 'Saldo'), ...page2];
    const table = statementTable([[...page1].reverse(), repeated]);
    expect(table?.rows.map((r) => r[0])).toEqual(['2026-11-18', '2026-11-17', '2026-10-25']);
  });

  it('joins text split into several pieces within one cell', () => {
    const split = [t(28, 564, 'Datum'), t(113, 564, 'Text'), t(309, 564, 'Belopp'), t(28, 540, '2026-11-18'), t(113, 540, 'Kortköp'), t(150, 540, 'ICA'), t(320, 540, '-5,00')];
    expect(statementTable([split])?.rows).toEqual([['2026-11-18', 'Kortköp ICA', '-5,00']]);
  });

  it('finds no table without a header followed by dated rows', () => {
    expect(statementTable([])).toBeNull();
    expect(statementTable([[t(28, 700, 'Datum'), t(113, 700, 'Namn'), t(309, 700, 'Belopp'), t(28, 600, 'Inga händelser')]])).toBeNull();
    expect(statementTable([[t(28, 700, 'Just a letter with no table at all')]])).toBeNull();
  });
});

describe('toDelimited', () => {
  it('writes ;-separated lines, quoting cells that need it', () => {
    expect(toDelimited({ header: ['Datum', 'Namn'], rows: [['2026-11-18', 'A;B "C"']] })).toBe('Datum;Namn\n2026-11-18;"A;B ""C"""');
  });
});
