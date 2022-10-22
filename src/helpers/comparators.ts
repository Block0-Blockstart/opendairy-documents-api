/**
 * Returns false only when value is null or undefined.
 */
export function notNullish(value: any) {
  return value !== null && value !== void 0;
}
