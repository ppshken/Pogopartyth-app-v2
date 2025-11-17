// utils/chatDateLabel.ts
export function getChatDateLabel(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);

  const now = new Date();

  // ตัดเวลาออก ให้เหลือแค่วันที่
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffMs = todayStart.getTime() - dateStart.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "วันนี้";
  if (diffDays === 1) return "เมื่อวาน";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
