import React, { useEffect, useState, useRef } from "react";
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
import StatusHeader from "./StatusHeader";
import RecordingControl from "./RecordingControl";
import FontAwesome from "@expo/vector-icons/FontAwesome";

const WEBSOCKET_URL = "wss://5d0a-104-12-202-232.ngrok-free.app/ws";

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [responseText, setResponseText] = useState("");
  const [retryTimeout, setRetryTimeout] = useState(0); // State to track retry time
  const websocket = useRef(null);
  const audioPlayer = useRef(new Audio.Sound());
  const audioQueue = useRef([]);
  const isPlaying = useRef(false);
  const retryIntervalRef = useRef(null);
  const timeoutDuration = 60000; // 1 minute
  const retryInterval = 6000; // 6 seconds

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
      if (retryIntervalRef.current) {
        clearInterval(retryIntervalRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    if (retryTimeout >= timeoutDuration) {
      console.log("WebSocket connection timed out after 1 minute");
      clearInterval(retryIntervalRef.current);
      return;
    }

    console.log("Connecting to WebSocket...");
    websocket.current = new WebSocket(WEBSOCKET_URL);

    websocket.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setRetryTimeout(0);
      clearInterval(retryIntervalRef.current);
    };

    websocket.current.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
      if (retryTimeout < timeoutDuration) {
        setRetryTimeout((prev) => prev + retryInterval);
        retryIntervalRef.current = setInterval(() => {
          connectWebSocket();
        }, retryInterval);
      }
    };

    websocket.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
      if (retryTimeout < timeoutDuration) {
        setRetryTimeout((prev) => prev + retryInterval);
        retryIntervalRef.current = setInterval(() => {
          connectWebSocket();
        }, retryInterval);
      }
    };

    websocket.current.onmessage = (event) => {
      console.log("WebSocket message received:", event.data);
      const data = JSON.parse(event.data);
      if (data.type === "audio") {
        console.log("Received audio data");
        audioQueue.current.push(data.audio);
        if (!isPlaying.current) {
          playNextAudio();
        }
      } else if (data.type === "text") {
        console.log("Received text data:", data.text);
        setResponseText((prevText) => prevText + data.text);
      }
    };
  };

  const playNextAudio = async () => {
    if (audioQueue.current.length === 0) {
      isPlaying.current = false;
      console.log("No more audio in queue");
      return;
    }

    isPlaying.current = true;
    const audioData = audioQueue.current.shift();
    const audioUri = `data:audio/mp3;base64,${audioData}`;
    console.log("Playing audio from queue");

    try {
      await audioPlayer.current.unloadAsync();
      await audioPlayer.current.loadAsync({ uri: audioUri });

      // Set audio mode to play through the speaker
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, // Ensure playback through the speaker on iOS
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false // For Android
      });

      await audioPlayer.current.playAsync();
      audioPlayer.current.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (playbackStatus.didJustFinish) {
          console.log("Audio playback finished");
          playNextAudio();
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
      playNextAudio();
    }
  };

  const startRecording = async () => {
    console.log("Starting audio recording...");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.error("Permission to access audio was denied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true, // Enable recording
        playsInSilentModeIOS: true
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      setRecording(recording);
      setStatus("Recording");
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    console.log("Stopping audio recording...");
    setStatus("Processing");
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    console.log("Recording stopped. URI:", uri);

    // Disable recording to allow speaker playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false, // Disable recording after stopping
      playsInSilentModeIOS: true
    });

    sendAudioToServer(uri);
  };

  const sendAudioToServer = async (uri) => {
    console.log("Sending audio to server...");
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result.split(",")[1];
        console.log("Audio converted to base64");
        websocket.current.send(
          JSON.stringify({ type: "audio", audio: base64Audio })
        );
        console.log("Audio sent to server");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const toggleRecording = () => {
    if (status === "Recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const refreshConnection = () => {
    console.log("Refreshing WebSocket connection...");
    // Stop current recording
    if (recording) {
      stopRecording();
    }

    // Stop audio playback
    if (audioPlayer.current) {
      audioPlayer.current.stopAsync();
    }

    // Reset states
    setStatus("Idle");
    setResponseText("");
    audioQueue.current = [];
    isPlaying.current = false;

    // Close current WebSocket connection
    if (websocket.current) {
      websocket.current.close();
      websocket.current = null;
    }

    // Reconnect WebSocket
    connectWebSocket();
  };

  return (
    <ImageBackground source={require("./assets/bg1.png")} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusHeader
          status={status}
          isConnected={isConnected}
          startConnections={connectWebSocket}
        />
        <Text style={styles.status}>{status}</Text>

        <ScrollView style={styles.responseContainer}>
          <Text style={styles.response}>{responseText}</Text>
          {status === "Processing" && (
            <ActivityIndicator size="large" color="#0000ff" />
          )}
        </ScrollView>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refreshConnection}
        >
          <FontAwesome name="refresh" size={24} color="white" />
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>

        <RecordingControl
          toggleRecording={toggleRecording}
          recording={status === "Recording"}
        />
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
  refreshButton: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 20,
    padding: 10,
    backgroundColor: "#007bff",
    borderRadius: 10,
    marginTop: 40
  },
  refreshButtonText: {
    marginLeft: 10,
    color: "#ffffff",
    fontSize: 16
  },
  responseContainer: {
    padding: 10,
    borderRadius: 10,

    backgroundColor: "#5d5d5db8",
    borderRadius: 5,
    width: "80%",
    maxHeight: "60%"
  },
  response: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
    padding: 10
  }
});

export default App;
