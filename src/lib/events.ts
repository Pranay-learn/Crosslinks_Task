/** Campus event forms always use India Standard Time, independent of browser timezone. */
export function eventLocalTime(instant: string): string {
  const date = new Date(instant);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() + 330 * 60000).toISOString().slice(0, 16);
}
export function eventInstant(value: string): string {
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
  if (!local && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error("Choose a valid event date and time.");
  const date = new Date(local ? value + ":00+05:30" : value);
  if (
    Number.isNaN(date.getTime()) ||
    (local && eventLocalTime(date.toISOString()) !== value)
  )
    throw new Error("Choose a valid event date and time.");
  return date.toISOString();
}
