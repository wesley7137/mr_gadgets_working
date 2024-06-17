import torch
from TTS.api import TTS
from pydub import AudioSegment
from pydub.playback import play

# Get device
device = "cuda:0" if torch.cuda.is_available() else "cpu"

# Init TTS
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

def generate_tts(response_text):
    output_audio_path = tts.tts_to_file(text=response_text, 
        speaker_wav="D:\\mr_gadget_nexus3\\backend\\utils\\tts\\colin.wav", 
        language="en", 
        file_path="temp_generated_audio.wav",
        speed=0.9,
        temperature=0.2,
        top_k=75,
        top_p=0.9,
    )

    print(f"Generated speech saved to {output_audio_path}")

    return output_audio_path

