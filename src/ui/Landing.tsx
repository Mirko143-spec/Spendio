import { useMemo, useState, type ReactNode } from 'react';
import { Amount } from './Amount.tsx';
import { demoRows } from './landing-demo.ts';
import { hrefFor } from './router.ts';

interface LandingProps {
  /** Someone with data gets a way back to their overview instead of the sample. */
  hasData: boolean;
  onTrySample: () => Promise<void>;
}

const primary = 'rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-40';
const secondary = 'rounded-lg border border-line px-5 py-2.5 font-semibold hover:bg-surface-raised';

function Actions({ hasData, onTrySample }: LandingProps) {
  const [busy, setBusy] = useState(false);
  if (hasData) {
    return (
      <div className="flex flex-wrap gap-3">
        <a href={hrefFor('overview')} className={primary}>
          Open your overview
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={busy}
        className={primary}
        onClick={() => {
          setBusy(true);
          void onTrySample().finally(() => setBusy(false));
        }}
      >
        {busy ? 'Loading sample data…' : 'Try it with sample data'}
      </button>
      <a href={hrefFor('add')} className={secondary}>
        Add your own statement
      </a>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-10">
      <h2 id={id} className="text-2xl font-semibold tracking-[-0.01em]">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Statement lines on the left, what Spendio makes of them on the right. */
function Demo() {
  const rows = useMemo(() => demoRows(), []);
  return (
    <figure className="rounded-xl border border-line bg-surface-raised">
      <ul>
        {rows.map((row) => (
          <li key={row.raw} className="grid gap-x-6 gap-y-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-baseline sm:px-5">
            <span className="font-mono text-sm break-words text-ink-muted">{row.raw}</span>
            <span className="flex items-baseline justify-between gap-4 sm:row-span-2 sm:flex-col sm:items-end sm:gap-0">
              <span className="sr-only">becomes </span>
              <span className="font-semibold">{row.name}</span>
              <Amount ore={row.amount} size="inline" />
            </span>
            <span className="flex items-center gap-2 text-sm">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              {row.category}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="border-t border-line px-4 py-3 text-sm text-ink-muted sm:px-5">
        Lines from the sample statement, sorted by Spendio.
      </figcaption>
    </figure>
  );
}

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Download your transactions',
    text: 'In your internet bank, download your account’s transactions as a CSV or PDF file. Spendio reads common bank layouts directly; for any other bank you match up the columns once, and it remembers.',
  },
  {
    title: 'Spendio sorts them',
    text: 'Every purchase is matched to a category by merchant, using about 100 well-known Swedish stores and services plus rules learned from your own choices. Anything it isn’t sure about waits for one quick decision per merchant.',
  },
  {
    title: 'Follow your month',
    text: 'Your budget month runs from payday to payday: the 25th by default, moved earlier for weekends and holidays. See what you’ve spent, what’s left of each budget, and what you saved.',
  },
];

const FEATURES: { name: string; text: string }[] = [
  { name: 'Overview', text: 'What you spent this month compared with last, what’s left of your budget, and where it went.' },
  { name: 'Budgets', text: 'A monthly limit for any category, with a meter that shows how close you are.' },
  { name: 'History', text: 'Every category month by month, against the limit that applied at the time.' },
  { name: 'Savings', text: 'What was left over each month and how much you moved to savings.' },
  { name: 'Transactions', text: 'Search and filter everything, and change a category in one click.' },
];

/** What Spendio is, for someone who has never seen it (docs/SPEC.md §12). */
export function Landing(props: LandingProps) {
  return (
    <div className="space-y-16">
      <section aria-labelledby="landing-title" className="space-y-8">
        <h1 id="landing-title" className="text-4xl font-bold tracking-[-0.025em] sm:text-5xl sm:leading-[1.05]">
          See where your money goes.
        </h1>
        <p className="max-w-prose text-lg text-ink-muted">
          Spendio reads the statement you export from your bank, sorts every purchase into a category, and shows your
          month against the limits you set. It runs entirely in your browser, so your bank data is never uploaded.
        </p>
        <Actions {...props} />
        <Demo />
      </section>

      <Section id="how-title" title="How it works">
        <ol className="space-y-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-x-3">
              <span aria-hidden="true" className="text-lg font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-1 max-w-prose text-ink-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="features-title" title="What you get">
        <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.name}>
              <dt className="font-semibold">{feature.name}</dt>
              <dd className="mt-1 text-ink-muted">{feature.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="privacy-title" title="Your data stays with you">
        <div className="max-w-prose space-y-4 text-ink-muted">
          <p>
            There’s no account and no server. Your statement is read in this browser and stored only on this device, and
            the site’s security settings block it from sending data anywhere. Personal identity numbers in a statement
            are removed as it’s read.
          </p>
          <p>
            Because everything lives in this browser, clearing your browsing data also deletes it. Download a backup from
            Settings to keep it safe or to move it to another device.
          </p>
        </div>
      </Section>

      <Section id="sweden-title" title="Made for Sweden, for now">
        <p className="max-w-prose text-ink-muted">
          Amounts are in kronor, and budget months follow Swedish paydays and public holidays. Any bank’s CSV export
          works, and so do PDF statements that list your transactions as text.
        </p>
      </Section>

      <section aria-labelledby="start-title" className="rounded-xl bg-surface-raised px-5 py-8 sm:px-8">
        <h2 id="start-title" className="text-2xl font-semibold tracking-[-0.01em]">
          {props.hasData ? 'Your budget is waiting' : 'No statement at hand?'}
        </h2>
        <p className="mt-2 mb-6 max-w-prose text-ink-muted">
          {props.hasData
            ? 'Everything you imported is still here, in this browser.'
            : 'Try Spendio with made-up transactions first. You can remove them again with one click.'}
        </p>
        <Actions {...props} />
      </section>
    </div>
  );
}
