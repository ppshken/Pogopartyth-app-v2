// lib/otp.ts
import { api } from "./api";

/**
 * ขอส่งรหัส OTP ไปอีเมล (ใช้ตอนสมัครเสร็จ/ขอใหม่)
 */
export async function resendEmailOtp(email: string) {
  try {
    const res = await api.post("/auth/resend_email_otp.php", { email });
    if (!res?.data?.success) {
      throw new Error(res?.data?.message || "ส่งรหัสใหม่ไม่สำเร็จ");
    }
    return res.data;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาด";
    throw new Error(msg);
  }
}

/**
 * ยืนยัน OTP (6 หลัก)
 * แนะนำให้ backend (ถ้า verify สำเร็จ) ส่ง user + token กลับมาเพื่อ login ทันที
 */
export async function verifyEmailOtp(email: string, otp: string) {
  try {
    const res = await api.post("/auth/verify_email_otp.php", { email, otp });
    if (!res?.data?.success) {
      throw new Error(res?.data?.message || "รหัสไม่ถูกต้อง");
    }
    return res.data;
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || "เกิดข้อผิดพลาด";
    throw new Error(msg);
  }
}

/** (ออปชัน) หน้าสมัครเรียกใช้ฟังก์ชันนี้ตอนสมัครเสร็จ */
export async function sendEmailOtp() {
  const res = await api.post("/auth/send_email_otp.php");
  if (!res?.data?.success) throw new Error(res?.data?.message || "ส่ง OTP ไม่สำเร็จ");
  return res.data;
}
