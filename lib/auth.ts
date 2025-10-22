import { api } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** ปรับตามโครงจริงของ API คุณ */
export type User = {
  id: number;
  email: string;
  username: string;
  avatar: string | null;
  friend_code: string | null;
  level: number;
  created_at: string | null;
};

/** เข้าสู่ระบบ */
export async function login(payload: {
  email?: string;
  username?: string;
  password: string;
  device_token: string;
}) {
  const { data } = await api.post("/api/auth/login.php", payload, {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Login failed"); // ← จะโยน "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
  return data.data;
}

/** สมัครสมาชิก */
export async function register(payload: {
  email: string;
  password: string;
}) {
  const { data } = await api.post("/api/auth/register.php", payload, {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Register failed");
  return data.data as { user: User; token: string };
}

/** โปรไฟล์ */
export async function profile() {
  const { data } = await api.get("/api/auth/profile.php", {
    validateStatus: () => true,
  });
  if (!data.success) throw new Error(data.message || "Profile failed");
  return data.data;
}

export type LoginResult = {
  token: string;    // JWT ของระบบคุณ
  user: User;
  is_new: boolean;  // true = ผู้ใช้ใหม่ ต้องไปตั้งโปรไฟล์
};

/** Login Google */
export async function loginWithGoogleIdToken(idToken: string): Promise<LoginResult> {
  const { data } = await api.post("/api/auth/google_login.php", { id_token: idToken });
  if (!data?.success) throw new Error(data?.message || "Login failed");
  const { token, user, is_new } = data.data;
  await AsyncStorage.setItem("token", token);
  await AsyncStorage.setItem("me", JSON.stringify(user));
  return { token, user, is_new };
}

export async function logout() {
  await AsyncStorage.multiRemove(["token", "me"]);
}