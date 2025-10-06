// lib/openPokemonGo.ts
import { Linking, Platform, Alert } from "react-native";

const POKEMON_GO_SCHEME = "pokemongo://";
const ANDROID_PACKAGE = "com.nianticlabs.pokemongo";
const PLAY_STORE_URL = "market://details?id=com.nianticlabs.pokemongo";
const PLAY_STORE_WEB_URL = "https://play.google.com/store/apps/details?id=com.nianticlabs.pokemongo";
const APP_STORE_URL = "https://apps.apple.com/app/pok%C3%A9mon-go/id1094591345";

export async function openPokemonGo() {
  try {
    const supported = await Linking.canOpenURL(POKEMON_GO_SCHEME);
    if (supported) {
      await Linking.openURL(POKEMON_GO_SCHEME);
      return;
    }

    if (Platform.OS === "android") {
      // ลองใช้ Android intent เป็นแผนสำรอง
      const intent = `intent://#Intent;scheme=pokemongo;package=${ANDROID_PACKAGE};end`;
      try { await Linking.openURL(intent); return; } catch {}

      // ถ้ายังไม่ได้ → เปิด Play Store
      try { await Linking.openURL(PLAY_STORE_URL); }
      catch { await Linking.openURL(PLAY_STORE_WEB_URL); }
    } else {
      // iOS → เปิด App Store
      await Linking.openURL(APP_STORE_URL);
    }
  } catch (e) {
    Alert.alert("เปิด Pokémon GO ไม่ได้", "ตรวจสอบว่าได้ติดตั้งแอพไว้แล้ว หรือเปิดจากไอคอนเกมโดยตรง");
  }
}
