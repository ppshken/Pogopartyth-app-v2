import { useEffect, useMemo, useState } from "react";

/** >1ชม = ชม.นาทีวินาที, <1ชม = นาทีวินาที, <1นาที = วินาที */
export function useCountdown(start: string) {
    const pad2 = (n: number) => n.toString().padStart(2, "0");
    const toYmdHms = (d: Date) =>
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
            d.getHours()
        )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

  // เคาน์ดาวน์: ใช้พารามิเตอร์ `start` ที่ส่งเข้า hook; ไม่ต้องอ้างถึง `data` หรือเรียก useCountdown ซ้ำ
  // (หากต้องการ fallback ให้ส่งค่ามาจากภายนอกผ่านพารามิเตอร์ `start`)

    function parseStart(s: string): Date {
        const iso = s.includes("T") ? s : s.replace(" ", "T");
        const d = new Date(iso);
        return isNaN(d.getTime()) ? new Date(s) : d;
    }

    const target = useMemo(() => parseStart(start).getTime(), [start]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);

    const diffMs = target - now;
    const expired = diffMs <= 0;
    if (expired) return { expired: true, label: "หมดเวลา" };

    const totalSec = Math.floor(diffMs / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;

    let label = "";
    if (hh > 0) label = `เหลือ ${hh} ชม. ${pad2(mm)} นาที ${pad2(ss)} วินาที`;
    else if (mm > 0) label = `เหลือ ${mm} นาที ${pad2(ss)} วินาที`;
    else label = `เหลือ ${ss} วินาที`;

    return { expired: false, label };
}