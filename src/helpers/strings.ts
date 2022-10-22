export function removeNullBytes(str: string): string {
  return str
    .split('')
    .filter(c => c.codePointAt(0))
    .join('');
}
