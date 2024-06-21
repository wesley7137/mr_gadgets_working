// hooks/useAudioPlayback.js
import { useState, useEffect, useRef } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

export const useAudioPlayback = (audioConnection) => {
  const [status, setStatus] = useState("Idle");
  const [currentAudioPath, setCurrentAudioPath] = useState(null);
  const soundObject = useRef(new Audio.Sound());

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const saveBase64AudioToFile = async (base64) => {
    const filePath = `${FileSystem.cacheDirectory}audio_${Date.now()}.wav`;
    console.log(`Saving audio file at path: ${filePath}`);
    await FileSystem.writeAsStringAsync(filePath, base64, {
      encoding: FileSystem.EncodingType.Base64
    });
    console.log(`Audio file saved at: ${filePath}`);
    return filePath;
  };

  const playAudio = async (audioPath) => {
    try {
      console.log(`Loading audio from path: ${audioPath}`);
      await soundObject.current.unloadAsync();
      await soundObject.current.loadAsync({ uri: audioPath });
      console.log(`Playing audio from path: ${audioPath}`);
      await soundObject.current.playAsync();
      soundObject.current.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          soundObject.current.unloadAsync();
          setCurrentAudioPath(null);
        }
      });
    } catch (error) {
      console.error("Error playing audio:", error);
    }
  };

  useEffect(() => {
    if (audioConnection) {
      console.log("Receive WebSocket is open, setting up onmessage");
      audioConnection.onmessage = async (event) => {
        try {
          const base64Audio = event.data;
          console.log(
            "Received base64-encoded audio data from WebSocket:",
            base64Audio.slice(0, 20) +
              "..." +
              base64Audio.slice(-20) +
              ", total characters: " +
              base64Audio.length
          );
          const filePath = await saveBase64AudioToFile(base64Audio);

          console.log(`Playing audio from file: ${filePath}`);
          setCurrentAudioPath(filePath);
          await playAudio(filePath);
        } catch (error) {
          console.error("Error processing received audio data:", error);
        }
      };
    }
  }, [audioConnection]);

  useEffect(() => {
    return () => {
      console.log("Cleaning up: unloading sound object.");
      soundObject.current.unloadAsync();
    };
  }, []);

  return {
    status,
    currentAudioPath
  };
};
