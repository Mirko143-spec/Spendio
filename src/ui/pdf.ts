import { statementTable, toDelimited, type PdfPage } from '../core/pdf/table.ts';

/**
 * Reading a statement PDF in the browser (docs/SPEC.md §4.5). pdf.js does the PDF work in a web
 * worker served from this site, and is only downloaded when someone picks a PDF. Nothing is
 * fetched from elsewhere; only the transaction table is kept, never the page's other text
 * (name, address, account numbers).
 */

export type PdfProblem = 'password' | 'damaged' | 'no-text' | 'no-table' | 'too-long';

export class PdfReadError extends Error {
  readonly problem: PdfProblem;

  constructor(problem: PdfProblem) {
    super(`PDF could not be read: ${problem}`);
    this.name = 'PdfReadError';
    this.problem = problem;
  }
}

/** Far more than any statement; protects the tab from huge documents. */
export const MAX_PDF_PAGES = 100;

/** True for PDF files, judged by their first bytes rather than the name or type, which can lie. */
export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
}

/** The parts of pdf.js used here, so tests can stand in for it. */
export interface PdfJs {
  getDocument(params: {
    data: Uint8Array;
    isEvalSupported: boolean;
    disableFontFace: boolean;
    useWorkerFetch: boolean;
    verbosity: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: readonly object[] }> }>;
    }>;
    /** Closes the document and frees the worker's copy of it. */
    destroy(): Promise<void>;
  };
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}
const isTextItem = (item: object): item is TextItem => 'str' in item && 'transform' in item;

/** Each page's positioned text. */
export async function readPdfPages(pdfjs: PdfJs, data: Uint8Array): Promise<PdfPage[]> {
  // No eval (the CSP forbids it), no font loading or fetching: only the text is needed. Font-data
  // warnings are about drawing text, which never happens here, so only errors are logged.
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, useWorkerFetch: false, verbosity: 0 });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    await task.destroy();
    const name = e instanceof Error ? e.name : '';
    if (name === 'PasswordException') throw new PdfReadError('password');
    if (name === 'InvalidPDFException') throw new PdfReadError('damaged');
    // Anything else (e.g. the reader itself failing to start) is not the file's fault: report it as is.
    throw e;
  }
  try {
    if (doc.numPages > MAX_PDF_PAGES) throw new PdfReadError('too-long');
    const pages: PdfPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const { items } = await (await doc.getPage(n)).getTextContent();
      pages.push(items.filter(isTextItem).map((i) => ({ text: i.str, x: i.transform[4]!, y: i.transform[5]!, width: i.width })));
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

/** The statement's table as `;`-separated text for the import pipeline. */
export function statementText(pages: readonly PdfPage[]): string {
  const table = statementTable(pages);
  if (table) return toDelimited(table);
  throw new PdfReadError(pages.some((page) => page.some((item) => item.text.trim())) ? 'no-table' : 'no-text');
}

async function loadPdfJs(): Promise<PdfJs> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs as unknown as PdfJs;
}

/** Reads a statement PDF into text the CSV pipeline imports. */
export async function readPdfStatement(data: Uint8Array): Promise<string> {
  return statementText(await readPdfPages(await loadPdfJs(), data));
}
