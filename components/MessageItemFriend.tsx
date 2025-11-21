import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useAuth } from "../store/authStore"; // ดึงข้อมูล user ที่ล็อกอิน
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export function MessageItemFriend({ m }: { m: any }) {
  const createdDate = new Date(m.created_at);

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
      {!isMe &&
        (m.avatar ? (
          <TouchableOpacity
            onPress={() => {
              router.push(`/friends/${m.user_id}`);
            }}
          >
            <Image
              source={{ uri: m.avatar }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                marginHorizontal: 8,
              }}
            />
          </TouchableOpacity>
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
        ))}

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
        <Text
          style={{ color: isMe ? "#fff" : "#000", fontFamily: "KanitRegular" }}
        >
          {m.message}
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 4,
          }}
        >
          {isMe && m.status === "read" && (
            <View
              style={{
                marginTop: 4,
              }}
            >
              <Ionicons name="checkmark" color="#ddd" />
            </View>
          )}

          <Text
            style={{
              fontSize: 10,
              color: isMe ? "#ddd" : "#666",
              marginTop: 4,
              textAlign: "right",
              fontFamily: "KanitRegular",
            }}
          >
            {createdDate.toLocaleTimeString("th-TH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}
