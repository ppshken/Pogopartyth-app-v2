// utils/minutesAgoTH.ts
type InputDate = Date | number | string;

function parseServerDate(input: InputDate): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === "number") return input;
  const m = String(input).match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/
  );
  if (m) {
    const [, y, mo, d, h, mi, s] = m.map(Number) as unknown as number[];
    return new Date(y, (mo as number) - 1, d, h, mi, s).getTime();
  }
  return new Date(input).getTime();
}

export function minutesAgoTH(input: InputDate): string {
  const ts = parseServerDate(input);
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  return minutes === 0 ? "เมื่อสักครู่" : `${minutes} นาทีที่แล้ว`;
}
