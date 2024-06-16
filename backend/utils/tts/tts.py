# backend/utils/tts/tts.py

import torch
import tempfile
import torchaudio
import requests
from pathlib import Path
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts

# Define the model globally
XTTS_MODEL = None

# Base URL for the Hugging Face repository
BASE_URL = "https://huggingface.co/wesley7137/chris_hems_stt_voice_model/resolve/main/"

# Files in the repository
FILES = {
    "config": "config.json",
    "model": "model.pth",
    "vocab": "vocab.json",
    "speakers": "speakers_xtts.pth",
}

def download_file(file_key):
    file_name = FILES[file_key]
    url = BASE_URL + file_name
    response = requests.get(url)
    response.raise_for_status()  # Raise an error if the download fails

    # Save the file to a temporary location
    temp_file_path = tempfile.NamedTemporaryFile(delete=False)
    temp_file_path.write(response.content)
    temp_file_path.close()
    
    return temp_file_path.name

def clear_gpu_cache():
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

def load_model():
    global XTTS_MODEL
    clear_gpu_cache()
    
    xtts_config = download_file("config")
    xtts_checkpoint = download_file("model")
    xtts_vocab = download_file("vocab")
    xtts_speaker = download_file("speakers")

    # Load configuration
    config = XttsConfig()
    config.load_json(xtts_config)
    
    # Initialize model from configuration
    XTTS_MODEL = Xtts.init_from_config(config)
    print("Loading XTTS model!")
    
    # Load model checkpoint
    XTTS_MODEL.load_checkpoint(config, checkpoint_path=xtts_checkpoint, vocab_path=xtts_vocab, speaker_file_path=xtts_speaker, use_deepspeed=False)
    
    # Move model to GPU if available
    if torch.cuda.is_available():
        XTTS_MODEL.cuda()

    print("Model Loaded!")

def run_tts(lang, tts_text, speaker_audio_file, temperature=0.75, length_penalty=1.0, repetition_penalty=5.0, top_k=50, top_p=0.85, sentence_split=True, use_config=False):
    if XTTS_MODEL is None or not speaker_audio_file:
        raise ValueError("Model must be loaded and a speaker audio file must be provided.")
    
    # Get conditioning latents and speaker embedding
    gpt_cond_latent, speaker_embedding = XTTS_MODEL.get_conditioning_latents(
        audio_path=speaker_audio_file,
        gpt_cond_len=XTTS_MODEL.config.gpt_cond_len,
        max_ref_length=XTTS_MODEL.config.max_ref_len,
        sound_norm_refs=XTTS_MODEL.config.sound_norm_refs
    )
    
    # Perform inference
    if use_config:
        out = XTTS_MODEL.inference(
            text=tts_text,
            language=lang,
            gpt_cond_latent=gpt_cond_latent,
            speaker_embedding=speaker_embedding,
            temperature=XTTS_MODEL.config.temperature,
            length_penalty=XTTS_MODEL.config.length_penalty,
            repetition_penalty=XTTS_MODEL.config.repetition_penalty,
            top_k=XTTS_MODEL.config.top_k,
            top_p=XTTS_MODEL.config.top_p,
            enable_text_splitting=True
        )
    else:
        out = XTTS_MODEL.inference(
            text=tts_text,
            language=lang,
            gpt_cond_latent=gpt_cond_latent,
            speaker_embedding=speaker_embedding,
            temperature=temperature,
            length_penalty=length_penalty,
            repetition_penalty=float(repetition_penalty),
            top_k=top_k,
            top_p=top_p,
            enable_text_splitting=sentence_split
        )

    # Save output audio to a file
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as fp:
        out["wav"] = torch.tensor(out["wav"]).unsqueeze(0)
        out_path = fp.name
        torchaudio.save(out_path, out["wav"], 24000)

    return out_path

def text_to_audio(tts_text, voice):
    # Load the model
    load_model()
    speaker_audio_file = f"./{voice}.wav"
    # Generate speech
    output_audio_path = run_tts(
        lang="en",
        tts_text=tts_text,
        speaker_audio_file=speaker_audio_file
    )
    print(f"Generated speech saved to {output_audio_path}")

    return output_audio_path
