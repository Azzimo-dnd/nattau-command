export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatLongDate(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(keyToDate(key));
}

export function formatShortDate(key: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(keyToDate(key));
}

export function getMonthDateKeys(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) =>
    dateToKey(new Date(year, month, index + 1))
  );
}

export function getLeadingBlankCount(date: Date) {
  const sundayBasedDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  ).getDay();

  return (sundayBasedDay + 6) % 7;
}

export function enumerateDateRange(firstKey: string, secondKey: string) {
  const first = keyToDate(firstKey);
  const second = keyToDate(secondKey);
  const start = first <= second ? first : second;
  const end = first <= second ? second : first;
  const result: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    result.push(dateToKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

export function isWeekend(key: string) {
  const day = keyToDate(key).getDay();
  return day === 0 || day === 6;
}

export function isPastDate(key: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return keyToDate(key) < today;
}
