// Broadcaster.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  Button,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import spanishFlag from "./assets/spanish-flag4.webp";
import englishFlag from "./assets/english-flag.webp";
import romanianFlag from "./assets/romanian-flag2.webp";
import liveMicIcon from "./assets/live.png";

export default function Broadcaster({
  signalingServer,
  token,
  onLanguageActive,
}) {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);

  const startBroadcast = async () => {
    if (!token || !selectedLanguage) return;

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      await rec.startAsync();
      setRecording(rec);

      if (signalingServer.readyState === WebSocket.OPEN) {
        signalingServer.send(
          JSON.stringify({
            type: "broadcaster",
            language: selectedLanguage,
            token,
          })
        );
      }
      setBroadcasting(true);
      if (onLanguageActive) onLanguageActive(selectedLanguage);
    } catch (e) {
      console.error("❌ Error iniciando grabación:", e);
    }
  };

  const stopBroadcast = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }
    setBroadcasting(false);
    setSelectedLanguage(null);
    if (onLanguageActive) onLanguageActive(null);
  };

  if (!selectedLanguage) {
    return (
      <View style={styles.container}>
        <Text>🎙️ Selecciona el idioma a transmitir</Text>
        <View style={styles.languageButtons}>
          {[
            { code: "es", img: spanishFlag },
            { code: "en", img: englishFlag },
            { code: "ro", img: romanianFlag },
          ].map((lang) => (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setSelectedLanguage(lang.code)}
            >
              <Image source={lang.img} style={styles.flag} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!broadcasting ? (
        <Button
          title={`🚀 Iniciar transmisión en ${selectedLanguage}`}
          onPress={startBroadcast}
        />
      ) : (
        <View style={styles.broadcasting}>
          <Image source={liveMicIcon} style={styles.liveIcon} />
          <Text>Emitindo en {selectedLanguage}</Text>
          <Button title="🛑 Parar transmisión" onPress={stopBroadcast} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: "center" },
  languageButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  flag: { width: 50, height: 50, margin: 10 },
  broadcasting: { marginTop: 20, alignItems: "center" },
  liveIcon: { width: 40, height: 40, marginBottom: 10 },
});
