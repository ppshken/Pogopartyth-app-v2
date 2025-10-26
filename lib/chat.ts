import { api } from "./api";

export type ChatMessage = {
  id: number;
  room_id: number;
  user_id: number;
  username?: string;
  avatar?: string|null;
  message: string;
  created_at: string;
};

export async function getMessages(room_id: number, since_id?: number, limit = 50) {
  const { data } = await api.get("/api/chat/raid/messages.php", { params: { room_id, since_id, limit } });
  if (!data.success) throw new Error(data.message || "Get messages failed");
  return data.data as { items: ChatMessage[]; next_since_id: number; server_time: string; count: number; };
}

export async function sendMessage(room_id: number, message: string) {
  const { data } = await api.post("/api/chat/raid/send.php", { room_id, message });
  if (!data.success) throw new Error(data.message || "Send message failed");
  return data.data.message as ChatMessage;
}
