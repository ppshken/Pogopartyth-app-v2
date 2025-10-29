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
  const diffMs = Date.now() - ts;
  if (!Number.isFinite(ts) || diffMs < 0) return "เมื่อสักครู่";

  const minutes = Math.floor(diffMs / 60000);

  if (minutes <= 0) return "เมื่อสักครู่";
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;

  const hours = Math.floor(minutes / 60);

  // ถ้าต้องการแสดงเฉพาะชั่วโมง (ไม่รวมเศษนาที)
  return `${hours} ชั่วโมงที่แล้ว`;

  // ถ้าอยากแสดงชั่วโมง + นาที (เช่น "2 ชั่วโมง 15 นาทีที่แล้ว")
  // ปลดคอมเมนต์ด้านล่างแทนบรรทัด return ข้างบน
  // const remMin = minutes % 60;
  // return remMin === 0
  //   ? `${hours} ชั่วโมงที่แล้ว`
  //   : `${hours} ชั่วโมง ${remMin} นาทีที่แล้ว`;
}
