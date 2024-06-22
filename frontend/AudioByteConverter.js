import React, { useState, useRef } from "react";

const AudioByteConverter = () => {
  const [file, setFile] = useState(null);
  const audioContextRef = useRef(null);

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const playAudio = () => {
    if (!file) {
      alert("Please select an audio file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const arrayBuffer = event.target.result;
      const audioContext =
        audioContextRef.current ||
        new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      audioContext.decodeAudioData(
        arrayBuffer,
        (buffer) => {
          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          source.start(0);
        },
        (error) => {
          console.error("Error decoding audio data:", error);
        }
      );
    };

    reader.onerror = function () {
      console.error("Error reading file:", reader.error);
    };

    reader.readAsArrayBuffer(file);
  };

  return (
    <div>
      <input type="file" accept=".mp3,.wav" onChange={handleFileChange} />
      <button onClick={playAudio}>Play Audio</button>
    </div>
  );
};

export default AudioByteConverter;
