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
import * as FileSystem from "expo-file-system";

const SERVER_URL =
  "wss://fab2-2600-1700-290-8d90-58b8-94f1-605e-2c4b.ngrok-free.app/ws";
const AUDIO_URL =
  "https://fab2-2600-1700-290-8d90-58b8-94f1-605e-2c4b.ngrok-free.app/audio";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [recording, setRecording] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const [status, setStatus] = useState("Idle");
  const isPlaying = useRef(false);
  const audioStore = useRef([]); // In-memory store for audio files
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
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
        console.log("Audio mode set");
      } catch (error) {
        console.log("Failed to set audio mode", error);
      }
    };

    requestPermissions();
    setAudioMode();

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  useEffect(() => {
    if (!isPlaying.current && audioStore.current.length > 0) {
      playNextInQueue();
    }
  }, [audioQueue]);

  const startConnection = async () => {
    const socket = new WebSocket(SERVER_URL);

    socket.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data);
        setResponseText(message.text);
        setCodeSnippet(message.text);
        if (message.status === 200) {
          // Expecting status as an integer
          console.log("TTS Generation Success..");
          setStatus("Audio received");
          audioStore.current.push(message.filename); // Store filename in the in-memory queue
          setAudioQueue([...audioStore.current]);
        }
      }
    };

    socket.onopen = () => {
      console.log("Connected to server");
      setStatus("Connected to server");
      setIsConnected(true);
    };

    socket.onclose = () => {
      console.log("Disconnected from server");
      setStatus("Disconnected from server");
      setIsConnected(false);
    };

    setConnection({ socket });
  };

  const startRecording = async () => {
    try {
      console.log("Requesting permissions..");
      await Audio.requestPermissionsAsync();

      console.log("Starting recording..");
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

    console.log("Stopping recording..");
    setStatus("Processing");
    await recording.stopAndUnloadAsync();
    setRecording(null);

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

      const binaryAudio = Uint8Array.from(atob(audioData), (c) =>
        c.charCodeAt(0)
      );

      connection.socket.send(binaryAudio.buffer);
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const playNextInQueue = async () => {
    if (audioStore.current.length === 0 || isPlaying.current) return; // Prevent double play
    isPlaying.current = true;

    const nextAudio = audioStore.current.shift(); // Retrieve the next audio filename
    setAudioQueue([...audioStore.current]); // Update state to reflect the removed file
    console.log("Retrieving audio from server:", nextAudio);
    setStatus("Playing audio");
    setLoading(true);
    try {
      const audioUrl = `${AUDIO_URL}/${nextAudio}`;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      newSound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          console.log("Finished playing:", nextAudio);
          await newSound.unloadAsync();
          isPlaying.current = false;
          if (audioStore.current.length > 0) {
            playNextInQueue(); // Play next audio if available
          } else {
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
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <ImageBackground source={require("./assets/bg1.png")} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>STATUS</Text>
        <Text style={styles.status}>{status}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <TouchableOpacity onPress={startConnection}>
            <FontAwesome
              name="connectdevelop"
              size={80}
              color={isConnected ? "green" : "white"}
              style={{
                marginTop: 60,
                marginBottom: 30,
                marginRight: 60
              }}
            />
          </TouchableOpacity>
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
  title: {
    fontFamily: "roboto-mono",
    marginTop: 30,
    fontSize: 45,
    marginBottom: 30,
    color: "#ffffff"
  },
  status: {
    fontSize: 30,
    borderRadius: 20,
    fontWeight: "bold",
    color: "#04ff00",
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#000000be"
  },
  responseContainer: {
    marginTop: 100,
    padding: 10,
    backgroundColor: "#5d5d5db8",
    borderRadius: 5,
    width: "80%",
    maxHeight: "30%"
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
    maxHeight: "20%",
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
