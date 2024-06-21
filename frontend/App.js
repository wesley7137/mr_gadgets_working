import React, { useState, useRef } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity
} from "react-native";
import { Audio, InterruptionModeIOS } from "expo-av";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import StatusHeader from "./StatusHeader";
import RecordingControl from "./RecordingControl";
import * as Speech from "expo-speech";

const API_URL =
  "https://5d0a-104-12-202-232.ngrok-free.app/api/chat_completions"; // Replace with your backend URL

const App = () => {
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [responseText, setResponseText] = useState("");
  const soundObject = useRef(new Audio.Sound());

  // Function to start recording
  const startRecording = async () => {
    try {
      console.log("Requesting permissions for audio recording...");
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.error("Permission to access audio was denied");
        return;
      }

      setStatus("Recording");
      console.log("Starting recording...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      console.log("Recording started.");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  // Function to stop recording
  const stopRecording = async () => {
    if (!recording) return;

    console.log("Stopping recording...");
    setStatus("Processing");
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    console.log("Recording stopped. URI:", uri);
    sendAudio(uri);
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Function to send audio data
  const sendAudio = async (uri) => {
    try {
      console.log("Fetching audio data from URI:", uri);
      const response = await fetch(uri);
      const audioBlob = await response.blob();
      const base64Audio = await blobToBase64(audioBlob);

      console.log("Sending audio data over HTTP POST");
      const result = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ audio_bytes: base64Audio.split(",")[1] }) // Remove 'data:audio/wav;base64,' prefix
      });

      const data = await result.json();
      console.log("Received response from server:", data.response);
      setResponseText(data.response);
      setStatus("Idle");
    } catch (error) {
      console.error("Failed to send audio", error);
      setStatus("Idle");
    }
  };

  // Function to toggle recording
  const toggleRecording = () => {
    if (status === "Recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <ImageBackground source={require("./assets/bg1.png")} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusHeader status={status} isConnected={true} />
        <Text style={styles.status}>{status}</Text>
        <RecordingControl
          toggleRecording={toggleRecording}
          recording={status === "Recording"}
        />
        <ScrollView style={styles.responseContainer}>
          <Text style={styles.response}>Response from server</Text>
          <Text style={styles.responseText}>{responseText}</Text>
          {status === "Processing" && (
            <ActivityIndicator size="large" color="#0000ff" />
          )}
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#00000088"
  },
  status: {
    fontSize: 25,
    borderRadius: 20,
    color: "#04ff00",
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#000000be"
  },
  responseContainer: {
    padding: 10,
    backgroundColor: "#5d5d5db8",
    borderRadius: 5,
    width: "80%",
    maxHeight: "30%"
  },
  response: {
    fontSize: 16,
    color: "#ffffff",
    textAlign: "center",
    padding: 10,
    lineHeight: 20
  },
  responseText: {
    fontSize: 14,
    color: "#ffffff",
    textAlign: "center",
    padding: 10,
    lineHeight: 20
  }
});

export default App;
