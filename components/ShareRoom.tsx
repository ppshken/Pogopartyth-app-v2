import React from "react";
import { View, Text, TouchableOpacity, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
    roomId: number;
  };

export default function ShareRoom({ roomId }: Props) {

  const handleShare = async () => {
    const link = `pogopartyth://rooms/${roomId}`;
    try {
      await Share.share({
        message: `เข้าร่วมห้อง Raid ของฉันใน PogopartyTH 🎯\nกดลิงก์นี้เพื่อเข้าร่วมห้องเลย!\n${link}`,
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  return (
    <View>
      <TouchableOpacity
        onPress={handleShare}
        style={{
          backgroundColor: "#ffc107",
          padding: 6,
          borderRadius: 8,
          marginTop: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center" }}>
            <Ionicons name="share-social" size={20} color="#fff" style={{ marginBottom: 4, alignSelf: "center" }} />
            <Text style={{ color: "#fff", textAlign: "center", fontWeight: "600" }}>แชร์ห้อง</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}
