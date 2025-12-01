import { StyleSheet, Text, View, Image } from "react-native";
import React from "react";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  avatar?: string;
  username?: string;
  plan?: string;
  width: number;
  height: number;
  borderRadius: number;
  fontsize: number;
  iconsize?: number;
};

export function AvatarComponent({
  avatar,
  username,
  plan,
  width,
  height,
  borderRadius,
  fontsize,
  iconsize,
}: Props) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {avatar ? (
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            width: width,
            height: height,
          }}
        >
          <Image
            source={{ uri: avatar }}
            style={[
              styles.avatar,
              {
                width: width,
                height: height,
                borderRadius: borderRadius,
              },
            ]}
          />
          {plan === "premium" && (
            <View style={styles.bage}>
              <Ionicons name="sparkles" size={iconsize} color="#ffc400ff" />
              <Text style={[styles.textbage, { fontSize: fontsize }]}>VIP</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.avatarEmpty}>
          <Text style={styles.avatarLetter}>
            {username ? username.charAt(0).toUpperCase() : "?"}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    width: "auto",
    paddingHorizontal: 8,
    backgroundColor: "#7d04efff",
    borderRadius: 4,
    bottom: -4,
    gap: 4,
  },
  textbage: {
    fontFamily: "KanitMedium",
    color: "#ffc400ff",
  },
  avatar: {
    marginBottom: 5,
    marginTop: 5,
    alignSelf: "center",
  },
  avatarEmpty: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  avatarLetter: { fontSize: 28, color: "#374151", fontFamily: "KanitBold" },
});
