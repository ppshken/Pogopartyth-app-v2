// countdown.ts
export function countdown(
  seconds = 10,
  onTick?: (left: number) => void
): Promise<true> {
  return new Promise((resolve) => {
    let left = seconds;
    onTick?.(left); // แจ้งค่าเริ่มต้น (10)
    const id = setInterval(() => {
      left -= 1;
      onTick?.(left); // อัปเดตทุกวินาที: 9,8,...,0
      if (left <= 0) {
        clearInterval(id);
        resolve(true); // <-- คืน true เมื่อครบ 0
      }
    }, 1000);
  });
}
