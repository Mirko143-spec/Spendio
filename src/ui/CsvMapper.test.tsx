// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CsvMapper } from './CsvMapper.tsx';

const fixture = readFileSync(join(import.meta.dirname, '../../fixtures/generic-sample.csv'), 'utf8');

function setup(text = fixture) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(
    <CsvMapper text={text} onSave={onSave} onCancel={onCancel} newId={() => 'new-id'} now={() => '2026-11-18T12:00:00.000Z'} />,
  );
  return { onSave, onCancel, user: userEvent.setup() };
}
const preview = () => screen.getByRole('region', { name: 'Preview' });

describe('CsvMapper', () => {
  it('starts from Spendio’s guesses for the file', () => {
    setup();
    expect(screen.getByLabelText('Date')).toHaveValue('0');
    expect(screen.getByLabelText('Description')).toHaveValue('1');
    expect(screen.getByLabelText('Balance (optional)')).toHaveValue('5');
    expect(screen.getByRole('radio', { name: 'Separate columns for money out and money in' })).toBeChecked();
    expect(screen.getByLabelText('Money out')).toHaveValue('3');
    expect(screen.getByLabelText('Money in')).toHaveValue('4');
    expect(screen.getByLabelText('Dates look like')).toHaveValue('DD/MM/YYYY');
    expect(screen.getByLabelText('Decimals are written with')).toHaveValue('.');
    expect(screen.getByLabelText('Columns are separated by')).toHaveValue(',');
  });

  it('shows the file and labels column choices with an example value', () => {
    setup();
    expect(within(screen.getByRole('region', { name: 'The file' })).getAllByRole('columnheader')).toHaveLength(6);
    expect(within(screen.getByLabelText('Date')).getByRole('option', { name: 'Date, e.g. 20/10/2026' })).toBeInTheDocument();
  });

  it('previews the first rows exactly as they will import', () => {
    setup();
    const rows = within(preview()).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('ICA NARA TESTBY');
    expect(within(rows[0]!).getByLabelText('minus 312,40 kr', { exact: false })).toBeInTheDocument();
    expect(within(rows[1]!).getByText('23 Oct')).toBeInTheDocument();
  });

  it('explains lines that cannot be read with the chosen settings', async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText('Dates look like'), 'YYYY-MM-DD');
    expect(within(preview()).getByRole('alert')).toHaveTextContent('9 of 9 lines can’t be read with these settings:');
    expect(within(preview()).getByRole('alert')).toHaveTextContent('Line 2: Invalid date: "20/10/2026" (expected YYYY-MM-DD)');
    expect(screen.getByRole('button', { name: 'Save and import' })).toBeDisabled();
  });

  it('needs a bank name, then saves the mapping', async () => {
    const { onSave, user } = setup();
    expect(screen.getByRole('button', { name: 'Save and import' })).toBeDisabled();
    await user.type(screen.getByLabelText('Which bank is this?'), ' Testbank ');
    await user.click(screen.getByRole('button', { name: 'Save and import' }));
    expect(onSave).toHaveBeenCalledWith({
      id: 'new-id',
      headerSignature: 'date,description,reference,debit,credit,balance',
      name: 'Testbank',
      delimiter: ',',
      dateFormat: 'DD/MM/YYYY',
      decimal: '.',
      columns: { date: 0, description: [1], debit: 3, credit: 4, balance: 5 },
      createdAt: '2026-11-18T12:00:00.000Z',
    });
  });

  it('switches to a single amount column, waiting until one is chosen', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('radio', { name: 'One column (negative = money out)' }));
    expect(screen.getByLabelText('Amount')).toHaveValue('');
    expect(within(preview()).getByText(/Choose the date, description and amount columns/)).toBeInTheDocument();
  });

  it('can add a second description column', async () => {
    const { onSave, user } = setup();
    await user.selectOptions(screen.getByLabelText('More description (optional)'), '2');
    expect(within(preview()).getAllByRole('listitem')[0]).toHaveTextContent('ICA NARA TESTBY REF1001');
    await user.type(screen.getByLabelText('Which bank is this?'), 'Testbank');
    await user.click(screen.getByRole('button', { name: 'Save and import' }));
    expect(onSave.mock.calls[0]![0].columns.description).toEqual([1, 2]);
  });

  it('re-reads the file when the separator is changed', async () => {
    const { user } = setup('Datum;Text;Belopp\n2026-11-01;ICA;-12,50\n');
    expect(screen.getByLabelText('Columns are separated by')).toHaveValue(';');
    await user.selectOptions(screen.getByLabelText('Columns are separated by'), ',');
    // The header has no commas, so with a comma separator the whole header is one column.
    expect(within(screen.getByRole('region', { name: 'The file' })).getAllByRole('columnheader')).toHaveLength(1);
  });

  it('cancels', async () => {
    const { onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
