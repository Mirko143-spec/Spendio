import { useEffect, useState } from 'react';
import type { Account } from '../../core/account.ts';
import { backupFileName, serializeBackup } from '../../core/backup.ts';
import type { ImportBatch } from '../../core/import.ts';
import type { AppSettings } from '../../core/settings.ts';
import type { SpendioStore } from '../../storage/store.ts';
import { BackupSection } from '../BackupSection.tsx';
import { DeleteAllData } from '../DeleteAllData.tsx';
import { downloadText } from '../download.ts';
import { ImportsSection } from '../ImportsSection.tsx';
import { PeriodSettingsForm } from '../PeriodSettingsForm.tsx';
import { navigate } from '../router.ts';
import { useStore } from '../useStore.ts';

interface Data {
  settings: AppSettings;
  batches: ImportBatch[];
  accounts: Account[];
}

async function fetchData(store: SpendioStore): Promise<Data> {
  const [settings, batches, accounts] = await Promise.all([
    store.getSettings(),
    store.listImportBatches(),
    store.listAccounts(),
  ]);
  return { settings, batches, accounts };
}

/** Budget month, backups, imports and deleting data (docs/SPEC.md §12 Settings). */
export function SettingsPage() {
  const store = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchData(store).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [store, version]);

  if (!data) return null;
  const reload = () => setVersion((v) => v + 1);

  return (
    <div className="space-y-14">
      <h1 className="text-title font-semibold tracking-[-0.015em]">Settings</h1>

      <PeriodSettingsForm
        settings={data.settings}
        today={new Date().toISOString().slice(0, 10)}
        onSave={async (settings) => {
          await store.savePeriodSettings(settings);
          reload();
        }}
      />

      <BackupSection
        onExport={async () => {
          const now = new Date().toISOString();
          downloadText(backupFileName(now), serializeBackup(await store.exportBackup(now)));
        }}
        onRestore={async (backup) => {
          await store.restoreBackup(backup);
          reload();
        }}
      />

      <ImportsSection
        batches={data.batches}
        accounts={data.accounts}
        onUndo={async (id) => {
          await store.deleteImportBatch(id);
          reload();
        }}
      />

      <DeleteAllData
        onDelete={async () => {
          await store.wipeAll();
          navigate('add');
        }}
      />
    </div>
  );
}
