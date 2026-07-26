/**
 * East Africa Time wall-clock formatting.
 *
 * Both Kenyan integrations in this app — Safaricom Daraja and KRA eTIMS —
 * demand timestamps as EAT digits with no zone marker, and both reject or
 * silently misfile a UTC string. Same concept, two consumers, so it lives in
 * one place. EAT is a fixed UTC+3 with no daylight saving, but this goes
 * through the IANA zone rather than hardcoding the offset so a server running
 * in any timezone produces the same string.
 *
 * Pure module: no imports, so it runs under `node --test`.
 */

const EAT_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of EAT_FORMAT.formatToParts(date)) {
    result[part.type] = part.value;
  }
  return result;
}

/** "YYYYMMDDHHmmss" — Daraja's `Timestamp`, KRA's `cfmDt`/`salesDt` datetimes. */
export function eatCompact(date: Date): string {
  const p = parts(date);
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

/** "YYYYMMDD" — KRA's date-only fields. */
export function eatDay(date: Date): string {
  const p = parts(date);
  return `${p.year}${p.month}${p.day}`;
}
