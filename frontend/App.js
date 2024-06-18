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
  "wss://0c2c-2600-1700-290-8d90-58b8-94f1-605e-2c4b.ngrok-free.app/ws";
const URL =
  "https://0c2c-2600-1700-290-8d90-58b8-94f1-605e-2c4b.ngrok-free.app";

const App = () => {
  const [connection, setConnection] = useState(null);
  const [recording, setRecording] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Idle");
  const isPlaying = useRef(false);
  const [audioQueue, setAudioQueue] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const URL =
    "https://0c2c-2600-1700-290-8d90-58b8-94f1-605e-2c4b.ngrok-free.app";

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
          staysActiveInBackground: true
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

  const startConnection = async () => {
    const socket = new WebSocket(SERVER_URL);
    console.log("Socket created");
    socket.binaryType = "blob";
    console.log("Socket binaryType set to blob");

    setConnection(socket);
    console.log("Connection set");

    socket.onopen = () => {
      console.log("Connected to server");
      setStatus("Connected to server");
      console.log("Status set to 'Connected to server'");
      setIsConnected(true);
      console.log("isConnected set to true");
    };

    socket.onmessage = async (event) => {
      console.log("Message received");
      if (typeof event.data === "string") {
        console.log("Event.data is string", event.data);
        const message = JSON.parse(event.data);
        console.log("Message parsed", message);
        setResponseText(message.message);
        console.log("Response text set", message.message);
      } else if (event.data instanceof Blob) {
        console.log("Data is Blob", event.data);
        const audioBlob = event.data;
        console.log("Audio blob created", audioBlob);
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioUrl = reader.result;
          console.log("Audio URL created", audioUrl);
          setAudioQueue((prevQueue) => [...prevQueue, audioUrl]);
          console.log("Audio added to queue", audioUrl);
          if (!isPlaying.current) {
            console.log("Not currently playing");
            playNextInQueue();
            console.log("Playing next in queue");
          }
        };
        reader.readAsDataURL(audioBlob);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from server");
      setStatus("Disconnected from server");
      console.log("Status set to 'Disconnected from server'");
      setIsConnected(false);
      console.log("isConnected set to false");
    };
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
        staysActiveInBackground: true
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
    const uri = recording.getURI();
    setRecording(null);
    console.log("Recording stopped and stored at", uri);
    sendAudio(uri);
  };

  const sendAudio = async (uri) => {
    if (!connection) return;

    try {
      const audioData = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64
      });

      connection.send(audioData);
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const playNextInQueue = async () => {
    setAudioQueue((prevQueue) => {
      if (prevQueue.length === 0) {
        isPlaying.current = false;
        return prevQueue;
      }

      const audioUrl = prevQueue[0];
      Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true })
        .then(({ sound }) => {
          sound.setOnPlaybackStatusUpdate(async (status) => {
            if (status.didJustFinish) {
              console.log("Finished playing");
              await sound.unloadAsync();
              isPlaying.current = false;
              setStatus("Idle");
              playNextInQueue();
            }
          });
        })
        .catch((error) => console.error("Error in playNextInQueue:", error));

      return prevQueue.slice(1);
    });
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
    fontSize: 25,
    borderRadius: 20,
    fontWeight: "bold",
    color: "#04ff00",
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#000000be"
  },
  responseContainer: {
    marginTop: 100,
    color: "#ffffff",
    padding: 10,
    backgroundColor: "#5d5d5db8",
    borderRadius: 5,
    width: "80%",
    maxHeight: "30%"
  },
  response: {
    fontSize: 18
  }
});

export default App;
