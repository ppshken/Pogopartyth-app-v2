// utils/minutesAgoTH.ts
type InputDate = Date | number | string;

function parseServerDate(input: InputDate): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === "number") return input;

  const s = String(input).trim();

  // 1) รองรับ "YYYY-MM-DD HH:mm:ss" หรือ "YYYY-MM-DDTHH:mm:ss" (ไม่มีโซน = local time)
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(s)) {
    const [datePart, timePart] = s.split(/[ T]/);
    const [y, mo, d] = datePart.split("-").map((v) => parseInt(v, 10));
    const [h, mi, sec] = timePart.split(":").map((v) => parseInt(v, 10));
    return new Date(y, mo - 1, d, h, mi, sec).getTime(); // local time
  }

  // 2) อย่างอื่นให้ลอง Date.parse (รองรับ ISO, มี timezone/offset)
  const t = Date.parse(s);
  return Number.isNaN(t) ? NaN : t;
}

export function minutesAgoTH(input: InputDate): string {
  const ts = parseServerDate(input);
  if (!Number.isFinite(ts)) return "—";

  const now = Date.now();
  const diffMs = now - ts;
  const future = diffMs < 0;

  const absMs = Math.abs(diffMs);
  const minutes = Math.floor(absMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);   // โดยประมาณ
  const years = Math.floor(days / 365);   // โดยประมาณ

  // ใกล้มาก
  if (minutes < 1) return future ? "อีกสักครู่" : "เมื่อสักครู่";

  // นาที
  if (minutes < 60)
    return future ? `อีก ${minutes} นาที` : `${minutes} นาทีที่แล้ว`;

  // ชั่วโมง
  if (hours < 24)
    return future ? `อีก ${hours} ชั่วโมง` : `${hours} ชั่วโมงที่แล้ว`;

  // เมื่อวาน/พรุ่งนี้ (เคสพิเศษ)
  if (days === 1)
    return future ? "ในวันพรุ่งนี้" : "เมื่อวานนี้";

  // วัน
  if (days < 7)
    return future ? `อีก ${days} วัน` : `${days} วันที่แล้ว`;

  // สัปดาห์
  if (weeks < 5)
    return future ? `อีก ${weeks} สัปดาห์` : `${weeks} สัปดาห์ที่แล้ว`;

  // เดือน
  if (months < 12)
    return future ? `อีก ${months} เดือน` : `${months} เดือนที่แล้ว`;

  // ปี (ปิดเคส 365+ วัน)
  return future ? `อีก ${years} ปี` : `${years} ปีที่แล้ว`;
}
