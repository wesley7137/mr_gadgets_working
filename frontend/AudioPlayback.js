import React, { useEffect, useRef } from "react";
import { Audio } from "expo-av";

const AudioPlayback = ({ audioPath, onPlaybackComplete }) => {
  const playbackObject = useRef(new Audio.Sound());

  useEffect(() => {
    const loadAndPlayAudio = async () => {
      try {
        await playbackObject.current.unloadAsync();
        await playbackObject.current.loadAsync({ uri: audioPath });
        await playbackObject.current.playAsync();
        playbackObject.current.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            onPlaybackComplete();
          }
        });
      } catch (error) {
        console.error("Error in loading or playing audio:", error);
        onPlaybackComplete(); // Call on complete in case of error to proceed with the queue
      }
    };

    if (audioPath) {
      loadAndPlayAudio();
    }

    return () => {
      playbackObject.current.unloadAsync();
    };
  }, [audioPath, onPlaybackComplete]);

  return null;
};

export default AudioPlayback;
