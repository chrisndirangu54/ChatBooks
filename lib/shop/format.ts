/**
 * Money formatting for WhatsApp text.
 *
 * Separate from `formatCurrency` in lib/utils.ts on purpose: that one renders
 * dashboard chrome in a browser and rounds to whole units, while these strings
 * are a customer's quote and receipt. Shillings and cents both matter, and the
 * output has to survive a feature-phone WhatsApp client — so it's a plain
 * "KES 1,250" rather than a locale-dependent symbol that may render as a box.
 *
 * Pure module: no imports, so it runs under `node --test`.
 */
export function formatMoney(amount: number, currency = "KES"): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  const rendered = amount.toLocaleString("en-KE", {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${currency} ${rendered}`;
}
