import { useState, useEffect, useRef, useCallback } from "react";

export const useAudioQueue = (initialQueue = []) => {
  const [audioQueue, setAudioQueue] = useState(initialQueue);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const queueRef = useRef(initialQueue);

  useEffect(() => {
    if (audioQueue.length > 0 && !isPlaying) {
      playNextInQueue();
    }
  }, [audioQueue, isPlaying]);

  const playNextInQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      setCurrentFilePath(queueRef.current[0]);
      setIsPlaying(true);
    }
  }, []);

  const handlePlaybackComplete = useCallback(() => {
    setAudioQueue((prevQueue) => {
      const newQueue = prevQueue.slice(1);
      queueRef.current = newQueue;
      return newQueue;
    });
    setIsPlaying(false);
    if (queueRef.current.length > 0) {
      playNextInQueue();
    }
  }, [playNextInQueue]);

  const addToQueue = useCallback((audioUri) => {
    setAudioQueue((prevQueue) => {
      const newQueue = [...prevQueue, audioUri];
      queueRef.current = newQueue;
      return newQueue;
    });
  }, []);

  return {
    audioQueue,
    currentFilePath,
    handlePlaybackComplete,
    addToQueue,
    clearQueue: useCallback(() => {
      setAudioQueue([]);
      queueRef.current = [];
    }, [])
  };
};
