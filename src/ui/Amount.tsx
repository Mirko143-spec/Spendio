import { amountParts } from './format.ts';

/**
 * An amount as the page's anchor: large tabular figures, the currency lighter.
 * Money in is pine with a plus sign; money out stays ink (spending isn't an error).
 */
export function Amount({ ore, className = '' }: { ore: number; className?: string }) {
  const { sign, number, currency } = amountParts(ore);
  const label = `${ore < 0 ? 'minus ' : ''}${number} ${currency}`;
  return (
    <span
      aria-label={label}
      className={`text-amount font-semibold whitespace-nowrap ${ore > 0 ? 'text-accent' : 'text-ink'} ${className}`}
    >
      <span aria-hidden="true">
        {sign}
        {number}
        <span className="ml-1 text-base font-normal text-ink-muted">{currency}</span>
      </span>
    </span>
  );
}
