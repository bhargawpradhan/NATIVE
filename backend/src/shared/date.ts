import { env } from '../config/env.js';

/**
 * Returns today's calendar date string in YYYY-MM-DD format according to the configured timezone.
 * Supports injecting an optional reference Date for test predictability.
 */
export function getTodayCalendarDate(
  timeZone: string = env.APP_TIME_ZONE,
  referenceDate: Date = new Date()
): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(referenceDate);
}

/**
 * Validates that a string is a strict, valid calendar date in YYYY-MM-DD format.
 * Correctly rejects impossible dates like 2026-02-31 or 2026-04-31.
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Converts a YYYY-MM-DD date string into a Date object at UTC midnight for PostgreSQL @db.Date storage.
 */
export function parseCalendarDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Formats a Date object from PostgreSQL into a clean YYYY-MM-DD string.
 */
export function formatCalendarDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
