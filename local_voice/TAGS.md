# Bracketed script cues

Cues are parsed by the tool, not sent to Chatterbox as spoken words. This is a rendering layer, not a retrained model. CLI and MCP accept the same tagged text. Model identity and emotions are approximate; named emotions are presets of expression strength, pacing, and volume rather than distinct trained emotional states.

| Cues | Behavior |
| --- | --- |
| `[pause]`, `[short pause]`, `[long pause]` | Insert 0.65, 0.3, or 1.2 seconds of exact digital silence. |
| `[pause 0.8s]` | Explicit silence from 0.05 to 5 seconds. |
| `[slowly]`, `[rushed]`, `[drawn out]`, `[slightly faster, building energy]`, `[thoughtful, slower]` | Apply pitch-preserving speed changes using ffmpeg; other expression settings may also change. |
| `[excited]`, `[sad]`, `[angry]`, `[nervous]`, `[frustrated]`, `[scared]`, `[tired]`, `[curious]`, `[playful]`, `[peaceful]`, `[amazed]`, `[anxious]` | Approximate via Chatterbox expression strength, sometimes pacing or volume. Not guaranteed emotional acting. |
| `[calm]`, `[deadpan]`, `[sarcastically]`, `[flatly]`, `[cheerfully]`, `[warm, decisive]`, `[confident, clear]`, `[smug]` | Approximate through expression and generation settings. |
| `[whispers]`, `[shouts]`, `[whispering, nervous]` | Expression/volume approximation, not true whispered or shouted vocal production. |
| `[starting calm, then losing patience]` | Frustrated preset with a warning: no gradual transition is implemented. Use separately tagged text sections for transitions. |
| `[nervous, trying to sound confident]` | Nervous expression with a stronger conditioning setting; approximate. |
| `[laughs]`, `[giggle]`, `[big laugh]`, `[sighs]`, `[gasps]`, `[clear throat]`, `[clears throat]`, `[yawns]` | Insert a configured local recording. Without a sample, omit the cue and return a warning. No fabricated laugh or throat-clear. |
| `[stammers]` | Unsupported; add desired syllable repetitions directly to the spoken script. |
| `[pirate voice]`, `[French accent]`, `[strong Russian accent]` | Unsupported; retain reference voice and warn. |
| Unknown cues | Omit the instruction from spoken text and return a warning. |

A delivery cue applies until the next delivery cue; each new delivery cue starts from neutral settings. Combine modifiers in one bracket, such as `[whispering, nervous]`. Pauses and reactions do not reset the current delivery. Plain text without cues uses the request's natural/calm/expressive default. Spoken words are preserved. Tags count toward the 1,500-character limit, with at most 40 total speech/pause/reaction sections. Each speech section is generated separately with one model loaded for the request; joins can sound discontinuous. Avoid excessive segmentation.

## Reaction recordings

Create a private JSON file with canonical cue names and absolute file paths. Set VOICE_REACTIONS_FILE in the ignored .env to its absolute path:

```json
{
  "laughs": "/absolute/private/my-laugh.wav",
  "clear throat": "/absolute/private/my-throat-clear.wav"
}
```

Only configure actual recordings you want used; the tool does not create reaction samples. Keep each recording under 15 seconds. WAV is recommended. Missing referenced files stop generation; cues without a mapping are omitted with a warning. Keep recordings and the mapping outside the public checkout. Clips are converted to mono and resampled before joining.

## Example

```text
[deadpan] You think you're average.
[pause 0.8s]
[playful] Adorable.
[laughs]
```

Results include a WAV path, the parsed cues, and warnings. The pause is deterministic; emotional interpretation and voice similarity require listening. Output remains watermarked by Chatterbox.
