// hooks/useAudioRecording.js
import { useState, useEffect } from "react";
import { Audio, InterruptionModeIOS } from "expo-av";

export const useAudioRecording = (audioConnection) => {
  const [recording, setRecording] = useState(null);
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    return () => {
      if (recording) {
        console.log("Cleaning up: stopping recording.");
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      console.log("Requesting permissions for audio recording...");
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.error("Permission to access audio was denied");
        return;
      }

      setStatus("Recording");
      console.log("Starting recording...");
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
      console.log("Recording started.");
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    console.log("Stopping recording...");
    setStatus("Processing");
    await recording.stopAndUnloadAsync();
    setRecording(null);

    const uri = recording.getURI();
    console.log("Recording stopped. URI:", uri);
    sendAudio(uri);
  };

  const sendAudio = async (uri) => {
    if (!audioConnection || audioConnection.readyState !== WebSocket.OPEN) {
      console.log("Audio WebSocket is not open. Cannot send audio.");
      return;
    }

    try {
      console.log("Fetching audio data from URI:", uri);
      const response = await fetch(uri);
      const audioBlob = await response.blob();
      const arrayBuffer = await blobToArrayBuffer(audioBlob);

      console.log(
        "Sending audio data over WebSocket. Length:",
        arrayBuffer.byteLength
      );
      audioConnection.send(arrayBuffer);
    } catch (error) {
      console.error("Failed to send audio", error);
    }
  };

  const blobToArrayBuffer = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  };

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return {
    toggleRecording,
    status
  };
};
