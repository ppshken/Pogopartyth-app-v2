// lib/reports.ts
import { api } from "./api";

export type ReportType = "user" | "room" | "other";
export type ReportStatus = "pending" | "reviewed" | "resolved";

export type CreateReportPayload = {
  report_type: ReportType;
  target_id: number;   // ส่ง 0 ถ้า type = 'other'
  reason: string;      // 1..2000
};


export async function createReport(payload: CreateReportPayload) {
  const { data } = await api.post("/api/reports/create.php", payload);
  return data; // { success, message, data:{id,status} }
}

