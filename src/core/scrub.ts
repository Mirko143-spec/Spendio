/**
 * Personnummer (Swedish personal identity number) detection and redaction.
 *
 * Spendio never stores, displays or logs personnummer. Bank exports put them in ID columns
 * (dropped by the parsers) and occasionally in free text; every text field goes through
 * `redactPersonnummer` before it enters the model.
 *
 * Recognized forms (YY = year, MM = month, DD = day, or day + 60 for samordningsnummer):
 *   YYMMDD-XXXX   YYMMDD+XXXX   YYYYMMDD-XXXX      → redacted when the date is valid
 *   YYMMDDXXXX    YYYYMMDDXXXX                     → redacted when the date is valid AND the
 *                                                    Luhn check digit matches (bare digit runs
 *                                                    are often reference numbers, so they need
 *                                                    the stronger signal)
 */

export const REDACTED = '[redacted]';

// (century)? yy mm dd (separator)? nnnn: not part of a longer digit run.
const CANDIDATE = /(?<!\d)(\d{2})?(\d{2})(\d{2})(\d{2})([-+]?)(\d{4})(?!\d)/g;

const MAX_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidDate(century: string | undefined, month: number, day: number): boolean {
  if (century !== undefined && !['18', '19', '20'].includes(century)) return false;
  if (month < 1 || month > 12) return false;
  const realDay = day > 60 ? day - 60 : day; // samordningsnummer add 60 to the day
  return realDay >= 1 && realDay <= MAX_DAYS[month - 1]!;
}

/** Luhn checksum over the 10-digit form YYMMDDNNNN; the last digit is the check digit. */
export function luhnValid(tenDigits: string): boolean {
  let sum = 0;
  for (let i = 0; i < tenDigits.length; i++) {
    let d = Number(tenDigits[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

/** Replaces every personnummer in `text` with "[redacted]". */
export function redactPersonnummer(text: string): string {
  return text.replace(
    CANDIDATE,
    (whole, century: string | undefined, yy: string, mm: string, dd: string, separator: string, last4: string) => {
      if (!isValidDate(century, Number(mm), Number(dd))) return whole;
      if (separator || luhnValid(`${yy}${mm}${dd}${last4}`)) return REDACTED;
      return whole;
    },
  );
}

/** True if `text` contains anything that would be redacted. */
export function containsPersonnummer(text: string): boolean {
  return redactPersonnummer(text) !== text;
}
