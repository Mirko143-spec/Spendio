// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing.tsx';

describe('Landing', () => {
  it('explains what Spendio is, with real sorted lines from the sample', () => {
    render(<Landing hasData={false} onTrySample={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'See where your money goes.' })).toBeInTheDocument();
    const demo = screen.getByRole('figure');
    expect(within(demo).getAllByRole('listitem')).toHaveLength(5);
    expect(within(demo).getAllByRole('listitem')[0]).toHaveTextContent('Kortköp 261103 Spotify P1234ABCD5');
    expect(within(demo).getAllByRole('listitem')[0]).toHaveTextContent('Subscriptions');
    for (const name of ['How it works', 'What you get', 'Your data stays with you', 'Made for Sweden, for now']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('listitem').filter((li) => li.closest('ol'))).toHaveLength(3);
  });

  it('offers the sample and your own statement to a new visitor', async () => {
    const onTrySample = vi.fn().mockResolvedValue(undefined);
    render(<Landing hasData={false} onTrySample={onTrySample} />);
    expect(screen.getAllByRole('link', { name: 'Add your own statement' })[0]).toHaveAttribute('href', '#/add');
    await userEvent.click(screen.getAllByRole('button', { name: 'Try it with sample data' })[0]!);
    expect(onTrySample).toHaveBeenCalledOnce();
  });

  it('sends someone with data back to their overview instead', () => {
    render(<Landing hasData onTrySample={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /sample data/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open your overview' })[0]).toHaveAttribute('href', '#/');
  });
});
