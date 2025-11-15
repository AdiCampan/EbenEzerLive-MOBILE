import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Easing,
  Platform,
  NativeModules,
  Linking,
  AppState,
  PermissionsAndroid,
  StyleSheet,
  Image,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  RTCView,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "react-native-webrtc";
import { Audio } from "expo-av";
import VIForegroundService from "@voximplant/react-native-foreground-service";
import InCallManager from "react-native-incall-manager";

import spanishFlag from "./assets/spanish-flag4.webp";
import englishFlag from "./assets/english-flag.webp";
import romanianFlag from "./assets/romanian-flag2.webp";

import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Youtube,
  Globe,
  MessageCircle,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import { Svg, Path } from "react-native-svg";
import { TURN_USERNAME, TURN_CREDENTIAL } from "@env";

const SIGNALING_URL = "wss://webrtc-live-ct59.onrender.com";

export const rtcConfig = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: [
        "turn:standard.relay.metered.ca:80",
        "turn:standard.relay.metered.ca:443",
        "turn:standard.relay.metered.ca:80?transport=tcp",
        "turn:standard.relay.metered.ca:443?transport=tcp",
      ],
      username: TURN_USERNAME,
      credential: TURN_CREDENTIAL,
    },
  ],
};

function AppContent() {
  const insets = useSafeAreaInsets();

  // --- WS & Refs ---
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const allowWSReconnect = useRef(true);

  // --- Estados ---
  const [activeLangs, setActiveLangs] = useState({
    es: false,
    en: false,
    ro: false,
  });
  const [listenerCounts, setListenerCounts] = useState({ es: 0, en: 0, ro: 0 });
  const [language, setLanguage] = useState<string | null>(null);
  const [status, setStatus] = useState("idle");
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [speakerOn, setSpeakerOn] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidateQueueRef = useRef<any[]>([]);
  const fgServiceRef = useRef<any | null>(null);
  const channelCreatedRef = useRef(false);
  const fgStartedRef = useRef(false);

  const { AudioModeModule } = NativeModules;

  // --- Audio setup ---
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          allowsRecordingIOS: false,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: 1,
          interruptionModeIOS: 1,
        });
        console.log("🎧 Audio configurado correctamente");
      } catch (e) {
        console.warn("⚠️ Error configurando audio:", e);
      }
    })();
  }, []);

  // --- Foreground Service Android ---
  useEffect(() => {
    if (Platform.OS === "android")
      fgServiceRef.current = VIForegroundService.getInstance();
  }, []);

  useEffect(() => {
    if (Platform.OS === "android") {
      (async () => {
        try {
          const grantedAudio = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
          );
          if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED)
            console.warn("⚠️ Permiso RECORD_AUDIO denegado");
          if (Platform.Version >= 33) {
            await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
          }
        } catch (e) {
          console.warn("⚠️ Error solicitando permisos:", e);
        }
      })();
    }
  }, []);

  const startForegroundService = useCallback(async () => {
    if (Platform.OS !== "android") return;
    try {
      if (!fgServiceRef.current) return;
      if (!channelCreatedRef.current) {
        await fgServiceRef.current.createNotificationChannel({
          id: "stream_channel",
          name: "Live Stream Audio",
          description: "Mantiene la transmisión activa en segundo plano",
          importance: 4,
        });
        channelCreatedRef.current = true;
      }
      await fgServiceRef.current.startService({
        channelId: "stream_channel",
        id: 420,
        title: "EbenEzer Live",
        text: "Transmitiendo audio en vivo 🎙️",
        icon: "ic_launcher",
      });
      fgStartedRef.current = true;
      AudioModeModule?.setModeNormal();
    } catch (err) {
      console.error("⚠️ Error iniciando servicio:", err);
    }
  }, []);

  const stopForegroundService = useCallback(async () => {
    if (Platform.OS !== "android") return;
    try {
      if (fgServiceRef.current && fgStartedRef.current) {
        await fgServiceRef.current.stopService();
        fgStartedRef.current = false;
      }
    } catch (err) {
      console.warn("⚠️ Error deteniendo servicio:", err);
    }
  }, []);

  // --- WebSocket ---
  const createSocket = useCallback(() => {
    console.log("🌐 Creando WebSocket…");
    const ws = new WebSocket(SIGNALING_URL);
    wsRef.current = ws;
    setSocket(ws);

    ws.onopen = () => console.log("✅ WS conectado");
    ws.onerror = (e) => console.warn("⚠️ WS error", e?.message || e);
    ws.onclose = () => {
      console.warn("🔌 WS cerrado");
      if (!allowWSReconnect.current) return;
      console.log("♻️ Reintentando conexión WS en 4s…");
      setTimeout(() => createSocket(), 4000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "active-broadcasts") {
          setActiveLangs({
            es: !!data.active?.es,
            en: !!data.active?.en,
            ro: !!data.active?.ro,
          });
        }
        if (data.type === "listeners-count") {
          setListenerCounts({
            es: data.listeners?.es || 0,
            en: data.listeners?.en || 0,
            ro: data.listeners?.ro || 0,
          });
        }
        if (data.type === "offer") handleOffer(data);
        if (data.type === "candidate") handleCandidate(data);
      } catch (err) {
        console.error("⚠️ Error parsing WS:", err);
      }
    };
  }, []);

  useEffect(() => {
    allowWSReconnect.current = true;
    createSocket();
    return () => wsRef.current?.close();
  }, []);

  const requestOffer = useCallback(() => {
    if (
      !language ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    wsRef.current.send(JSON.stringify({ type: "request-offer", language }));
    setStatus("requesting");
  }, [language]);

  const handleOffer = useCallback(
    async (data: any) => {
      setStatus("connecting");
      if (pcRef.current) pcRef.current.close();
      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      pc.ontrack = (event: any) => {
        const stream = event.streams[0];
        if (stream) {
          setRemoteStream(stream);
          setStatus("connected");
          if (Platform.OS === "android") {
            try {
              if (AudioModeModule?.setModeNormal)
                AudioModeModule.setModeNormal();
              InCallManager.start({ media: "audio", auto: true });
            } catch (err) {
              console.warn("⚠️ Error ajustando audio:", err);
            }
          }
          startForegroundService().catch(console.error);
        }
      };

      pc.onicecandidate = (ev: any) => {
        if (ev.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              type: "candidate",
              candidate: ev.candidate,
              target: data.clientId,
            })
          );
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        candidateQueueRef.current.forEach((c) =>
          pc.addIceCandidate(new RTCIceCandidate(c))
        );
        candidateQueueRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        wsRef.current?.send(
          JSON.stringify({ type: "answer", answer, target: data.clientId })
        );
      } catch (err) {
        console.warn("❌ Error procesando oferta:", err);
        setStatus("error");
      }
    },
    [startForegroundService]
  );

  const handleCandidate = useCallback(async (data: any) => {
    if (pcRef.current) {
      try {
        await pcRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
      } catch (err) {
        console.warn("⚠️ Error agregando candidate:", err);
      }
    } else {
      candidateQueueRef.current.push(data.candidate);
    }
  }, []);

  const stopListening = useCallback(() => {
    allowWSReconnect.current = false; // Evita reconexión automática de PC
    try {
      // Enviar stop-listening si WS está abierto
      if (wsRef.current?.readyState === WebSocket.OPEN && language) {
        wsRef.current.send(
          JSON.stringify({ type: "stop-listening", language })
        );
        console.log("📩 stop-listening enviado");
      }

      // Cerrar PeerConnection
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
      pcRef.current = null;

      // Reset UI y estado
      setRemoteStream(null);
      setLanguage(null);
      setStatus("idle");
      setSpeakerOn(false);

      // Audio Android
      if (Platform.OS === "android") {
        InCallManager.setSpeakerphoneOn(false);
        InCallManager.stop();
        if (AudioModeModule?.resetAudioState) AudioModeModule.resetAudioState();
        else if (AudioModeModule?.setModeNormal)
          AudioModeModule.setModeNormal();
        if (AudioModeModule?.stopAudioMonitoring)
          AudioModeModule.stopAudioMonitoring();
        if (AudioModeModule?.stopCleanupService)
          AudioModeModule.stopCleanupService();
      }

      // Foreground service
      stopForegroundService().catch(console.warn);
    } catch (err) {
      console.warn("⚠️ Error stopping listening:", err);
    }
  }, [language, stopForegroundService]);

  useEffect(() => {
    const initListening = async () => {
      if (!language) {
        // Detener servicios si language es null
        if (Platform.OS === "android") {
          try {
            if (AudioModeModule?.stopAudioMonitoring)
              AudioModeModule.stopAudioMonitoring();
            if (AudioModeModule?.stopCleanupService)
              AudioModeModule.stopCleanupService();
          } catch (e) {
            console.warn("⚠️ Error deteniendo servicios:", e);
          }
        }
        return;
      }

      // WS: si está cerrado, recrearlo
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log("🔄 WebSocket cerrado, recreando...");
        allowWSReconnect.current = true;
        await createSocket();

        // Esperar a que se abra
        await new Promise<void>((resolve) => {
          const check = () => {
            if (wsRef.current?.readyState === WebSocket.OPEN) resolve();
            else setTimeout(check, 100);
          };
          check();
        });
      }

      // Servicios Android
      if (Platform.OS === "android") {
        try {
          if (AudioModeModule?.startAudioMonitoring)
            AudioModeModule.startAudioMonitoring();
          if (AudioModeModule?.startCleanupService)
            AudioModeModule.startCleanupService();
        } catch (e) {
          console.warn("⚠️ Error iniciando servicios:", e);
        }
      }

      // Solicitar offer
      requestOffer();
    };

    initListening();
  }, [language, createSocket, requestOffer]);

  // --- AppState para limpiar audio al background ---
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (Platform.OS === "android") {
          try {
            InCallManager.setSpeakerphoneOn(false);
            InCallManager.stop();
            if (AudioModeModule?.resetAudioState)
              AudioModeModule.resetAudioState();
            else if (AudioModeModule?.setModeNormal)
              AudioModeModule.setModeNormal();
            if (AudioModeModule?.stopAudioMonitoring)
              AudioModeModule.stopAudioMonitoring();
            if (AudioModeModule?.stopCleanupService)
              AudioModeModule.stopCleanupService();
            console.log("🔇 Audio reset completo en background");
          } catch (e) {
            console.warn("⚠️ Error resetting audio on background:", e);
          }
        }
      }
    };
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription?.remove();
  }, []);

  // --- Limpieza completa al desmontar ---
  useEffect(() => {
    return () => {
      stopForegroundService().catch(() => {});
      wsRef.current?.close();
      if (Platform.OS === "android") {
        try {
          InCallManager.setSpeakerphoneOn(false);
          InCallManager.stop();
          if (AudioModeModule?.resetAudioState)
            AudioModeModule.resetAudioState();
          else if (AudioModeModule?.setModeNormal)
            AudioModeModule.setModeNormal();
          if (AudioModeModule?.stopAudioMonitoring)
            AudioModeModule.stopAudioMonitoring();
          if (AudioModeModule?.stopCleanupService)
            AudioModeModule.stopCleanupService();
          if (AudioModeModule?.forceNormalAudioMode)
            AudioModeModule.forceNormalAudioMode();
          console.log("🧹 Limpieza completa de audio al desmontar");
        } catch (e) {
          console.warn("⚠️ Error cleanup audio:", e);
        }
      }
    };
  }, [stopForegroundService]);

  // --- Speaker toggle ---
  const toggleSpeaker = useCallback(() => {
    const newState = !speakerOn;
    setSpeakerOn(newState);
    InCallManager.setSpeakerphoneOn(newState);
  }, [speakerOn]);

  // --- Emergency reset ---
  const emergencyAudioReset = useCallback(() => {
    if (Platform.OS === "android") {
      try {
        InCallManager.setSpeakerphoneOn(false);
        InCallManager.stop();
        if (AudioModeModule?.resetAudioState) AudioModeModule.resetAudioState();
        if (AudioModeModule?.stopAudioMonitoring)
          AudioModeModule.stopAudioMonitoring();
        if (AudioModeModule?.stopCleanupService)
          AudioModeModule.stopCleanupService();
        if (AudioModeModule?.forceNormalAudioMode)
          AudioModeModule.forceNormalAudioMode();
        else if (AudioModeModule?.setModeNormal)
          AudioModeModule.setModeNormal();
        setSpeakerOn(false);
        console.log("🚨 Emergency audio reset executed");
      } catch (e) {
        console.warn("⚠️ Error en emergency reset:", e);
      }
    }
  }, []);

  // --- Animación audio ---
  const animScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (remoteStream) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(animScale, {
            toValue: 1.3,
            duration: 470,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(animScale, {
            toValue: 1.0,
            duration: 470,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      );
      animation.start();
    } else animScale.setValue(1.0);
    return () => {
      if (animation) animation.stop();
    };
  }, [remoteStream, animScale]);

  // ---------- UI ----------
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: "#171f2e" }}
      edges={["top", "bottom"]}
    >
      <View style={[styles.titleBand, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>TRANSMISIÓN EN VIVO</Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingBottom: insets.bottom + 90,
            paddingTop: insets.top + 60,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Alterna selección de idioma o listener (no ambos) */}
        {!language || !remoteStream ? (
          <View style={styles.languageRow}>
            {[
              { code: "es", label: "Español", img: spanishFlag },
              { code: "en", label: "Inglés", img: englishFlag },
              { code: "ro", label: "Rumano", img: romanianFlag },
            ].map(({ code, label, img }) => {
              const active = (activeLangs as any)[code];
              return (
                <TouchableOpacity
                  key={code}
                  onPress={() => {
                    if (!active) return;
                    if (
                      !wsRef.current ||
                      wsRef.current.readyState !== WebSocket.OPEN
                    ) {
                      console.log(
                        "🔄 Reiniciando WebSocket antes de escuchar…"
                      );
                      allowWSReconnect.current = true;
                      createSocket();
                    }
                    setLanguage(code);
                  }}
                  disabled={!active}
                  style={[styles.langBtn, !active && { opacity: 0.4 }]}
                >
                  <View style={styles.flagCircle}>
                    <Image
                      source={img}
                      style={styles.flagImg}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.langText}>{label}</Text>
                  <View
                    style={[
                      styles.langStatusCircle,
                      { backgroundColor: active ? "#38e37e" : "#e84545" },
                    ]}
                  />
                  {/* <Text style={styles.count}>
                  {(listenerCounts as any)[code]} oyentes
                </Text> */}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.audioContainer}>
            <Animated.View
              style={[
                styles.audioIconBox,
                { transform: [{ scale: animScale }] },
              ]}
            >
              <Volume2 color="#3ee8ef" size={69} />
            </Animated.View>
            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={styles.stopButton}
                onPress={stopListening}
              >
                <Text style={styles.stopLabel}>Detener</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.speakerButton,
                  { backgroundColor: speakerOn ? "#1d7fa6" : "#283753" },
                ]}
                onPress={toggleSpeaker}
                activeOpacity={0.8}
                accessibilityLabel="Alternar altavoz"
              >
                {speakerOn ? (
                  <Volume2 color="#fff" size={22} />
                ) : (
                  <VolumeX color="#fff" size={22} />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={emergencyAudioReset}
              activeOpacity={0.8}
            >
              <Text style={styles.emergencyLabel}>🚨 Reset Audio</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* --- SIEMPRE debajo, las cajas de info y contacto --- */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Bienvenidos a la transmisión en vivo con traducción simultánea de
            Iglesia Pentecostal Rumana EBEN-EZER Castellon de la Plana {"\n\n"}
            El horario de las emisiones será:
          </Text>
          <View style={styles.infoListBox}>
            <Text style={styles.infoListItem}>
              • Domingos 10:00 -12:00 y 18:00 - 20:00
            </Text>
            <Text style={styles.infoListItem}>• Martes 20:00 - 21:30</Text>
            <Text style={styles.infoListItem}>• Jueves 20:00 - 21:30</Text>
          </View>
          <Text style={styles.infoText}>
            {"\n"}Si necesitas auriculares o adaptadores, contacta con el equipo
            de sonido. ¡Gracias por acompañarnos!
          </Text>
          {/* Botón WhatsApp al final de la info */}
          <View style={{ alignItems: "center", marginTop: 9 }}>
            <TouchableOpacity
              style={styles.contactBtn}
              activeOpacity={0.84}
              onPress={() => {
                Linking.openURL(
                  "https://wa.me/34637951683?text=Hola!%20Quisiera%20m%20informaci%C3%B3n%20sobre%20la%20transmisi%C3%B3n"
                );
              }}
              accessibilityLabel="Solicita un técnico por WhatsApp"
            >
              <View style={{ marginRight: 10 }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="white">
                  <Path d="M12.04 2C6.49 2 2 6.47 2 11.99c0 2.11.57 4.05 1.63 5.79L2 22l4.41-1.61c1.67.91 3.56 1.39 5.63 1.39h.01c5.55 0 10.04-4.47 10.04-9.99C22.08 6.47 17.59 2 12.04 2zm5.69 14.31c-.24.68-1.38 1.3-1.89 1.38-.48.07-1.08.1-1.74-.11-.4-.13-.92-.29-1.58-.57-2.78-1.19-4.6-3.97-4.74-4.15-.14-.18-1.13-1.49-1.13-2.84 0-1.35.72-2.02.98-2.3.26-.28.57-.35.76-.35.18 0 .38.01.55.01.18 0 .42-.07.65.5.24.57.82 1.98.89 2.12.07.14.11.3.02.48-.09.18-.13.3-.25.46-.13.16-.27.36-.39.49-.13.14-.27.29-.12.57.14.28.61.99 1.31 1.6.9.8 1.65 1.05 1.94 1.19.3.14.46.12.63-.07.18-.2.72-.83.92-1.12.2-.28.39-.23.65-.14.26.09 1.64.77 1.92.9.28.14.47.2.54.31.06.11.06.64-.18 1.32z" />
                </Svg>
              </View>
              <Text style={styles.contactBtnLabel}>SOLICITA UN TÉCNICO</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.rightColumn}>
          <View style={styles.textBox}>
            <Text style={styles.textItem}>
              <MapPin size={16} color="#00b4d8" /> Dirección: Camí de la
              Donació, 89, 12004, Castellón de la Plana
            </Text>
            <Text style={styles.textItem}>
              <Phone size={16} color="#00b4d8" /> Teléfono: +34 687-210-586
            </Text>
            <Text style={styles.textItem}>
              <Mail size={16} color="#00b4d8" /> Email:
              biserica_ebenezer@yahoo.es
            </Text>
            <Text style={styles.textItem}>
              <Clock size={16} color="#00b4d8" /> Horario:{"\n"}Domingos
              10:00–12:00 y 18:00–20:00{"\n"}Martes 20:00–21:30{"\n"}Jueves
              20:00–21:30
            </Text>
            <Text style={styles.textItem}>
              <Youtube size={16} color="#00b4d8" />{" "}
              <Text style={styles.link}>
                youtube.com/@bisericaebenezercastellon
              </Text>
            </Text>
            <Text style={styles.textItem}>
              <Globe size={16} color="#00b4d8" />{" "}
              <Text style={styles.link}>www.bisericaebenezer.com</Text>
            </Text>
            <Text style={styles.textItem}>
              <MessageCircle size={16} color="#00b4d8" /> WhatsApp: +34 624 227
              214
            </Text>
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footerBand, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.footer}>© EBEN-EZER Media 2025</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    minHeight: "100%",
    padding: 16,
    backgroundColor: "#171f2e",
    alignItems: "center",
  },
  titleBand: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingVertical: 8,
    backgroundColor: "#171f2e",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#334060",
    zIndex: 50,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f4f7fb",
    margin: 0,
  },
  languageRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginBottom: 10,
  },
  langBtn: {
    backgroundColor: "#222e3c",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    width: 100,
    shadowColor: "#161d28",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1.2,
    borderColor: "#283753",
  },
  flagCircle: {
    width: 60,
    height: 60,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#171f2e",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222e3c",
    marginBottom: 6,
  },
  flagImg: {
    width: "100%",
    height: "100%",
  },
  langText: {
    fontSize: 12,
    color: "#68a0ed",
    fontWeight: "600",
    textAlign: "center",
  },
  count: {
    color: "#3ee8ef",
    fontSize: 12,
    marginTop: 4,
  },
  audioContainer: {
    marginVertical: 20,
    width: "100%",
    alignItems: "center",
  },
  rtcView: {
    width: "100%",
    height: 80,
    borderRadius: 12,
    backgroundColor: "#222e3c",
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 10,
  },
  canvas: {
    width: "100%",
    height: 80,
    backgroundColor: "#111",
    borderRadius: 12,
    marginTop: 10,
  },
  stopButton: {
    marginTop: 10,
    backgroundColor: "#2352a7",
    paddingVertical: 11,
    paddingHorizontal: 22,
    borderRadius: 13,
    shadowColor: "#1a406f",
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 7,
    alignSelf: "center",
  },
  stopLabel: {
    color: "#f4f7fb",
    fontWeight: "700",
    fontSize: 16,
  },
  speakerButton: {
    marginTop: 5,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 50,
    width: 46,
    height: 46,
    shadowColor: "#143a56",
    shadowOpacity: 0.19,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: "center",
    backgroundColor: "#1d7fa6",
  },
  emergencyButton: {
    marginTop: 8,
    backgroundColor: "#e74c3c",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: "center",
    shadowColor: "#c0392b",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  emergencyLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  rightColumn: {
    marginTop: 20,
    width: "100%",
  },
  textBox: {
    backgroundColor: "#222e3c",
    padding: 18,
    borderRadius: 17,
    shadowColor: "#121a22",
    shadowOpacity: 0.11,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    borderWidth: 1.3,
    borderColor: "#283753",
  },
  textItem: {
    color: "#f4f7fb",
    fontSize: 15,
    marginBottom: 8,
    lineHeight: 21,
  },
  link: {
    color: "#82eefd",
    textDecorationLine: "underline",
  },
  footer: {
    color: "#b7cced",
    fontSize: 10,
    fontWeight: "500",
  },
  audioIconBox: {
    width: 80,
    height: 80,
    marginBottom: 4,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 60,
    backgroundColor: "transparent",
  },
  infoBox: {
    backgroundColor: "#202f47",
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
    marginTop: 2,
    borderWidth: 1.4,
    borderColor: "#3ee8ef33",
    shadowColor: "#182030",
    shadowOpacity: 0.17,
    shadowRadius: 10,
    elevation: 6,
  },
  infoText: {
    color: "#e3f6fb",
    fontSize: 14.5,
    marginBottom: 2,
    lineHeight: 22,
    fontWeight: "500",
  },
  infoListBox: {
    marginTop: 2,
    marginBottom: 5,
    marginLeft: 10,
  },
  infoListItem: {
    color: "#5de6fa",
    fontSize: 15,
    marginBottom: 1,
    lineHeight: 21,
    fontWeight: "600",
  },
  contactBox: {
    marginVertical: 9,
    backgroundColor: "#183956",
    borderRadius: 13,
    borderWidth: 1.1,
    borderColor: "#23e6a988",
    alignItems: "center",
    alignSelf: "stretch",
    padding: 10,
    shadowColor: "#172a3a",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 27,
    backgroundColor: "#22b573",
    shadowColor: "#155a41",
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  contactBtnLabel: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  langStatusCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginTop: 4,
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: "#222e3c",
  },
  footerBand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 2,
    backgroundColor: "#222e3cdd",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#334060",
    zIndex: 50,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// // App.tsx
// import React, { useEffect, useRef, useState, useCallback } from "react";
// import {
//   View,
//   Text,
//   Image,
//   ScrollView,
//   TouchableOpacity,
//   StyleSheet,
//   ActivityIndicator,
//   PermissionsAndroid,
//   Platform,
//   NativeModules,
// } from "react-native";
// import {
//   RTCView,
//   RTCPeerConnection,
//   RTCSessionDescription,
//   RTCIceCandidate,
// } from "react-native-webrtc";
// import { Audio } from "expo-av";
// import VIForegroundService from "@voximplant/react-native-foreground-service";
// import InCallManager from "react-native-incall-manager";

// import spanishFlag from "./assets/spanish-flag4.webp";
// import englishFlag from "./assets/english-flag.webp";
// import romanianFlag from "./assets/romanian-flag2.webp";
// import logo from "./assets/logo2.webp";

// const SIGNALING_URL = "wss://webrtc-live-ct59.onrender.com";

// export const rtcConfig = {
//   iceServers: [
//     { urls: "stun:stun.relay.metered.ca:80" },
//     {
//       urls: [
//         "turn:standard.relay.metered.ca:80",
//         "turn:standard.relay.metered.ca:443",
//         "turn:standard.relay.metered.ca:80?transport=tcp",
//         "turn:standard.relay.metered.ca:443?transport=tcp",
//       ],
//       username: "a84708960fcf4892420ec951",
//       credential: "TXNIBjBYy24WPj2r",
//     },
//   ],
// };

// export default function App() {
//   const [socket, setSocket] = useState<WebSocket | null>(null);
//   const wsRef = useRef<WebSocket | null>(null);

//   const [activeLangs, setActiveLangs] = useState({
//     es: false,
//     en: false,
//     ro: false,
//   });
//   const [listenerCounts, setListenerCounts] = useState({ es: 0, en: 0, ro: 0 });

//   const [language, setLanguage] = useState<string | null>(null);
//   const [status, setStatus] = useState("idle");
//   const [remoteStream, setRemoteStream] = useState<any>(null);

//   const pcRef = useRef<RTCPeerConnection | null>(null);
//   const candidateQueueRef = useRef<any[]>([]);

//   const fgServiceRef = useRef<any | null>(null);
//   const channelCreatedRef = useRef(false);
//   const fgStartedRef = useRef(false);

//   const { AudioModeModule } = NativeModules;

//   // ---------- Configurar modo de audio base ----------
//   useEffect(() => {
//     (async () => {
//       try {
//         await Audio.setAudioModeAsync({
//           staysActiveInBackground: true,
//           playsInSilentModeIOS: true,
//           allowsRecordingIOS: false,
//           shouldDuckAndroid: false,
//           playThroughEarpieceAndroid: false,
//           interruptionModeAndroid: 1,
//           interruptionModeIOS: 1,
//         });

//         console.log("🎧 Modo de audio configurado correctamente");
//       } catch (e) {
//         console.warn("⚠️ Error configurando modo de audio", e);
//       }
//     })();
//   }, []);

//   // ---------- Inicializar Foreground Service ----------
//   useEffect(() => {
//     if (Platform.OS === "android") {
//       fgServiceRef.current = VIForegroundService.getInstance();
//     }
//   }, []);

//   // ---------- Solicitar permisos Android ----------
//   useEffect(() => {
//     if (Platform.OS === "android") {
//       (async () => {
//         try {
//           const grantedAudio = await PermissionsAndroid.request(
//             PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
//           );
//           if (grantedAudio !== PermissionsAndroid.RESULTS.GRANTED) {
//             console.warn("⚠️ Permiso RECORD_AUDIO denegado");
//           }

//           if (Platform.Version >= 33) {
//             const grantedNoti = await PermissionsAndroid.request(
//               PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
//               {
//                 title: "Permiso de notificaciones",
//                 message:
//                   "Necesitamos permiso para mostrar la notificación del servicio en segundo plano.",
//                 buttonPositive: "Aceptar",
//               }
//             );
//             if (grantedNoti !== PermissionsAndroid.RESULTS.GRANTED) {
//               console.warn(
//                 "⚠️ Permiso POST_NOTIFICATIONS no concedido - no se iniciará foreground service"
//               );
//             }
//           }
//         } catch (e) {
//           console.warn("⚠️ Error solicitando permisos:", e);
//         }
//       })();
//     }
//   }, []);

//   // ---------- Funciones Foreground Service ----------
//   const startForegroundService = useCallback(async () => {
//     if (Platform.OS !== "android") return;

//     try {
//       if (!fgServiceRef.current) {
//         console.warn("⚠️ ForegroundService no inicializado");
//         return;
//       }

//       if (!channelCreatedRef.current) {
//         await fgServiceRef.current.createNotificationChannel({
//           id: "stream_channel",
//           name: "Live Stream Audio",
//           description: "Mantiene la transmisión activa en segundo plano",
//           importance: 4,
//         });
//         channelCreatedRef.current = true;
//         console.log("🔊 Canal de notificación creado correctamente");
//       }

//       await fgServiceRef.current.startService({
//         channelId: "stream_channel",
//         id: 420,
//         title: "EbenEzer Live",
//         text: "Transmitiendo audio en vivo 🎙️",
//         icon: "ic_launcher",
//       });

//       fgStartedRef.current = true;
//       console.log("✅ Foreground service iniciado");

//       // ⚡ Forzar Audio Normal después de iniciar Foreground Service
//       AudioModeModule?.setModeNormal();
//       // AudioModeModule?.setSpeakerOn(true);
//     } catch (err) {
//       console.error("⚠️ Error iniciando foreground service:", err);
//     }
//   }, []);

//   const stopForegroundService = useCallback(async () => {
//     if (Platform.OS !== "android") return;
//     try {
//       if (fgServiceRef.current && fgStartedRef.current) {
//         await fgServiceRef.current.stopService();
//         fgStartedRef.current = false;
//         console.log("⛔ Foreground service detenido");
//       }
//     } catch (err) {
//       console.warn("⚠️ Error deteniendo foreground service:", err);
//     }
//   }, []);

//   // ---------- WebSocket ----------
//   const createSocket = useCallback(() => {
//     const ws = new WebSocket(SIGNALING_URL);
//     wsRef.current = ws;
//     setSocket(ws);

//     ws.onopen = () => console.log("✅ WS conectado");
//     ws.onerror = (e) => console.warn("⚠️ WS error", (e as any).message || e);
//     ws.onclose = () => {
//       console.warn("🔌 WS cerrado, reintentando...");
//       setTimeout(createSocket, 4000);
//     };

//     ws.onmessage = (event) => {
//       try {
//         const data = JSON.parse(event.data);
//         if (data.type === "active-broadcasts") {
//           setActiveLangs({
//             es: !!data.active?.es,
//             en: !!data.active?.en,
//             ro: !!data.active?.ro,
//           });
//         }
//         if (data.type === "listeners-count") {
//           setListenerCounts({
//             es: data.listeners?.es || 0,
//             en: data.listeners?.en || 0,
//             ro: data.listeners?.ro || 0,
//           });
//         }
//         if (data.type === "offer" && data.offer) handleOffer(data);
//         if (data.type === "candidate" && data.candidate) handleCandidate(data);
//       } catch (err) {
//         console.error("⚠️ Error parsing WS:", err);
//       }
//     };
//   }, []);

//   useEffect(() => {
//     createSocket();
//     return () => wsRef.current?.close();
//   }, []);

//   // ---------- Solicitar oferta ----------
//   const requestOffer = useCallback(() => {
//     if (
//       !language ||
//       !wsRef.current ||
//       wsRef.current.readyState !== WebSocket.OPEN
//     )
//       return;
//     wsRef.current.send(JSON.stringify({ type: "request-offer", language }));
//     setStatus("requesting");
//   }, [language]);

//   // ---------- Procesar oferta ----------
//   const handleOffer = useCallback(
//     async (data: any) => {
//       setStatus("connecting");
//       if (pcRef.current) {
//         pcRef.current.close();
//         pcRef.current = null;
//       }

//       const pc = new RTCPeerConnection(rtcConfig);
//       pcRef.current = pc;

//       pc.ontrack = (event: any) => {
//         const stream = event.streams[0];
//         if (stream) {
//           setRemoteStream(stream);
//           setStatus("connected");

//           if (Platform.OS === "android") {
//             try {
//               // 🔧 Forzar modo normal de audio (no llamada)
//               const { AudioModeModule } = NativeModules;
//               if (AudioModeModule?.setModeNormal) {
//                 AudioModeModule.setModeNormal();
//                 console.log("🎚️ Modo de audio forzado a NORMAL para Bluetooth");
//               }

//               // Opcional: si quieres, puedes iniciar InCallManager sin forzar altavoz
//               InCallManager.start({ media: "audio", auto: true });

//               // NO se fuerza el altavoz, se respeta la salida actual (auriculares, Bluetooth, etc.)
//             } catch (err) {
//               console.warn("⚠️ Error ajustando audio:", err);
//             }
//           }

//           // 🔊 Arrancar el servicio foreground
//           startForegroundService().catch(console.error);
//         }
//       };

//       pc.onicecandidate = (ev: any) => {
//         if (ev.candidate && wsRef.current) {
//           wsRef.current.send(
//             JSON.stringify({
//               type: "candidate",
//               candidate: ev.candidate,
//               target: data.clientId,
//             })
//           );
//         }
//       };

//       try {
//         await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
//         candidateQueueRef.current.forEach((c) =>
//           pc.addIceCandidate(new RTCIceCandidate(c))
//         );
//         candidateQueueRef.current = [];

//         const answer = await pc.createAnswer();
//         await pc.setLocalDescription(answer);

//         wsRef.current?.send(
//           JSON.stringify({ type: "answer", answer, target: data.clientId })
//         );
//       } catch (err) {
//         console.warn("❌ Error procesando oferta:", err);
//         setStatus("error");
//       }
//     },
//     [startForegroundService]
//   );

//   const handleCandidate = useCallback(async (data: any) => {
//     if (pcRef.current) {
//       try {
//         await pcRef.current.addIceCandidate(
//           new RTCIceCandidate(data.candidate)
//         );
//       } catch (err) {
//         console.warn("⚠️ Error agregando candidate:", err);
//       }
//     } else {
//       candidateQueueRef.current.push(data.candidate);
//     }
//   }, []);

//   // ---------- Stop listening ----------
//   const stopListening = useCallback(() => {
//     try {
//       pcRef.current?.getSenders().forEach((s: any) => s.track?.stop());
//       pcRef.current?.close();
//       pcRef.current = null;
//       setRemoteStream(null);
//       setLanguage(null);
//       setStatus("idle");

//       if (Platform.OS === "android") {
//         InCallManager.stop();
//       }

//       stopForegroundService().catch(console.warn);
//     } catch (err) {
//       console.warn("⚠️ Error stopping listening:", err);
//     }
//   }, [stopForegroundService]);

//   useEffect(() => {
//     if (language) requestOffer();
//   }, [language, requestOffer]);

//   useEffect(() => {
//     return () => {
//       stopForegroundService().catch(() => {});
//       wsRef.current?.close();
//       if (Platform.OS === "android") {
//         InCallManager.stop();
//       }
//     };
//   }, [stopForegroundService]);

//   // ---------- UI ----------
//   if (!socket) {
//     return (
//       <View style={styles.loading}>
//         <ActivityIndicator size="large" />
//         <Text>Conectando con el servidor...</Text>
//       </View>
//     );
//   }

//   return (
//     <ScrollView contentContainerStyle={styles.container}>
//       <Text style={styles.title}>🎧 Escucha la transmisión</Text>

//       {!language && (
//         <View style={styles.languageRow}>
//           {[
//             { code: "es", label: "Español", img: spanishFlag },
//             { code: "en", label: "Inglés", img: englishFlag },
//             { code: "ro", label: "Rumano", img: romanianFlag },
//           ].map(({ code, label, img }) => {
//             const active = (activeLangs as any)[code];
//             return (
//               <TouchableOpacity
//                 key={code}
//                 onPress={() => active && setLanguage(code)}
//                 disabled={!active}
//                 style={[styles.langBtn, !active && { opacity: 0.4 }]}
//               >
//                 <Image source={img} style={styles.flag} />
//                 <Text style={styles.langText}>
//                   {label} {active ? "🟢" : "🔴"}
//                 </Text>
//                 <Text style={styles.count}>
//                   {(listenerCounts as any)[code]} oyentes
//                 </Text>
//               </TouchableOpacity>
//             );
//           })}
//         </View>
//       )}

//       {language && (
//         <View style={styles.listenerBox}>
//           <Text style={styles.subTitle}>
//             Escuchando en{" "}
//             {language === "es"
//               ? "Español"
//               : language === "en"
//               ? "Inglés"
//               : "Rumano"}
//           </Text>

//           {status === "connecting" && (
//             <ActivityIndicator size="large" color="#fff" />
//           )}
//           <Text style={styles.statusText}>
//             {status === "idle" && "🛑 No hay transmisión activa"}
//             {status === "requesting" && "📡 Solicitando conexión..."}
//             {status === "connecting" && "🔄 Conectando al transmisor..."}
//             {status === "connected" && "✅ Transmisión en vivo"}
//             {status === "error" && "⚠️ Error de conexión"}
//           </Text>

//           {remoteStream && (
//             <RTCView
//               streamURL={remoteStream.toURL()}
//               style={{ width: 0, height: 0 }}
//             />
//           )}

//           <View style={styles.buttons}>
//             <TouchableOpacity style={styles.btn} onPress={stopListening}>
//               <Text>← Volver</Text>
//             </TouchableOpacity>
//             <TouchableOpacity style={styles.btn} onPress={requestOffer}>
//               <Text>🔄 Reintentar</Text>
//             </TouchableOpacity>
//           </View>
//         </View>
//       )}

//       <Image source={logo} style={styles.logo} />
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { padding: 20, alignItems: "center" },
//   loading: { flex: 1, justifyContent: "center", alignItems: "center" },
//   title: { fontSize: 22, marginVertical: 15 },
//   languageRow: { flexDirection: "row", justifyContent: "center" },
//   langBtn: {
//     alignItems: "center",
//     marginHorizontal: 10,
//     padding: 10,
//     borderRadius: 10,
//     backgroundColor: "#eee",
//   },
//   flag: { width: 60, height: 60, marginBottom: 5 },
//   langText: { fontWeight: "bold" },
//   count: { fontSize: 12, color: "#555" },
//   listenerBox: {
//     backgroundColor: "#111",
//     borderRadius: 12,
//     padding: 16,
//     width: "90%",
//     marginTop: 20,
//   },
//   subTitle: { color: "#fff", fontSize: 18, fontWeight: "bold" },
//   statusText: { color: "#fff", marginVertical: 10 },
//   buttons: {
//     flexDirection: "row",
//     justifyContent: "space-around",
//     marginTop: 10,
//   },
//   btn: { padding: 10, backgroundColor: "#444", borderRadius: 8 },
//   logo: { width: 150, height: 150, marginTop: 30 },
// });
