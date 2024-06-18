// AudioPlayer.js
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";

const AUDIO_CACHE_DIRECTORY = FileSystem.cacheDirectory + "audioCache/";

export const playAudio = async (audioFiles, isPlaying, setStatus) => {
  if (audioFiles.length === 0 || isPlaying.current) return;

  const audioFile = audioFiles[0];
  audioFiles.splice(0, 1);

  try {
    const { sound } = await Audio.Sound.createAsync({ uri: audioFile }, { shouldPlay: true });
    isPlaying.current = true;

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.didJustFinish) {
        console.log("Finished playing");
        await sound.unloadAsync();
        isPlaying.current = false;
        setStatus("Idle");
        playAudio(audioFiles, isPlaying, setStatus);
      }
    });
  } catch (error) {
    console.error("Error playing audio:", error);
    isPlaying.current = false;
    playAudio(audioFiles, isPlaying, setStatus);
  }
};

export const saveAudioFile = async (audioBlob) => {
  const timestamp = Date.now();
  const audioFile = `${AUDIO_CACHE_DIRECTORY}audio_${timestamp}.wav`;

  try {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIRECTORY, { intermediates: true });
    await FileSystem.writeAsStringAsync(audioFile, await FileSystem.readAsStringAsync(audioBlob));
    return audioFile;
  } catch (error) {
    console.error("Error saving audio file:", error);
    return null;
  }
};
