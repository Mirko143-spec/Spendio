import { amountParts } from './format.ts';

interface AmountProps {
  ore: number;
  /**
   * `signed` (default): money in is pine with "+", money out stays ink with "−".
   * `plain`: a total shown without sign or color (e.g. "Spent 1 825 kr").
   * `danger`: like `plain`, in the warning color (e.g. "Over budget by 340 kr").
   */
  tone?: 'signed' | 'plain' | 'danger';
  size?: 'inline' | 'row' | 'headline';
  className?: string;
}

/**
 * An amount as the page's anchor: large tabular figures, the currency lighter.
 * Spending isn't an error, so money out is never red; only `danger` (e.g. over budget) is.
 */
export function Amount({ ore, tone = 'signed', size = 'row', className = '' }: AmountProps) {
  const { sign, number, currency } = amountParts(ore);
  const shownSign = tone === 'signed' ? sign : '';
  const label = `${shownSign === '−' ? 'minus ' : ''}${number} ${currency}`;
  const color = tone === 'danger' ? 'text-danger' : tone === 'signed' && ore > 0 ? 'text-accent' : 'text-ink';
  const scale = size === 'headline' ? 'text-title tracking-[-0.015em]' : size === 'inline' ? 'text-sm' : 'text-amount';
  return (
    <span aria-label={label} className={`${scale} font-semibold whitespace-nowrap ${color} ${className}`}>
      <span aria-hidden="true">
        {shownSign}
        {number}
        <span className={`ml-1 font-normal text-ink-muted ${size === 'inline' ? '' : 'text-base'}`}>{currency}</span>
      </span>
    </span>
  );
}
