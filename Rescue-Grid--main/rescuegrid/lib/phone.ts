/**
 * Normalizes an Indian phone number to E.164 (+91XXXXXXXXXX).
 * Accepts inputs like "98765 43210", "+91-98765-43210", "0919876543210".
 * Numbers that already carry a non-Indian country code are kept as-is.
 * Returns null if the input can't be a valid phone number.
 */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (!hasPlus) {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = `91${digits}`;
  }

  if (digits.length < 10 || digits.length > 15) return null;
  return `+${digits}`;
}

/** Last 10 digits — used to match numbers stored in different formats. */
export function phoneTail(input: string): string {
  return input.replace(/\D/g, '').slice(-10);
}
