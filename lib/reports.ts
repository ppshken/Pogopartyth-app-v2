// lib/reports.ts
import { api } from "./api";

export type ReportType = "user" | "room" | "other";
export type ReportStatus = "pending" | "reviewed" | "resolved";

export type CreateReportPayload = {
  report_type: ReportType;
  target_id: number; // ส่ง 0 ถ้า type = 'other'
  reason: string;    // 1..2000
};

// รูปแบบที่เราจะส่งกลับให้หน้าจอใช้
export type CreateReportResult = {
  statusCode: number;          // HTTP status
  success: boolean;            // success จาก backend
  message: string;             // message จาก backend ("ส่งรายงานสำเร็จ" / "ส่งรายงานถี่เกินไป" / etc.)
  data: any;                   // อาจมี cooldown_sec, message_hint, หรือ {id, status}
};

export async function createReport(
  payload: CreateReportPayload
): Promise<CreateReportResult> {
  try {
    // ใช้ api.post (น่าจะเป็น axios instance ในโปรเจกต์คุณ)
    // ปกติ axios จะ throw ถ้า statusCode >= 400
    // เพราะงั้นเราจะดัก catch แล้วดึง response กลับเองแทน
    const resp = await api.post("/api/reports/create.php", payload);

    // ถ้ามาถึงตรงนี้ แปลว่า HTTP < 400
    const json = resp?.data ?? {};
    return {
      statusCode: resp?.status ?? 200,
      success: json?.success ?? false,
      message: json?.message ?? "",
      data: json?.data ?? null,
    };
  } catch (err: any) {
    // เคส HTTP error เช่น 429, 422, 500 ที่ axios จะ throw
    // เราดึงข้อมูลจาก err.response แทน
    const resp = err?.response;
    if (resp) {
      const json = resp.data ?? {};
      return {
        statusCode: resp.status ?? 500,
        success: json?.success ?? false,
        message: json?.message ?? "Request failed",
        data: json?.data ?? null,
      };
    }

    // เคส network ล่มจริง ๆ (ไม่มี response เลย)
    return {
      statusCode: 0,
      success: false,
      message: err?.message || "Network error",
      data: null,
    };
  }
}
