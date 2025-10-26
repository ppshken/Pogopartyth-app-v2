// lib/chat.ts
import { api } from "./api"; // ✅ axios instance ของโปรเจ็กต์คุณ (แน่ใจว่าใส่ Bearer token ให้เรียบร้อย)
import * as ImagePicker from "expo-image-picker";

/* =========================
 *        Types
 * ========================= */

export type Thread = {
  thread_id: number;
  other_user_id: number;
  other_username: string;
  other_avatar?: string | null;
  last_message_text?: string | null;
  last_message_at?: string | null; // ISO string
  last_message_sender?: number | null;
};

export type Message = {
  id: number;
  sender_id: number;
  text_body?: string | null;
  image_url?: string | null;
  created_at: string; // ISO
  seen_by_recipient_at?: string | null;
};

export type Paginated<T> = {
  list: T[];
  pagination: { limit: number; offset: number; has_more: boolean };
};

type EnsureThreadRes = { thread_id: number };

/* =========================
 *        Endpoints
 * ========================= */

// หา/สร้างห้อง 1-1 ระหว่างเราและ user อีกคน
export async function ensureThread(other_id: number): Promise<number> {
  const res = await api.get("/api/chat/friend/ensure_thread.php", { params: { other_id } });
  if (!res.data?.success) throw new Error(res.data?.message || "ensure thread failed");
  return (res.data.data as EnsureThreadRes).thread_id;
}

// กล่องแชทของฉัน (เรียงตามข้อความล่าสุด)
export async function listThreads(params?: { limit?: number; offset?: number }): Promise<Paginated<Thread>> {
  const res = await api.get("/api/chat/friend/threads.php", { params });
  if (!res.data?.success) throw new Error(res.data?.message || "fetch threads failed");
  return res.data.data as Paginated<Thread>;
}

// โหลดข้อความในห้อง (เก่าสุด→ใหม่สุด) + ฝั่งเซิร์ฟเวอร์ mark read ให้แล้ว
export async function getMessages(params: {
  thread_id: number;
  limit?: number;
  offset?: number;
}): Promise<{ list: Message[]; unread: number; pagination: Paginated<Message>["pagination"] }> {
  const res = await api.get("/api/chat/friend/messages.php", { params });
  if (!res.data?.success) throw new Error(res.data?.message || "fetch messages failed");
  return res.data.data as { list: Message[]; unread: number; pagination: Paginated<Message>["pagination"] };
}

// ส่งข้อความ (ใส่ text หรือ image_url อย่างน้อย 1 อย่าง)
export async function sendMessage(payload: {
  thread_id: number;
  text?: string;
  image_url?: string;
}) {
  const res = await api.post("/api/chat/friend/send.php", payload);
  if (!res.data?.success) throw new Error(res.data?.message || "send message failed");
  return true;
}

