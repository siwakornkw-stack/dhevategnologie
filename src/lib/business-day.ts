// Business-day cutoff: the shop runs overnight (open ~17:00, close ~05:00), so a sale
// after midnight belongs to the PREVIOUS business day. The business day starts at this
// hour (local time). A timestamp before the cutoff counts toward the prior calendar day.
export const BUSINESS_DAY_CUTOFF_HOUR = 7;

/**
 * Convert a business-day range (yyyy-mm-dd strings, inclusive) into the actual timestamp
 * range to query: [from 07:00, (to+1) 07:00). All math is in the browser's local time.
 */
export function businessDayRange(fromStr: string, toStr: string): { from: Date; to: Date } {
  const from = new Date(fromStr);
  from.setHours(BUSINESS_DAY_CUTOFF_HOUR, 0, 0, 0);
  const to = new Date(toStr);
  to.setDate(to.getDate() + 1);
  to.setHours(BUSINESS_DAY_CUTOFF_HOUR, 0, 0, -1); // 1ms before next day's cutoff
  return { from, to };
}
