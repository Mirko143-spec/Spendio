// Whole-word markers of a company or organization in a (Swedish) Swish counterparty name.
const BUSINESS_MARKER = /(?:^|[\s,.])(?:AB|HB|KB|AKTIEBOLAG|STIFTELSEN|STIFTELSE|FÖRENING|FÖRENINGEN|FORENING|LTD|INC|GMBH)(?=$|[\s,.])/i;

/**
 * Whether a Swish counterparty looks like a company rather than a private person.
 * Only the name heuristic: a matching merchant rule also makes a counterparty a business,
 * which the categorizer checks on top of this.
 */
export function looksLikeBusiness(name: string): boolean {
  return BUSINESS_MARKER.test(name);
}
