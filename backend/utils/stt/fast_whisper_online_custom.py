import argparse
import pyaudio
import numpy as np
from whisper_online import OnlineASRProcessor, FasterWhisperASR

# Constants
CHUNK_DURATION = 1  # Duration in seconds
SAMPLE_RATE = 16000  # Sample rate in Hz
CHUNK_SIZE = CHUNK_DURATION * SAMPLE_RATE  # Number of samples per chunk

def main():
    parser = argparse.ArgumentParser(description='Real-time transcription from microphone.')
    parser.add_argument('--model', type=str, default='large-v3', choices=[
        'tiny.en', 'tiny', 'base.en', 'base', 'small.en', 'small', 'medium.en', 'medium',
        'large-v1', 'large-v2', 'large-v3', 'large'
    ], help='Name size of the Whisper model to use.')
    parser.add_argument('--language', type=str, default='en', help='Source language code, e.g. en, de, cs, or "auto" for language detection.')
    parser.add_argument('--backend', type=str, default='faster-whisper', choices=[
        'faster-whisper', 'whisper_timestamped', 'openai-api'
    ], help='Load only this backend for Whisper processing.')
    parser.add_argument('--buffer-trimming', type=str, default='segment', choices=['sentence', 'segment'], help='Buffer trimming strategy.')

    args = parser.parse_args()

    # Initialize ASR
    asr = FasterWhisperASR(args.language, args.model)
    online_processor = OnlineASRProcessor(asr)

    # Initialize PyAudio
    audio = pyaudio.PyAudio()

    def callback(in_data, frame_count, time_info, status):
        audio_chunk = np.frombuffer(in_data, dtype=np.float32)
        online_processor.insert_audio_chunk(audio_chunk)
        output = online_processor.process_iter()
        print(output)
        return (in_data, pyaudio.paContinue)

    # Open audio stream
    stream = audio.open(format=pyaudio.paFloat32,
                        channels=1,
                        rate=SAMPLE_RATE,
                        input=True,
                        frames_per_buffer=CHUNK_SIZE,
                        stream_callback=callback)

    print("Recording and transcribing in real-time. Press Ctrl+C to stop.")
    try:
        stream.start_stream()
        while stream.is_active():
            pass
    except KeyboardInterrupt:
        print("Stopping transcription.")
    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()

        # Finalize processing
        final_output = online_processor.finish()
        print(final_output)

if __name__ == '__main__':
    main()