// อัปโหลดรูป → ได้ URL กลับมา แล้วเอาไปใส่ sendMessage({ image_url })
export async function uploadImageFromPickerResult(
  asset: ImagePicker.ImagePickerAsset
): Promise<string> {
  if (!asset?.uri) throw new Error("ไม่พบไฟล์รูปภาพ");

  // เดาไฟล์เนม/ชนิดไฟล์
  const uri = asset.uri;
  const filename =
    asset.fileName ||
    `chat_${Date.now()}.${(asset?.mimeType?.split("/")[1] || uri.split(".").pop() || "jpg")}`;
  const type = asset.mimeType || "image/jpeg";

  const form = new FormData();
  // For React Native / Expo, append a "file" object — cast to any to satisfy TypeScript DOM typings
  form.append("file", { uri, name: filename, type } as any);

  const res = await api.post("/api/chat/friend/upload_image.php", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  if (!res.data?.success) throw new Error(res.data?.message || "upload failed");
  const url: string = res.data?.data?.url;
  if (!url) throw new Error("ไม่พบ URL หลังอัปโหลด");
  return url;
}

/* =========================
 *         Hooks
 * ========================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** โหลดกล่องแชท พร้อม pagination แบบง่าย */
export function useChatThreads(initialLimit = 20) {
  const [list, setList] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listThreads({ limit: initialLimit, offset: 0 });
      setList(data.list);
      setOffset(data.list.length);
      setHasMore(data.pagination.has_more);
    } catch (e: any) {
      setError(e?.message || "โหลดกล่องแชทไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [initialLimit]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    try {
      setLoading(true);
      const data = await listThreads({ limit: initialLimit, offset });
      setList((prev) => [...prev, ...data.list]);
      setOffset((prev) => prev + data.list.length);
      setHasMore(data.pagination.has_more);
    } catch (e: any) {
      setError(e?.message || "โหลดเพิ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, initialLimit, offset]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { list, loading, error, refresh, loadMore, hasMore };
}

/** โหลดข้อความในห้อง + แปะใหม่แบบ optimistic เวลาเราส่ง */
export function useChatMessages(thread_id: number, pageSize = 50) {
  const [list, setList] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // ป้องกันเรียกซ้ำคนละ thread
  const lastThreadRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!thread_id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getMessages({ thread_id, limit: pageSize, offset: 0 });
      // API เรียงเก่าสุด→ใหม่สุด: ถ้าหน้าแชทอยากโชว์ใหม่สุดด้านล่าง ก็ set ตามนี้แล้ว scrollToEnd ใน UI
      setList(data.list);
      setUnread(data.unread);
      setOffset(data.list.length);
      setHasMore(data.pagination.has_more);
      lastThreadRef.current = thread_id;
    } catch (e: any) {
      setError(e?.message || "โหลดข้อความไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [thread_id, pageSize]);

  const loadMore = useCallback(async () => {
    if (!thread_id || !hasMore || loading) return;
    try {
      setLoading(true);
      const data = await getMessages({ thread_id, limit: pageSize, offset });
      setList((prev) => [...prev, ...data.list]); // ต่อท้าย (ยังคงเรียงเก่าสุด→ใหม่สุด)
      setOffset((prev) => prev + data.list.length);
      setHasMore(data.pagination.has_more);
      setUnread(data.unread);
    } catch (e: any) {
      setError(e?.message || "โหลดเพิ่มไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [thread_id, hasMore, loading, pageSize, offset]);

  // รีเฟรชเมื่อ thread เปลี่ยน
  useEffect(() => {
    if (lastThreadRef.current !== thread_id) {
      setList([]);
      setOffset(0);
      setHasMore(true);
      setUnread(0);
      setError(null);
    }
    refresh();
  }, [thread_id, refresh]);

  const sendText = useCallback(
    async (text: string, currentUserId: number) => {
      if (!text?.trim()) return;
      // optimistic append
      const temp: Message = {
        id: Date.now() * -1, // temp id ลบ (ไม่ซ้ำ)
        sender_id: currentUserId,
        text_body: text,
        image_url: null,
        created_at: new Date().toISOString(),
        seen_by_recipient_at: null,
      };
      setList((prev) => [...prev, temp]);

      try {
        await sendMessage({ thread_id, text });
        // reload เฉพาะท้าย เพื่อ sync เวลาเซิร์ฟเวอร์
        await refresh();
      } catch (e) {
        // rollback ลบ temp
        setList((prev) => prev.filter((m) => m.id !== temp.id));
        throw e;
      }
    },
    [thread_id, refresh]
  );

  const sendImageFromAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset, currentUserId: number) => {
      // อัปโหลดก่อน
      const image_url = await uploadImageFromPickerResult(asset);

      // optimistic
      const temp: Message = {
        id: Date.now() * -1,
        sender_id: currentUserId,
        text_body: null,
        image_url,
        created_at: new Date().toISOString(),
        seen_by_recipient_at: null,
      };
      setList((prev) => [...prev, temp]);

      try {
        await sendMessage({ thread_id, image_url });
        await refresh();
      } catch (e) {
        setList((prev) => prev.filter((m) => m.id !== temp.id));
        throw e;
      }
    },
    [thread_id, refresh]
  );

  return {
    list,          // เรียงเก่าสุด→ใหม่สุด
    loading,
    error,
    unread,
    hasMore,
    refresh,
    loadMore,
    sendText,
    sendImageFromAsset,
  };
}

/* =========================
 *      Helper UI utils
 * ========================= */

// แปลง ISO เป็นเวลาแบบสั้น ๆ (เอาไปใช้ใน UI ได้)
export function formatTimeShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // แสดง HH:mm ถ้าในวันเดียวกัน, ไม่งั้นแสดง DD/MM
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}
