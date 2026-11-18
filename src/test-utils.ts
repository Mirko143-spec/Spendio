/**
 * Test helper: turns the no-break and narrow no-break spaces that Intl puts in Swedish amounts
 * ("1 234,56 kr") into ordinary spaces, so expectations can be written as plain text.
 *
 * Use this instead of a local copy: copies kept picking up literal special spaces in the regex.
 */
export function plain(text: string | null | undefined): string {
  return (text ?? '').replace(/[\u00A0\u202F]/g, ' ');
}
