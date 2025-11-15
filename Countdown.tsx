// Countdown.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Button,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import * as Notifications from "expo-notifications";

interface CountdownProps {
  targetDate: string | null;
  onSetTargetDate: (newDate: string) => void;
  role: "broadcaster" | "listener" | null;
}

const Countdown: React.FC<CountdownProps> = ({
  targetDate,
  onSetTargetDate,
  role,
}) => {
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());
  const [reminderSet, setReminderSet] = useState(false);

  function calculateTimeLeft() {
    if (!targetDate) return null;
    const difference = +new Date(targetDate) - +new Date();
    if (difference <= 0) return null;
    return {
      días: Math.floor(difference / (1000 * 60 * 60 * 24)),
      horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutos: Math.floor((difference / 1000 / 60) % 60),
      segundos: Math.floor((difference / 1000) % 60),
    };
  }

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const handleReminder = async () => {
    if (Platform.OS !== "web") {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.granted) {
        setReminderSet(true);
        const trigger = new Date(targetDate!);
        trigger.setMinutes(trigger.getMinutes() - 5); // 5 min antes
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⏰ ¡Tu transmisión está por comenzar!",
            body: "La emisión inicia pronto 🚀",
          },
          trigger,
        });
      }
    }
  };

  if (!timeLeft) {
    return (
      <View style={styles.box}>
        <Text style={styles.title}>⏰ Próxima emisión</Text>
        <Text>¡Ya comenzó o terminó el evento!</Text>
        {role === "broadcaster" && (
          <View style={styles.setNext}>
            <Text>📅 Programar próxima emisión</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD HH:MM"
              value={targetDate || ""}
              onChangeText={onSetTargetDate}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>⏰ Próxima emisión</Text>
      <View style={styles.timer}>
        {Object.entries(timeLeft).map(([label, value]) => (
          <Text key={label} style={styles.timerText}>
            {value} {label}{" "}
          </Text>
        ))}
      </View>

      <Button
        title={reminderSet ? "🔔 Recordatorio activado" : "🔔 Recordar"}
        onPress={handleReminder}
        disabled={reminderSet}
      />

      {role === "broadcaster" && (
        <View style={styles.setNext}>
          <Text>📅 Programar próxima emisión</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD HH:MM"
            value={targetDate || ""}
            onChangeText={onSetTargetDate}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    padding: 15,
    marginVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  timer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  timerText: { fontSize: 16 },
  setNext: { marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 5,
    marginTop: 5,
    borderRadius: 5,
  },
});

export default Countdown;
