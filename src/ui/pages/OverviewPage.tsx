import { hrefFor } from '../router.ts';

/** Placeholder until the dashboard lands later in this branch. */
export function OverviewPage() {
  return (
    <section aria-labelledby="overview-title">
      <h1 id="overview-title" className="text-title font-semibold tracking-[-0.015em]">
        Overview
      </h1>
      <p className="mt-4 text-ink-muted">
        Your transactions are saved on this device. <a href={hrefFor('add')} className="text-accent underline">Add another statement</a>.
      </p>
    </section>
  );
}
