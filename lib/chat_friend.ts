import { api } from "./api";

export type ChatMessage = {
  id: number;
  friendship_id: number;
  user_id: number;
  username?: string;
  avatar?: string | null;
  message: string;
  status: string;
  created_at: string;
};

// lib/chat_friend.ts

export async function getMessages(friendship_id: number, since_id?: number, limit?: number, beforeId?: number) {
  // เปลี่ยนตรง params: { ... before_id: beforeId }
  const { data } = await api.get("/api/chat/friend/messages.php", {
    params: {
      friendship_id,
      since_id,
      limit,
      before_id: beforeId // <--- ส่งไปหา Server ให้ใช้ชื่อนี้ (snake_case)
    }
  });

  if (!data.success) throw new Error(data.message || "Get messages failed");

  return data.data as {
    items: ChatMessage[];
    next_since_id: number;
    server_time: string;
    count: number;
    chat_all: number;
    oldest_id?: number; // ใส่ ? เผื่อ server ไม่ส่งมา
  };
}

export async function sendMessage(friendship_id: number, message: string) {
  const { data } = await api.post("/api/chat/friend/send.php", { friendship_id, message });
  if (!data.success) throw new Error(data.message || "Send message failed");
  return data.data.message as ChatMessage;
}

export async function readMessage(friendship_id: number, sender: number) {
  const { data } = await api.post("/api/chat/friend/read_messages.php", { friendship_id, sender });
  if (!data.success) throw new Error(data.message || "Read message failed");
  return data.data.message as ChatMessage;
}