import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  ImageBackground,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Pressable,
  LogBox
} from "react-native";
import { Audio, InterruptionModeIOS } from "expo-av";
import PagerView from "react-native-pager-view";
import { FontAwesome } from "@expo/vector-icons";
import StatusHeader from "./StatusHeader";
import RecordingControl from "./RecordingControl";
import ModelSelector from "./ModelSelector";
import { useAudioQueue } from "./useAudioQueue";
import AudioPlayback from "./AudioPlayback";

const WEBSOCKET_BASE_URL = "wss://db12-104-12-202-232.ngrok-free.app";
const WEBSOCKET_ROUTES = {
  model1: "/ws/interpreter",
  model2: "/ws/finn"
};

const App = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState("Idle");
  const [responseText, setResponseText] = useState("");
  const websocket = useRef(null);
  const [selectedModel, setSelectedModel] = useState("model1");
  const pagerRef = useRef(null);

  const {
    audioQueue,
    currentFilePath,
    handlePlaybackComplete,
    addToQueue,
    clearQueue
  } = useAudioQueue();

  const connectWebSocket = useCallback(() => {
    console.log("Connecting to WebSocket...");
    const wsUrl = `${WEBSOCKET_BASE_URL}${WEBSOCKET_ROUTES[selectedModel]}`;
    websocket.current = new WebSocket(wsUrl);

    websocket.current.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    websocket.current.onclose = () => {
      console.log("WebSocket closed");
      setIsConnected(false);
    };

    websocket.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);
    };

    websocket.current.onmessage = (event) => {
      console.log("WebSocket message received:", event.data);
      const data = JSON.parse(event.data);
      if (data.type === "audio") {
        console.log("Received audio data");
        const audioUri = `data:audio/mp3;base64,${data.audio}`;
        addToQueue(audioUri);
      } else if (data.type === "text") {
        console.log("Received text data:", data.text);
        setResponseText((prevText) => prevText + data.text);
      }
    };
  }, [selectedModel, addToQueue]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (websocket.current) {
        websocket.current.close();
      }
    };
  }, [connectWebSocket]);

  const startRecording = async () => {
    console.log("Starting audio recording...");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.error("Permission to access audio was denied");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
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
      allowsRecordingIOS: false,
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

  const refreshConnection = useCallback(() => {
    console.log("Refreshing WebSocket connection...");
    // Stop current recording
    if (recording) {
      stopRecording();
    }

    // Reset states
    setStatus("Idle");
    setResponseText("");
    clearQueue();

    // Close current WebSocket connection
    if (websocket.current) {
      websocket.current.close();
      websocket.current = null;
    }

    // Reconnect WebSocket
    connectWebSocket();
  }, [recording, stopRecording, clearQueue, connectWebSocket]);

  return (
    <ImageBackground
      source={require("./assets/bg1.png")}
      style={styles.backgroundImage}
    >
      <SafeAreaView style={styles.container}>
        <StatusHeader
          status={status}
          isConnected={isConnected}
          startConnections={connectWebSocket}
        />
        <Text style={styles.status}>{status}</Text>
        <ModelSelector
          selectedModel={selectedModel}
          setSelectedModel={(model) => {
            setSelectedModel(model);
            refreshConnection();
          }}
        />
        <View style={styles.tabButtons}>
          <Pressable
            style={styles.tabButton}
            onPress={() => pagerRef.current.setPage(0)}
          >
            <Text style={styles.tabButtonText}>Response</Text>
          </Pressable>
          <Pressable
            style={styles.tabButton}
            onPress={() => pagerRef.current.setPage(1)}
          >
            <Text style={styles.tabButtonText}>Code</Text>
          </Pressable>
        </View>
        <PagerView style={styles.pagerView} initialPage={0} ref={pagerRef}>
          <View key="1" style={styles.page}>
            <ScrollView style={styles.responseContainer}>
              <Text style={styles.response}>{responseText}</Text>
              {status === "Processing" && (
                <ActivityIndicator size="large" color="#0000ff" />
              )}
            </ScrollView>
          </View>
          <View key="2" style={styles.page}>
            <View style={styles.scene}>
              <Text>Second Tab Content</Text>
            </View>
          </View>
        </PagerView>
        <View style={styles.footer}>
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
        </View>
        {currentFilePath && (
          <AudioPlayback
            audioPath={currentFilePath}
            onPlaybackComplete={handlePlaybackComplete}
          />
        )}
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: "cover"
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 20
  },
  status: {
    textAlign: "center",
    fontSize: 18,
    marginVertical: 10,
    color: "white"
  },
  tabButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#2a9df4",
    borderRadius: 5,
    marginHorizontal: 5
  },
  tabButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold"
  },
  pagerView: {
    flex: 1,
    marginVertical: 10
  },
  page: {
    flex: 1,
    padding: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10
  },
  responseContainer: {
    flex: 1
  },
  response: {
    fontSize: 16,
    color: "#333",
    marginVertical: 10
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#28a745",
    padding: 10,
    borderRadius: 5
  },
  refreshButtonText: {
    color: "white",
    fontSize: 16,
    marginLeft: 5
  },
  scene: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%"
  }
});

export default App;
