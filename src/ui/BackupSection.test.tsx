// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createBackup, serializeBackup } from '../core/backup.ts';
import { DEFAULT_CATEGORIES } from '../core/categories.ts';
import { DEFAULT_SETTINGS } from '../core/settings.ts';
import { BackupSection } from './BackupSection.tsx';

const backupFile = (text: string) => new File([text], 'spendio-backup-2026-11-18.json', { type: 'application/json' });
const emptyBackup = () =>
  serializeBackup(
    createBackup(
      { accounts: [], importBatches: [], transactions: [], categories: [...DEFAULT_CATEGORIES], rules: [], budgets: [], csvMappings: [], settings: DEFAULT_SETTINGS },
      '2026-11-18T09:00:00.000Z',
    ),
  );

function setup() {
  const onExport = vi.fn().mockResolvedValue(undefined);
  const onRestore = vi.fn().mockResolvedValue(undefined);
  render(<BackupSection onExport={onExport} onRestore={onRestore} />);
  return { onExport, onRestore, user: userEvent.setup() };
}

describe('BackupSection', () => {
  it('warns that the backup holds unencrypted bank data, and downloads it', async () => {
    const { onExport, user } = setup();
    expect(screen.getByText(/isn’t encrypted/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Download backup' }));
    expect(onExport).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Backup downloaded.');
  });

  it('asks before replacing data with a valid backup, then restores it', async () => {
    const { onRestore, user } = setup();
    await user.upload(screen.getByLabelText('Restore from a backup file'), backupFile(emptyBackup()));
    const confirm = await screen.findByRole('group', { name: 'Restore the backup from 18 Nov?' });
    expect(confirm).toHaveTextContent('It has 0 transactions, 16 categories and 0 rules. Everything currently on this device is replaced.');
    expect(onRestore).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Replace my data' }));
    expect(onRestore).toHaveBeenCalledWith(expect.objectContaining({ app: 'spendio' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Backup restored.');
  });

  it('rejects files that are not valid backups, without asking', async () => {
    const { onRestore, user } = setup();
    await user.upload(screen.getByLabelText('Restore from a backup file'), backupFile('{"app":"other"}'));
    expect(await screen.findByRole('alert')).toHaveTextContent('This file is not a Spendio backup.');
    expect(screen.queryByRole('button', { name: 'Replace my data' })).not.toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();
  });

  it('cancels a restore', async () => {
    const { onRestore, user } = setup();
    await user.upload(screen.getByLabelText('Restore from a backup file'), backupFile(emptyBackup()));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();
  });
});
