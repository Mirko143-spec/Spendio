// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UnsupportedFormatError } from '../core/import.ts';
import { PdfReadError } from './pdf.ts';
import { MAX_FILE_BYTES, UploadScreen } from './UploadScreen.tsx';

const csv = (text: string, name = 'statement.csv') => new File([text], name, { type: 'text/csv' });

describe('UploadScreen', () => {
  it('imports the chosen file’s text', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<UploadScreen onImport={onImport} />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV or PDF file'), csv('Bokföringsdag;Belopp\n'));
    expect(onImport).toHaveBeenCalledWith('Bokföringsdag;Belopp\n');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('imports a dropped file', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    render(<UploadScreen onImport={onImport} />);
    fireEvent.drop(screen.getByTestId('drop-zone'), { dataTransfer: { files: [csv('a;b\n')] } });
    await vi.waitFor(() => expect(onImport).toHaveBeenCalledWith('a;b\n'));
  });

  it('explains unsupported files and lets the person try again', async () => {
    const onImport = vi.fn().mockRejectedValueOnce(new UnsupportedFormatError()).mockResolvedValue(undefined);
    render(<UploadScreen onImport={onImport} />);
    const input = screen.getByLabelText('Choose a CSV or PDF file');
    await userEvent.upload(input, csv('Date,Amount\n'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This doesn’t look like a bank statement');

    await userEvent.upload(input, csv('Bokföringsdag;Belopp\n'));
    await vi.waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(onImport).toHaveBeenCalledTimes(2);
  });

  it('shows other import errors with their message', async () => {
    render(<UploadScreen onImport={vi.fn().mockRejectedValue(new Error('Disk is full'))} />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV or PDF file'), csv('x'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file couldn’t be imported: Disk is full');
  });

  it('rejects empty and oversized files without importing', async () => {
    const onImport = vi.fn();
    render(<UploadScreen onImport={onImport} />);
    const input = screen.getByLabelText('Choose a CSV or PDF file');

    await userEvent.upload(input, csv(''));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is empty');

    const huge = csv('x');
    Object.defineProperty(huge, 'size', { value: MAX_FILE_BYTES + 1 });
    await userEvent.upload(input, huge);
    expect(await screen.findByRole('alert')).toHaveTextContent('larger than 10 MB');
    expect(onImport).not.toHaveBeenCalled();
  });
});

describe('UploadScreen sample data', () => {
  it('offers sample data only when asked to, and loads it', async () => {
    const onTrySample = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<UploadScreen onImport={vi.fn()} onTrySample={onTrySample} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try Spendio with sample data' }));
    expect(onTrySample).toHaveBeenCalled();
    unmount();
    render(<UploadScreen onImport={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sample data/ })).not.toBeInTheDocument();
  });
});

describe('UploadScreen PDF statements', () => {
  const pdf = () => new File(['%PDF-1.7\n(invented)'], 'kontohandelser.pdf', { type: 'application/pdf' });

  it('reads a PDF into its transaction table and imports that', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const readPdf = vi.fn().mockResolvedValue('Datum;Namn;Belopp;Saldo\n2026-11-18;Kortköp ICA;-5,00;95,00');
    render(<UploadScreen onImport={onImport} readPdf={readPdf} />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV or PDF file'), pdf());
    await vi.waitFor(() => expect(onImport).toHaveBeenCalledWith('Datum;Namn;Belopp;Saldo\n2026-11-18;Kortköp ICA;-5,00;95,00'));
    expect(new TextDecoder().decode(readPdf.mock.calls[0]![0] as Uint8Array)).toMatch(/^%PDF-/);
  });

  it('reads other files as text, without the PDF reader', async () => {
    const onImport = vi.fn().mockResolvedValue(undefined);
    const readPdf = vi.fn();
    render(<UploadScreen onImport={onImport} readPdf={readPdf} />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV or PDF file'), new File(['Datum;Namn\n'], 'a.csv'));
    await vi.waitFor(() => expect(onImport).toHaveBeenCalledWith('Datum;Namn\n'));
    expect(readPdf).not.toHaveBeenCalled();
  });

  it('explains a PDF that has no text, such as a scan', async () => {
    const onImport = vi.fn();
    render(<UploadScreen onImport={onImport} readPdf={() => Promise.reject(new PdfReadError('no-text'))} />);
    await userEvent.upload(screen.getByLabelText('Choose a CSV or PDF file'), pdf());
    expect(await screen.findByRole('alert')).toHaveTextContent('This PDF has no text in it, only images');
    expect(onImport).not.toHaveBeenCalled();
  });
});
