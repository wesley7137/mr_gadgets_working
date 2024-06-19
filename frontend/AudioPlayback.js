import React, { useState, useEffect } from "react";
import { View, Button, Text, StyleSheet } from "react-native";
import { Audio } from "expo-av";

const AudioPlayback = () => {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioPath = require("./backend/audio_files/test_audio.wav"); // Use require to import the audio file

  const playSound = async () => {
    if (isPlaying) return;

    console.log("Loading Sound");
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true
    });

    const { sound } = await Audio.Sound.createAsync(audioPath, {
      // Use audioPath here
      shouldPlay: true
    });
    setSound(sound);
    setIsPlaying(true);

    console.log("Playing Sound");
    await sound.playAsync();
  };

  useEffect(() => {
    return sound
      ? () => {
          console.log("Unloading Sound");
          sound.unloadAsync().catch(console.error);
          setIsPlaying(false);
          setSound(null);
        }
      : undefined;
  }, [sound]);

  return (
    <View style={styles.container}>
      <Button title="Play Sound" onPress={playSound} />
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
  }
});

export default AudioPlayback;
