// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PeriodSettings } from '../core/periods.ts';
import { PeriodSettingsForm } from './PeriodSettingsForm.tsx';

function Harness({ onSave }: { onSave: (s: PeriodSettings) => Promise<void> }) {
  const [settings, setSettings] = useState<PeriodSettings>({ startDay: 25, adjustToBankingDay: true });
  return (
    <PeriodSettingsForm
      settings={settings}
      today="2026-12-01"
      onSave={async (s) => {
        await onSave(s);
        setSettings(s);
      }}
    />
  );
}

describe('PeriodSettingsForm', () => {
  it('previews the period today falls in, with payday adjusted to a banking day', () => {
    render(<Harness onSave={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByLabelText('Starts on day')).toHaveValue('25');
    expect(screen.getByText(/This month would be/)).toHaveTextContent('This month would be December 2026: 25 Nov – 22 Dec.');
    expect(screen.getByRole('button', { name: 'Save budget month' })).toBeDisabled();
  });

  it('updates the preview while choosing, and saves', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Harness onSave={onSave} />);
    await user.selectOptions(screen.getByLabelText('Starts on day'), '1');
    expect(screen.getByText(/This month would be/)).toHaveTextContent('December 2026: 1–31 Dec.');
    expect(screen.getByRole('checkbox')).toBeDisabled(); // the 1st is always the 1st
    await user.click(screen.getByRole('button', { name: 'Save budget month' }));
    expect(onSave).toHaveBeenCalledWith({ startDay: 1, adjustToBankingDay: true });
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });

  it('can turn off the banking-day adjustment', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<Harness onSave={onSave} />);
    await user.click(screen.getByRole('checkbox', { name: /previous banking day/ }));
    // Without the adjustment, December's period ends on Dec 24 (next start is the 25th itself).
    expect(screen.getByText(/This month would be/)).toHaveTextContent('25 Nov – 24 Dec');
    await user.click(screen.getByRole('button', { name: 'Save budget month' }));
    expect(onSave).toHaveBeenCalledWith({ startDay: 25, adjustToBankingDay: false });
  });
});
