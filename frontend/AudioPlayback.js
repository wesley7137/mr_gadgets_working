// components/AudioPlayback.js
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Audio } from "expo-av";

const AudioPlayback = ({ audioPath, onPlaybackComplete }) => {
  const soundObject = useRef(new Audio.Sound());

  useEffect(() => {
    const playAudio = async () => {
      try {
        if (soundObject.current._loading) {
          await soundObject.current.unloadAsync();
        }
        console.log(`Loading audio from path: ${audioPath}`);
        await soundObject.current.loadAsync({ uri: audioPath });
        console.log(`Playing audio from path: ${audioPath}`);
        await soundObject.current.playAsync();
        soundObject.current.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            onPlaybackComplete();
            soundObject.current.unloadAsync();
          }
        });
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    };

    playAudio();

    // Cleanup function to unload the sound object
    return () => {
      soundObject.current.unloadAsync();
    };
  }, [audioPath, onPlaybackComplete]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Playing audio...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center"
  },
  text: {
    fontSize: 18
  }
});

export default AudioPlayback;
