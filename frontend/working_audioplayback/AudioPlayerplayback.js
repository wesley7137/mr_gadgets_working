import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";

const AudioPlayback = ({ audioPath, onPlaybackComplete }) => {
  const [sound, setSound] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const playSound = async () => {
      if (!audioPath) return;

      setIsLoading(true);
      setIsPlaying(false);
      console.log("Loading Sound");
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true
      });

      try {
        const { sound } = await Audio.Sound.createAsync(
          audioPath, // Use the dynamically passed audio path
          { shouldPlay: true }
        );
        setSound(sound);
        setIsPlaying(true);
        console.log("Playing Sound");

        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            console.log("Playback Finished");
            sound.unloadAsync().catch(console.error);
            setSound(null);
            setIsPlaying(false);
            setIsLoading(false);
            if (onPlaybackComplete) {
              onPlaybackComplete();
            }
          }
        });

        await sound.playAsync();
      } catch (error) {
        console.error("Error loading sound:", error);
        setIsLoading(false);
      }
    };

    playSound();

    return sound
      ? () => {
          console.log("Unloading Sound");
          sound.unloadAsync().catch(console.error);
          setIsPlaying(false);
          setSound(null);
        }
      : undefined;
  }, [audioPath]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Text style={styles.urlText}>Playing audio file...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    padding: 10
  },
  urlText: {
    marginTop: 10,
    textAlign: "center",
    color: "#333"
  }
});

export default AudioPlayback;
