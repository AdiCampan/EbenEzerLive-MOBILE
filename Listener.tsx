// import React, { useEffect, useRef, useState } from "react";
// import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
// import {
//   RTCView,
//   mediaDevices,
//   RTCPeerConnection,
//   RTCSessionDescription,
//   RTCIceCandidate,
// } from "react-native-webrtc";
// import { Audio } from "expo-av";
// import * as Crypto from "expo-crypto";

// // Listener.tsx
// export const rtcConfig = {
//   iceServers: [
//     { urls: "stun:stun.relay.metered.ca:80" },

//     {
//       urls: "turn:standard.relay.metered.ca:80",
//       username: "a84708960fcf4892420ec951",
//       credential: "TXNIBjBYy24WPj2r",
//     },

//     {
//       urls: "turn:standard.relay.metered.ca:80?transport=tcp",
//       username: "a84708960fcf4892420ec951",
//       credential: "TXNIBjBYy24WPj2r",
//     },

//     {
//       urls: "turn:standard.relay.metered.ca:443",
//       username: "a84708960fcf4892420ec951",
//       credential: "TXNIBjBYy24WPj2r",
//     },

//     {
//       urls: "turns:standard.relay.metered.ca:443?transport=tcp",
//       username: "a84708960fcf4892420ec951",
//       credential: "TXNIBjBYy24WPj2r",
//     },
//   ],
// };

// export default function Listener({ signalingServer, language, setRole }) {
//   const pcRef = useRef<RTCPeerConnection | null>(null);
//   const [status, setStatus] = useState("idle");
//   const candidateQueueRef = useRef<any[]>([]);
//   const [clientId] = useState(Crypto.randomUUID());

//   const soundRef = useRef<Audio.Sound | null>(null);

//   const requestOffer = () => {
//     if (!signalingServer || signalingServer.readyState !== WebSocket.OPEN)
//       return;
//     signalingServer.send(JSON.stringify({ type: "request-offer", language }));
//     setStatus("requesting");
//   };

//   const handleBack = () => {
//     if (language && signalingServer.readyState === WebSocket.OPEN) {
//       signalingServer.send(
//         JSON.stringify({ type: "stop-listening", language, clientId })
//       );
//     }
//     setRole(null);
//   };

//   useEffect(() => {
//     if (!signalingServer) return;

//     const handleMessage = async (event: any) => {
//       let data;
//       try {
//         data = JSON.parse(event.data);
//       } catch {
//         return;
//       }

//       if (data.type === "offer" && data.offer) {
//         setStatus("connecting");
//         if (pcRef.current) {
//           try {
//             pcRef.current.close();
//           } catch {}
//           pcRef.current = null;
//         }

//         const pc = new RTCPeerConnection(rtcConfig);
//         pcRef.current = pc;

//         pc.ontrack = async (ev) => {
//           const stream = ev.streams[0];
//           if (stream) {
//             const track = stream.getAudioTracks()[0];
//             if (track) {
//               const soundObject = new Audio.Sound();
//               soundRef.current = soundObject;
//               await soundObject.loadAsync({ uri: track.toString() }); // En RN WebRTC se puede usar MediaStream directamente
//               await soundObject.playAsync();
//             }
//           }
//           setStatus("connected");
//         };

//         pc.onicecandidate = (ev) => {
//           if (ev.candidate) {
//             signalingServer.send(
//               JSON.stringify({
//                 type: "candidate",
//                 candidate: ev.candidate,
//                 target: data.clientId,
//               })
//             );
//           }
//         };

//         try {
//           await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
//           candidateQueueRef.current.forEach((c) =>
//             pc.addIceCandidate(new RTCIceCandidate(c))
//           );
//           candidateQueueRef.current = [];

//           const answer = await pc.createAnswer();
//           await pc.setLocalDescription(answer);
//           signalingServer.send(
//             JSON.stringify({ type: "answer", answer, target: data.clientId })
//           );
//         } catch (err) {
//           console.warn("Error procesando offer:", err);
//           setStatus("error");
//         }
//       }

//       if (data.type === "candidate" && data.candidate) {
//         if (pcRef.current) {
//           try {
//             await pcRef.current.addIceCandidate(
//               new RTCIceCandidate(data.candidate)
//             );
//           } catch (err) {
//             console.warn("Error agregando candidate:", err);
//           }
//         } else {
//           candidateQueueRef.current.push(data.candidate);
//         }
//       }
//     };

//     signalingServer.addEventListener("message", handleMessage);
//     return () => signalingServer.removeEventListener("message", handleMessage);
//   }, [signalingServer]);

//   useEffect(() => {
//     if (!signalingServer) return;
//     if (signalingServer.readyState === WebSocket.OPEN) requestOffer();
//     else signalingServer.addEventListener("open", requestOffer, { once: true });

//     return () => {
//       signalingServer.removeEventListener("open", requestOffer);
//     };
//   }, [signalingServer, language]);

//   return (
//     <View style={styles.wrapper}>
//       <Text style={styles.title}>
//         🎧 Escuchando en{" "}
//         {language === "es"
//           ? "Español"
//           : language === "en"
//           ? "Inglés"
//           : "Rumano"}
//       </Text>

//       <Text style={styles.status}>
//         {status === "idle" && "🛑 No hay transmisión activa"}
//         {status === "requesting" && "📡 Solicitando conexión..."}
//         {status === "connecting" && "🔄 Conectando al transmisor..."}
//         {status === "connected" && "✅ Transmisión en vivo"}
//         {status === "error" && "⚠️ Error de conexión"}
//       </Text>

//       <View style={styles.buttons}>
//         <TouchableOpacity onPress={handleBack} style={styles.btn}>
//           <Text>← Volver</Text>
//         </TouchableOpacity>
//         <TouchableOpacity onPress={() => requestOffer()} style={styles.btn}>
//           <Text>Reintentar 🔄</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   wrapper: { flex: 1, padding: 16, backgroundColor: "#111" },
//   title: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 12 },
//   status: { fontSize: 16, color: "#fff", marginVertical: 8 },
//   buttons: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     marginTop: 20,
//   },
//   btn: { padding: 12, backgroundColor: "#444", borderRadius: 8 },
// });
