// An invented statement for a made-up person (fake names, no personnummer), bundled for
// "Try it with sample data". Kept separate from the test fixtures and covered by their privacy guard.
import sampleCsv from '../../fixtures/demo-statement.csv?raw';

export const SAMPLE_CSV: string = sampleCsv;

/** What to show when loading the sample fails, including the browser's own reason. */
export function sampleDataError(error: unknown): string {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return `The sample data couldn’t be loaded in this browser (${reason}). Reload the page and try again.`;
}
