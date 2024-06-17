# backend/utils/stt/stt.py

import os
import torch
from faster_whisper import WhisperModel
import tempfile
import logging

# Disable symbolic links on Windows for huggingface_hub
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define torch configuration
device = "cuda" if torch.cuda.is_available() else "cpu"
compute_type = "float16" if torch.cuda.is_available() else "float32"

# Load Faster-Whisper model
model = WhisperModel("distil-large-v3", device=device, compute_type=compute_type)

def audio_to_text(audio_data: bytes) -> str:
    try:
        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio_file:
            temp_audio_file.write(audio_data)
            temp_audio_file_path = temp_audio_file.name

        # Ensure the file is closed before transcribing
        transcription = ""

        try:
            # Transcribe the audio file
            segments, info = model.transcribe(temp_audio_file_path, beam_size=1)

            # Combine all segments into a single transcription text
            transcription = "".join(segment.text for segment in segments)
            logger.info(f"Transcription completed: {transcription}")

        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
        
        finally:
            # Ensure the temporary file is deleted
            os.remove(temp_audio_file_path)

        return transcription

    except Exception as e:
        logger.error(f"General error in audio_to_text: {e}")
        return ""
