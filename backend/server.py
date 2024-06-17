import React, { useState, useEffect } from "react";
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
import * as Permissions from "expo-permissions";
import { Audio, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system";

//const SERVER_URL = "ws://192.168.1.224:8015/ws";
//const AUDIO_URL = "http://192.168.1.224:8015/audio";


const App = () => {
  const [connection, setConnection] = useState(null);
  const [recording, setRecording] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState();
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Permissions.askAsync(
        Permissions.AUDIO_RECORDING
      );
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
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const startConnection = async () => {
    const socket = new WebSocket(SERVER_URL);

    socket.onopen = () => {
      console.log("Connected to server");
      setStatus("Connected to server");
    };

    socket.onmessage = async (event) => {
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data);
        setResponseText(message.text);
        setCodeSnippet(message.text);
        if (message.status === 200) {
          console.log("TTS Generation Success..");
          setStatus("Audio received");
          await retrieveAndPlayAudio(message.filename);
        }
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from server");
      setStatus("Disconnected from server");
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
    console.log("Stopping recording..");
    setStatus("Processing");
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

      const binaryAudio = Uint8Array.from(atob(audioData), (c) =>
        c.charCodeAt(0)
      );

      connection.socket.send(binaryAudio.buffer);
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const retrieveAndPlayAudio = async (filename) => {
    console.log("Retrieving audio from server");
    setStatus("Playing audio");
    setLoading(true);
    try {
      const audioUrl = `${AUDIO_URL}/${filename}`;

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      setSound(newSound);
      await newSound.playAsync();
    } catch (error) {
      console.log("Failed to play sound", error);
    } finally {
      setLoading(false);
      setStatus("Idle");
    }
  };

  return (
    <ImageBackground source={require("./assets/bg1.png")} style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Mr Gadgets</Text>
        <Text style={styles.status}>{status}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <TouchableOpacity onPress={startConnection}>
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
          </TouchableOpacity>
          <TouchableOpacity
            onPress={recording ? stopRecording : startRecording}
          >
            <FontAwesome
              name="microphone"
              size={65}
              color={recording ? "red" : "white"}
              style={{ marginTop: 30, marginBottom: 30 }}
            />
          </TouchableOpacity>
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
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  title: {
    fontWeight: "bold",
    fontFamily: "roboto-mono",
    marginTop: 20,
    fontSize: 24,
    marginBottom: 20,
    color: "#ffffff"
  },
  status: {
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 10
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
