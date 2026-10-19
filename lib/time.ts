const toronto = "America/Toronto";

/** Converts a datetime-local value to UTC, treating the clock time as Toronto time. */
export function torontoDateTimeToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: toronto,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcGuess);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  let zonedHour = read("hour");
  if (zonedHour === 24) {
    zonedHour = 0;
  }

  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    zonedHour,
    read("minute"),
    read("second"),
  );
  const instant = new Date(utcGuess.getTime() - (asUtc - utcGuess.getTime()));
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return instant.toISOString();
}

export function formatToronto(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: toronto,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

/** Start of a Toronto calendar day, as UTC, and the start of the next day. */
export function torontoDayRange(from: string, to: string) {
  const start = torontoDateTimeToIso(`${from}T00:00`);
  const next = nextCalendarDate(to);
  const end = next ? torontoDateTimeToIso(`${next}T00:00`) : null;
  if (!start || !end) {
    return null;
  }
  return { start, end };
}

function nextCalendarDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return null;
  }
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  utc.setUTCDate(utc.getUTCDate() + 1);
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${month}-${day}`;
}
