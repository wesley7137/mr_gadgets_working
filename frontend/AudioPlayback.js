import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Audio } from "expo-av";

const AudioPlayback = ({ audioPath, onPlaybackComplete }) => {
  const soundObject = useRef(new Audio.Sound());

  useEffect(() => {
    const playAudio = async () => {
      try {
        // Unload the sound object if it's already loaded
        if (soundObject.current._loaded) {
          await soundObject.current.unloadAsync();
        }

        console.log(`Loading audio from path: ${audioPath}`);
        await soundObject.current.loadAsync({ uri: audioPath });
        console.log(`Playing audio from path: ${audioPath}`);

        await soundObject.current.playAsync();

        soundObject.current.setOnPlaybackStatusUpdate(async (status) => {
          if (status.didJustFinish) {
            console.log("Audio playback finished");
            onPlaybackComplete();
            // Ensure unloading after playback completes
            await soundObject.current.unloadAsync();
          }
        });
      } catch (error) {
        console.error("Error playing audio:", error);
      }
    };

    playAudio();

    // Cleanup function to unload the sound object when the component unmounts
    return () => {
      soundObject.current.unloadAsync().catch((error) => {
        console.error("Error unloading sound object:", error);
      });
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
