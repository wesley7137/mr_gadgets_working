import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  ImageBackground,
  TouchableOpacity
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio, InterruptionModeIOS } from "expo-av";
import base64 from "react-native-base64";

const SERVER_URL = "wss://63cb-104-12-202-232.ngrok-free.app/ws";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [recording, setRecording] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const [status, setStatus] = useState("Idle");
  const isPlaying = useRef(false);
  const audioStore = useRef([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log(
      "App mounted. Requesting permissions and setting audio mode..."
    );
    const requestPermissions = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissions not granted");
      }
    };

    const setAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          interruptionModeIOS: InterruptionModeIOS.DuckOthers
        });
        console.log("Audio mode set successfully");
      } catch (error) {
        console.log("Failed to set audio mode", error);
      }
    };

    requestPermissions();
    setAudioMode();

    return () => {
      if (recording) {
        console.log("App unmounting. Stopping recording...");
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  useEffect(() => {
    console.log("Establishing WebSocket connection...");
    startConnection();
  }, []);

  useEffect(() => {
    if (!isPlaying.current && audioStore.current.length > 0) {
      console.log("New audio available. Playing next in queue...");
      playNextInQueue();
    }
  }, [audioQueue]);

  const startConnection = () => {
    if (connection?.socket) {
      console.log("Closing existing WebSocket connection...");
      connection.socket.close();
    }

    console.log("Opening new WebSocket connection...");
    const socket = new WebSocket(SERVER_URL);

    socket.onmessage = async (event) => {
      console.log("Received message from WebSocket");
      if (typeof event.data === "string") {
        console.log("Message is a string:", event.data);
        try {
          const message = JSON.parse(event.data);
          if (message.audio) {
            console.log("Message contains audio data");
            const audioData = base64.decode(message.audio);
            const arrayBuffer = Uint8Array.from(
              audioData.split("").map((c) => c.charCodeAt(0))
            ).buffer;
            console.log("ArrayBuffer from decoded audio data:", arrayBuffer);
            const blobUrl = URL.createObjectURL(
              new Blob([arrayBuffer], { type: "audio/wav" })
            );
            audioStore.current.push(blobUrl);
            setAudioQueue([...audioStore.current]);
            console.log("Audio data processed and added to queue");
            setStatus("Audio received");
          }
        } catch (error) {
          console.error("Failed to parse string message:", error);
        }
      }
    };

    socket.onopen = () => {
      console.log("WebSocket connection established");
      setStatus("Connected to server");
      setIsConnected(true);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setStatus("Disconnected from server");
      setIsConnected(false);
    };

    setConnection({ socket });
  };

  const startRecording = async () => {
    try {
      console.log("Requesting permissions...");
      await Audio.requestPermissionsAsync();

      console.log("Starting recording...");
      setStatus("Recording");
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
      console.log("Recording started");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    console.log("Stopping recording...");
    setStatus("Processing");
    await recording.stopAndUnloadAsync();
    setRecording(null);

    const uri = recording.getURI();
    console.log("Recording stopped and stored at", uri);
    sendAudio(uri);
  };

  const sendAudio = async (uri) => {
    if (!connection || !connection.socket) {
      console.log("No WebSocket connection available. Cannot send audio.");
      return;
    }

    try {
      console.log("Fetching audio data from URI:", uri);
      const response = await fetch(uri);
      const audioBlob = await response.blob();
      console.log("Fetched audio Blob:", audioBlob);

      if (audioBlob.size === 0) {
        console.error("Audio Blob is empty. Cannot send.");
        return;
      }

      console.log("Sending audio Blob over WebSocket...");
      connection.socket.send(audioBlob);
      console.log("Audio Blob sent over WebSocket.");
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const playNextInQueue = async () => {
    if (audioStore.current.length === 0 || isPlaying.current) {
      console.log("No audio to play or already playing.");
      return;
    }
    isPlaying.current = true;

    const nextAudio = audioStore.current.shift();
    setAudioQueue([...audioStore.current]);
    console.log("Playing audio from blob:", nextAudio);
    setStatus("Playing audio");
    setLoading(true);
    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: nextAudio },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          console.log("Finished playing:", nextAudio);
          await newSound.unloadAsync();
          isPlaying.current = false;
          if (audioStore.current.length > 0) {
            console.log("More audio in queue. Playing next...");
            playNextInQueue();
          } else {
            console.log("No more audio in queue. Setting status to Idle.");
            setStatus("Idle");
          }
        }
      });

      await newSound.playAsync();
    } catch (error) {
      console.log("Failed to play sound", error);
      isPlaying.current = false;
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = () => {
    console.log("Toggling recording state...");
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const connectionStatusColor = isConnected ? "green" : "red";

  return (
    <ImageBackground source={require("./assets/bg1.png")} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>STATUS</Text>
          <View
            style={[
              styles.connectionIndicator,
              { backgroundColor: connectionStatusColor }
            ]}
          />
          <TouchableOpacity onPress={startConnection}>
            <FontAwesome
              name="refresh"
              size={30}
              color="white"
              style={styles.refreshButton}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.status}>{status}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <TouchableOpacity onPress={toggleRecording}>
            <FontAwesome
              name="microphone"
              size={80}
              color={recording ? "red" : "white"}
              style={{ marginTop: 60, marginBottom: 30 }}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.responseContainer}>
          <Text style={styles.response}>{responseText}</Text>
          {loading && <ActivityIndicator size="large" color="#0000ff" />}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30
  },
  title: {
    fontFamily: "roboto",
    fontSize: 45,
    color: "#ffffff",
    marginRight: 10
  },
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10
  },
  refreshButton: {
    marginLeft: 10,
    padding: 10
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
    fontFamily: "roboto",
    lineHeight: 20
  }
});

export default App;
