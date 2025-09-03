import { api } from "./api";


/** ดึงโปรไฟล์ */
export async function getProfile() {
  const { data } = await api.get("/api/auth/profile.php", {
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Profile failed");
  return data.data.user as {
    id: number;
    email: string;
    username: string;
    avatar?: string | null;
    friend_code?: string | null;
    level: number;
    created_at?: string | null;
  }
}

/** อัปเดตเฉพาะ username & friend_code */
export async function updateProfile(payload: {
  username?: string;
  friend_code?: string;
  level?: number;
}) {
  const { data } = await api.post("/api/auth/update_profile.php", payload, {
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Update profile failed");
  return data.data.user;
}

/** POST อัปโหลด/อัปเดตรูปโปรไฟล์ (multipart) */
export async function updateAvatar(file: {
  uri: string;
  name?: string;
  type?: string;
}) {
  const form = new FormData();
  form.append("avatar", {
    uri: file.uri,
    name: file.name || "avatar.jpg",
    type: file.type || "image/jpeg",
  } as any);

  const { data } = await api.post("/api/auth/update_avatar.php", form, {
    headers: { "Content-Type": "multipart/form-data" },
    validateStatus: () => true,
  });
  if (!data?.success) throw new Error(data?.message || "Update avatar failed");
  return data.data.user;
}
