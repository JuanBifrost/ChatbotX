export function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}
