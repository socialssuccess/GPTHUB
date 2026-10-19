"""Local synthesis with tool-level tag processing; no native emotion claims."""
import io
import json
import os
import subprocess
import sys
from pathlib import Path


def change_speed(audio, sample_rate, speed, torchaudio):
    if speed == 1:
        return audio
    source = io.BytesIO()
    torchaudio.save(source, audio, sample_rate, format='wav')
    result = subprocess.run(
        ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-nostdin',
         '-i', 'pipe:0', '-af', f'atempo={speed}', '-f', 'wav', '-acodec', 'pcm_s16le', 'pipe:1'],
        input=source.getvalue(), capture_output=True, check=True, timeout=60)
    return torchaudio.load(io.BytesIO(result.stdout))[0]


def main():
    request = json.load(sys.stdin)
    import torch
    import torchaudio
    from chatterbox.tts import ChatterboxTTS

    torch.set_num_threads(int(os.environ.get('OMP_NUM_THREADS', '4')))
    device = os.environ.get('VOICE_DEVICE', 'cuda' if torch.cuda.is_available() else 'cpu')
    model = ChatterboxTTS.from_pretrained(device=device)
    segments = request.get('segments') or [{
        'type': 'speech', 'text': request['text'], 'speed': 1, 'gain_db': 0,
        'cfg_weight': 0.5,
        'exaggeration': {'natural': 0.5, 'calm': 0.3, 'expressive': 0.75}[request['delivery']]}]
    clips = []
    reference_loaded = False
    for index, segment in enumerate(segments):
        print(f"Rendering section {index + 1}/{len(segments)} ({segment['type']})", file=sys.stderr, flush=True)
        if segment['type'] == 'silence':
            clips.append(torch.zeros(1, round(model.sr * segment['seconds'])))
        elif segment['type'] == 'reaction':
            if segment.get('file'):
                audio, rate = torchaudio.load(segment['file'])
                if audio.shape[-1] > rate * 15:
                    raise ValueError('Reaction samples must be at most 15 seconds.')
                clips.append(torchaudio.functional.resample(audio.mean(dim=0, keepdim=True), rate, model.sr))
        else:
            audio = model.generate(
                segment['text'], audio_prompt_path=None if reference_loaded else request['reference'],
                exaggeration=segment['exaggeration'], cfg_weight=segment['cfg_weight']).cpu()
            reference_loaded = True
            audio = change_speed(audio, model.sr, segment['speed'], torchaudio)
            audio = (audio * (10 ** (segment['gain_db'] / 20))).clamp(-1, 1)
            clips.append(audio)
    audio = torch.cat(clips, dim=-1)
    torchaudio.save(str(Path(request['output'])), audio, model.sr)


if __name__ == '__main__':
    main()
