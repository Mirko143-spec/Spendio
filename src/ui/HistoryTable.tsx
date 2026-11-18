import type { HistoryCell, HistoryModel, HistoryRow } from '../core/history.ts';
import { dateRange, periodName, wholeAmount } from './format.ts';
import { hrefFor } from './router.ts';

/**
 * Month-by-month spending per category against that month's limit. A table (dataviz: many
 * classes that all carry meaning), with the status spelled out in each cell and a light tint
 * only as a second cue. The category column stays put while months scroll on narrow screens.
 */
export function HistoryTable({ model }: { model: HistoryModel }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Spending per category and month, compared with each month’s limit</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="sticky left-0 bg-surface py-2 pr-4 text-left font-normal text-ink-muted">
              Category
            </th>
            {model.periods.map((p) => (
              <th key={p.label} scope="col" className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                <abbr title={`${periodName(p.label)}: ${dateRange(p.start, p.end)}`} className="no-underline">
                  {periodName(p.label, true)}
                </abbr>
                {p.label.endsWith('-01') && <span className="block font-normal text-ink-muted">{p.label.slice(0, 4)}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.map((row) => (
            <Row key={row.category?.id ?? 'all'} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ row }: { row: HistoryRow }) {
  const name = row.category?.name ?? 'All spending';
  return (
    <tr className="border-b border-line">
      <th scope="row" className="sticky left-0 z-10 bg-surface py-3 pr-4 text-left align-top font-medium">
        <span className="flex items-center gap-2">
          {row.category && (
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.category.color }} />
          )}
          {name}
        </span>
        {row.limitedCount > 0 && (
          <span className={`mt-0.5 block text-xs font-normal ${row.overCount > 0 ? 'text-danger' : 'text-ink-muted'}`}>
            {row.overCount === 0
              ? `Within the limit every month`
              : `Over in ${row.overCount} of ${row.limitedCount} ${row.limitedCount === 1 ? 'month' : 'months'}`}
          </span>
        )}
      </th>
      {row.cells.map((cell) => (
        <Cell key={cell.label} cell={cell} categoryId={row.category?.id ?? null} />
      ))}
    </tr>
  );
}

function Cell({ cell, categoryId }: { cell: HistoryCell; categoryId: string | null }) {
  const over = cell.progress?.status === 'over';
  const href = hrefFor('transactions', { category: categoryId, period: cell.label });
  return (
    <td className={`px-3 py-3 text-right align-top whitespace-nowrap ${over ? 'bg-danger/10' : ''}`}>
      {cell.spent === 0 ? (
        <span className="text-ink-muted">–</span>
      ) : (
        <a href={href} className="font-semibold hover:underline">
          {wholeAmount(cell.spent)}
        </a>
      )}
      {cell.progress && (
        <span className={`block text-xs ${over ? 'font-medium text-danger' : 'text-ink-muted'}`}>
          {over ? `over by ${wholeAmount(cell.progress.overBy)}` : `of ${wholeAmount(cell.limit!)}`}
        </span>
      )}
    </td>
  );
}
