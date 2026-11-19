import { describe, expect, it, vi } from 'vitest';
import { isPdf, MAX_PDF_PAGES, PdfReadError, readPdfPages, statementText, type PdfJs } from './pdf.ts';

const bytes = (text: string) => new TextEncoder().encode(text);
const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y], width: str.length * 5 });

function fakePdfJs(pages: object[][], fail?: string): PdfJs & { destroy: ReturnType<typeof vi.fn> } {
  const destroy = vi.fn().mockResolvedValue(undefined);
  return {
    destroy,
    getDocument: () => ({
      promise: fail
        ? Promise.reject(Object.assign(new Error(fail), { name: fail }))
        : Promise.resolve({
            numPages: pages.length,
            getPage: async (n: number) => ({ getTextContent: async () => ({ items: pages[n - 1]! }) }),
          }),
      destroy,
    }),
  };
}

const problem = (promise: Promise<unknown>) =>
  promise.then(
    () => 'no error',
    (e: unknown) => (e instanceof PdfReadError ? e.problem : String(e)),
  );

describe('isPdf', () => {
  it('goes by the file’s first bytes', () => {
    expect(isPdf(bytes('%PDF-1.7\n…'))).toBe(true);
    expect(isPdf(bytes('Datum;Namn'))).toBe(false);
    expect(isPdf(bytes(''))).toBe(false);
  });
});

describe('readPdfPages', () => {
  it('returns each page’s positioned text, skipping non-text items, and closes the document', async () => {
    const pdfjs = fakePdfJs([[item('Datum', 28, 564), { type: 'beginMarkedContent' }], [item('2026-11-18', 28, 700)]]);
    expect(await readPdfPages(pdfjs, bytes('%PDF-'))).toEqual([
      [{ text: 'Datum', x: 28, y: 564, width: 25 }],
      [{ text: '2026-11-18', x: 28, y: 700, width: 50 }],
    ]);
    expect(pdfjs.destroy).toHaveBeenCalled();
  });

  it('says why a PDF can’t be opened', async () => {
    expect(await problem(readPdfPages(fakePdfJs([], 'PasswordException'), bytes('%PDF-')))).toBe('password');
    expect(await problem(readPdfPages(fakePdfJs([], 'InvalidPDFException'), bytes('%PDF-')))).toBe('damaged');
    // A failure of the reader itself isn't blamed on the file.
    expect(await problem(readPdfPages(fakePdfJs([], 'WorkerError'), bytes('%PDF-')))).toBe('WorkerError: WorkerError');
    const huge = fakePdfJs(Array.from({ length: MAX_PDF_PAGES + 1 }, () => []));
    expect(await problem(readPdfPages(huge, bytes('%PDF-')))).toBe('too-long');
    expect(huge.destroy).toHaveBeenCalled();
  });
});

describe('statementText', () => {
  const t = (text: string, x: number, y: number) => ({ text, x, y, width: text.length * 5 });

  it('turns the statement table into ;-separated text', () => {
    const page = [t('Datum', 28, 564), t('Namn', 113, 564), t('Belopp', 309, 564), t('2026-11-18', 28, 540), t('Kortköp ICA', 113, 540), t('-5,00', 315, 540)];
    expect(statementText([page])).toBe('Datum;Namn;Belopp\n2026-11-18;Kortköp ICA;-5,00');
  });

  it('tells a scanned PDF (no text) from one without a transaction table', async () => {
    expect(await problem(Promise.resolve().then(() => statementText([[], []])))).toBe('no-text');
    expect(await problem(Promise.resolve().then(() => statementText([[t('Dear customer', 28, 700)]])))).toBe('no-table');
  });
});
