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
        <>
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
              <Ionicons name="sparkles" size={iconsize} color="#666666" />
              <Text style={[styles.textbage, { fontSize: fontsize }]}>Premium</Text>
            </View>
          )}
        </>
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
    position: "absolute",
    paddingHorizontal: 2,
    backgroundColor: "#EFBF04",
    borderRadius: 4,
    bottom: 0,
    gap: 4,
  },
  textbage: {
    fontFamily: "KanitMedium",
    color: "#666666",
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
