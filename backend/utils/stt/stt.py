# backend/utils/stt/stt.py

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from io import BytesIO
import soundfile as sf

device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

model_id = "distil-whisper/distil-large-v3"

model = AutoModelForSpeechSeq2Seq.from_pretrained(
    model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True, trust_remote_code=True
)
model.to(device)

processor = AutoProcessor.from_pretrained(model_id)

pipe = pipeline(
    "automatic-speech-recognition",
    model=model,
    tokenizer=processor.tokenizer,
    feature_extractor=processor.feature_extractor,
    max_new_tokens=256,
    torch_dtype=torch_dtype,
    device=device,
)

def audio_to_text(audio_data: bytes) -> str:
    audio_stream = BytesIO(audio_data)
    audio_array, sample_rate = sf.read(audio_stream)
    if len(audio_array.shape) > 1 and audio_array.shape[1] == 2:
        audio_array = audio_array.mean(axis=1)  # Convert to mono if stereo
    result = pipe(audio_array, sampling_rate=sample_rate)
    return result["text"]
