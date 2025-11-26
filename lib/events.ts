// lib/events.ts
import { api } from "./api";

export type Events = {
    id: number;
    title: string;
    description: string;
    image: string;
    created_by: string;
    created_at: string;
    creator_avatar: string;
}

export async function getEvents(): Promise<Events | null> {
    try {
        const res = await api.get("/api/events/list.php?limit=1", {
            validateStatus: () => true,
        });

        const json = res.data;

        if (!json?.success) {
            // กรณีไม่สำเร็จ หรือ token หมดอายุ ไม่ต้อง throw ก็ได้ แค่ return null เพื่อไม่ให้แอปพัง
            console.warn("API Error:", json?.message);
            return null;
        }

        // --- จุดสำคัญ: ตรวจสอบโครงสร้างข้อมูลก่อนดึง ---

        // กรณี 1: ถ้า json.data เป็น Array โดยตรง [ {...} ]
        if (Array.isArray(json.data)) {
            return json.data.length > 0 ? (json.data[0] as Events) : null;
        }

        // กรณี 2: ถ้า json.data เป็น Object ที่มี key 'data' หรือ 'list' อีกที (ตาม PHP ที่เคยเขียน)
        // เช่น { data: { data: [ ... ], pagination: ... } }
        const list = json.data?.data || json.data?.list;
        if (Array.isArray(list)) {
            return list.length > 0 ? (list[0] as Events) : null;
        }

        return null;

    } catch (error) {
        console.error("getEvents Error:", error);
        return null;
    }
}

// ✅ เพิ่มฟังก์ชันนี้: สำหรับดึงรายการทั้งหมด (มี Pagination ได้ถ้าต้องการ)
export async function getAllEvents(page = 1, limit = 20): Promise<Events[]> {
    try {
        const res = await api.get(`/api/events/list.php?page=${page}&limit=${limit}`, {
            validateStatus: () => true,
        });
        const json = res.data;

        if (!json?.success) return [];

        // รองรับโครงสร้างข้อมูลแบบต่างๆ
        const list = json.data?.list || json.data || [];

        return Array.isArray(list) ? (list as Events[]) : [];
    } catch (error) {
        console.error("getAllEvents Error:", error);
        return [];
    }
}

// ✅ เพิ่มฟังก์ชันนี้: ดึงข้อมูลตาม ID
export async function getEventById(id: string | string[]): Promise<Events | null> {
  try {
    // สมมติว่าหลังบ้านรับ param ?id=xxx
    // ถ้าหลังบ้านคุณใช้ file เดียวกับ list ก็อาจจะเป็น list.php?id=xxx
    const res = await api.get(`/api/events/detail.php?id=${id}`, {
      validateStatus: () => true,
    });
    
    const json = res.data;
    if (!json?.success) return null;

    // กรณีคืนค่ามาเป็น Object data โดยตรง
    return (json.data as Events);
  } catch (error) {
    console.error("getEventById Error:", error);
    return null;
  }
}