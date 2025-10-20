import React from "react";
import { View, Text, Image } from "react-native";
import { useAuth } from "../store/authStore"; // ดึงข้อมูล user ที่ล็อกอิน

export function MessageItem({ m }: { m: any }) {
  const currentUser = useAuth((s) => s.user);
  const isMe = m.user_id === currentUser?.id;

  return (
    <View
      style={{
        flexDirection: isMe ? "row-reverse" : "row",
        alignItems: "flex-end",
        marginBottom: 12,
      }}
    >
      {/* Avatar */}
      {!isMe && (
        m.avatar ? (
          <Image
            source={{ uri: m.avatar }}
            style={{ width: 32, height: 32, borderRadius: 16, marginHorizontal: 8 }}
          />
        ) : (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              marginHorizontal: 8,
              backgroundColor: "#ccc",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontFamily: "KanitMedium" }}>
              {m.username ? m.username.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
        )
      )}

      {/* Bubble */}
      <View
        style={{
          maxWidth: "70%",
          backgroundColor: isMe ? "#2f6fed" : "#ffffffff",
          padding: 10,
          borderRadius: 12,
          borderBottomRightRadius: isMe ? 0 : 12,
          borderBottomLeftRadius: isMe ? 12 : 0,
        }}
      >
        {!isMe && (
          <Text style={{ fontSize: 12, color: "#555", marginBottom: 4, fontFamily: "KanitRegular" }}>
            {m.username || `User#${m.user_id}`}
          </Text>
        )}
        <Text style={{ color: isMe ? "#fff" : "#000", fontFamily: "KanitRegular" }}>{m.message}</Text>
        <Text
          style={{
            fontSize: 10,
            color: isMe ? "#ddd" : "#666",
            marginTop: 4,
            textAlign: "right",
            fontFamily: "KanitRegular",
          }}
        >
          {new Date(m.created_at).toLocaleTimeString("th-TH", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}
