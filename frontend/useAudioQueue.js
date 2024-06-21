// hooks/useAudioQueue.js
import { useState, useEffect, useRef } from "react";

export const useAudioQueue = (initialQueue) => {
  const [audioQueue, setAudioQueue] = useState(initialQueue);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const queueRef = useRef(initialQueue);

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      playNextInQueue();
    }
  }, [audioQueue, isPlaying]);

  const playNextInQueue = () => {
    if (queueRef.current.length > 0) {
      setCurrentFilePath(queueRef.current[0]);
      setIsPlaying(true);
    }
  };

  const handlePlaybackComplete = () => {
    setAudioQueue((prevQueue) => prevQueue.slice(1));
    queueRef.current = queueRef.current.slice(1);
    setIsPlaying(false);
    if (queueRef.current.length > 0) {
      playNextInQueue();
    }
  };

  return {
    audioQueue,
    currentFilePath,
    handlePlaybackComplete
  };
};
