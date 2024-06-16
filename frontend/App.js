import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Button,
  Text,
  View,
  Alert,
  ActivityIndicator,
  ScrollView
} from "react-native";
import * as Permissions from "expo-permissions";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const SERVER_URL = "ws://192.168.1.224:8008/ws";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [recording, setRecording] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const requestPermissions = async () => {
    const { status } = await Permissions.askAsync(Permissions.AUDIO_RECORDING);
    if (status !== "granted") {
      Alert.alert("Permissions not granted");
    }
  };

  const startConnection = async () => {
    const socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      console.log("Connected to server");
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        setResponseText(event.data);
        setCodeSnippet(event.data);
      } else {
        playAudio(event.data);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from server");
    };

    setConnection({ socket });
  };

  const startRecording = async () => {
    try {
      console.log("Requesting permissions..");
      await Audio.requestPermissionsAsync();

      console.log("Starting recording..");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    console.log("Stopping recording..");
    setRecording(undefined);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    console.log("Recording stopped and stored at", uri);
    sendAudio(uri);
  };

  const sendAudio = async (uri) => {
    if (!connection || !connection.socket) return;

    try {
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });
      connection.socket.send(audioData); // Ensure audioData is sent as binary
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const playAudio = async (audioData) => {
    setLoading(true);
    try {
      const sound = new Audio.Sound();
      const uri = FileSystem.documentDirectory + "response.wav";
      await FileSystem.writeAsStringAsync(uri, audioData, {
        encoding: FileSystem.EncodingType.Base64
      });
      await sound.loadAsync({ uri });
      await sound.playAsync();
    } catch (error) {
      console.log("Failed to play sound", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Voice Assistant</Text>
      <Button title="Start Connection" onPress={startConnection} />
      <Button
        title={recording ? "Stop Recording" : "Start Recording"}
        onPress={recording ? stopRecording : startRecording}
      />
      <ScrollView style={styles.responseContainer}>
        <Text style={styles.response}>{responseText}</Text>
        {loading && <ActivityIndicator size="large" color="#0000ff" />}
      </ScrollView>
      <ScrollView style={styles.codeContainer}>
        <Text style={styles.codeTitle}>Code Snippet</Text>
        <Text style={styles.code}>{codeSnippet}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff"
  },
  title: {
    fontSize: 24,
    marginBottom: 20
  },
  responseContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
    width: "90%",
    height: "30%"
  },
  response: {
    fontSize: 18
  },
  codeContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f5f5f5",
    borderRadius: 5,
    width: "90%",
    height: "30%"
  },
  codeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10
  },
  code: {
    fontFamily: "monospace",
    fontSize: 16
  }
});

export default App;
