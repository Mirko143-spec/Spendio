// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { periodRange } from '../core/periods.ts';
import { plain } from '../test-utils.ts';
import { ColumnChart } from './ColumnChart.tsx';

const data = [
  { period: periodRange('2026-10'), value: -56240 },
  { period: periodRange('2026-11'), value: 1439200 },
  { period: periodRange('2026-12'), value: 0 },
];

function setup() {
  render(<ColumnChart title="Left over" data={data} />);
  return within(screen.getByRole('list', { name: 'Left over' })).getAllByRole('listitem');
}

describe('ColumnChart', () => {
  it('announces every period with its value', () => {
    const columns = setup();
    expect(columns.map((c) => plain(c.getAttribute('aria-label')))).toEqual([
      'October 2026: −562 kr',
      'November 2026: 14 392 kr',
      'December 2026: 0 kr',
    ]);
  });

  it('draws positive values up from zero and negative ones down, proportionally', () => {
    const [oct, nov, dec] = setup();
    const neg = oct!.querySelector<HTMLElement>('[data-sign="negative"]')!;
    const pos = nov!.querySelector<HTMLElement>('[data-sign="positive"]')!;
    expect(neg).toHaveClass('bg-chart-negative');
    expect(pos).toHaveClass('bg-chart-mark');
    const total = parseFloat(neg.style.height) + parseFloat(pos.style.height);
    expect(total).toBeGreaterThan(155); // the two extremes fill the 160 px plot together
    expect(parseFloat(pos.style.height) / parseFloat(neg.style.height)).toBeCloseTo(1439200 / 56240, -1);
    expect(dec!.querySelector('[data-sign]')).toBeNull(); // zero draws no column
  });

  it('shows the period’s dates on hover and focus', () => {
    const [oct, nov] = setup();
    fireEvent.pointerEnter(nov!);
    expect(plain(screen.getByRole('tooltip').textContent)).toBe('14 392 kr 23 Oct – 24 Nov');
    fireEvent.pointerLeave(nov!);
    fireEvent.focus(oct!);
    expect(plain(screen.getByRole('tooltip').textContent)).toBe('−562 kr 25 Sept – 22 Oct');
  });
});
