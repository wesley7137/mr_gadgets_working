import React, { useState, useEffect } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import AudioPlayback from "./AudioPlayback";
import * as FileSystem from "expo-file-system";

const App = () => {
  const [audioQueue, setAudioQueue] = useState([]);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const initialQueue = [
      require("./backend/audio_files/test_audio_1.wav"),
      require("./backend/audio_files/test_audio_2.wav"),
      require("./backend/audio_files/test_audio_3.wav")
    ];
    setAudioQueue(initialQueue);
  }, []);

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      setCurrentFilePath(audioQueue[0]);
      setIsPlaying(true);
    }
  }, [audioQueue, isPlaying]);

  const handlePlaybackComplete = () => {
    setAudioQueue((prevQueue) => prevQueue.slice(1));
    setIsPlaying(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Audio Playback Queue</Text>
      <View style={styles.playbackContainer}>
        {currentFilePath ? (
          <AudioPlayback
            audioPath={currentFilePath}
            onPlaybackComplete={handlePlaybackComplete}
          />
        ) : (
          <Text style={styles.noAudioText}>No audio to play</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e0f7fa",
    padding: 20
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    fontWeight: "bold"
  },
  playbackContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%"
  },
  noAudioText: {
    fontSize: 18,
    color: "#888"
  }
});

export default App;
