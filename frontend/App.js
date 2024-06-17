import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { Button } from "react-native-paper";
import FontAwesome from "@expo/vector-icons/FontAwesome";

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
        const reader = new FileReader();
        reader.onload = () => playAudio(reader.result);
        reader.readAsArrayBuffer(event.data); // Read the binary data as ArrayBuffer
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
      // Read the audio file as binary data
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      const binaryAudio = Uint8Array.from(atob(audioData), (c) =>
        c.charCodeAt(0)
      );
      connection.socket.send(binaryAudio);
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
      <Text style={styles.title}>Mr Gadgets</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        <Button
          onPress={startConnection}
          icon={() => (
            <FontAwesome
              name="connectdevelop"
              size={65}
              color={connection ? "green" : "white"}
              style={{
                marginTop: 30,
                marginBottom: 30,
                marginRight: 50
              }}
            />
          )}
        />
        <Button
          onPress={recording ? stopRecording : startRecording}
          icon={() => (
            <FontAwesome
              name="microphone"
              size={65}
              color={recording ? "red" : "white"}
              style={{ marginTop: 30, marginBottom: 30 }}
            />
          )}
        />
      </View>
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
    backgroundColor: "#222222"
  },
  title: {
    fontWeight: "bold",
    fontFamily: "roboto-mono",
    marginTop: 20,
    fontSize: 24,
    marginBottom: 20,
    color: "#ffffff"
  },
  button: {
    marginTop: 20,
    fontWeight: "bold",
    fontFamily: "roboto-mono",
    marginTop: 20,
    fontSize: 20,
    marginBottom: 20,
    color: "#ffffff"
  },
  responseContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#5d5d5d",
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
    color: "#04ff00",
    backgroundColor: "#000000",
    borderRadius: 5,
    width: "90%",
    height: "30%",
    fontSize: 14,
    fontFamily: "courier-mono"
  },
  codeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#ffffff"
  },
  code: {
    fontFamily: "roboto-mono",
    fontSize: 16
  }
});

export default App;
