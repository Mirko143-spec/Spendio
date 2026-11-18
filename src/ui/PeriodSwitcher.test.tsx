// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { periodRange } from '../core/periods.ts';
import { PeriodSwitcher } from './PeriodSwitcher.tsx';

describe('PeriodSwitcher', () => {
  it('names the period and shows its payday-to-payday dates', () => {
    render(<PeriodSwitcher period={periodRange('2026-12')} bounds={{ first: '2026-10', last: '2027-01' }} onChange={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'December 2026' })).toBeInTheDocument();
    expect(screen.getByText('25 Nov – 22 Dec')).toBeInTheDocument();
  });

  it('moves to the previous and next period', async () => {
    const onChange = vi.fn();
    render(<PeriodSwitcher period={periodRange('2026-12')} bounds={{ first: '2026-10', last: '2027-01' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Previous period: November 2026' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next period: January 2027' }));
    expect(onChange.mock.calls).toEqual([['2026-11'], ['2027-01']]);
  });

  it('stops at the first and last period with data', () => {
    render(<PeriodSwitcher period={periodRange('2026-11')} bounds={{ first: '2026-11', last: '2026-11' }} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Previous period/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next period/ })).toBeDisabled();
  });
});
