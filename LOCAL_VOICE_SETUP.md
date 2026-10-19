# Free local channel voice for Claude

The MCP tool now uses the open-source Chatterbox model, not ElevenLabs or a paid speech API. It conditions generation on one configured voice recording. Model software and weights must be downloaded first. Compute, storage, and electricity are still needed. CPU generation can be slow; an NVIDIA GPU is preferable. Voice similarity is not guaranteed. Chatterbox embeds an audio watermark.

## Local installation (not yet model-validated)

Install on the computer running Claude Desktop or Claude Code. Cloud-only paths are not available to your desktop. Use Node.js 22+, Python 3.11, and ffmpeg. These model installation steps still require validation on the target computer:

```sh
npm ci
python3.11 -m venv .voice-venv
.voice-venv/bin/python -m pip install -r local_voice/requirements.txt
cp .env.example .env
```

On Windows, use `.voice-venv/Scripts/python.exe` instead of `.voice-venv/bin/python`. Set VOICE_PYTHON and VOICE_REFERENCE_FILE in your ignored .env to absolute local paths. No API key is needed. First generation downloads the model from Hugging Face; later inference can use its local cache. Review the model's license and download requirements for your use.

Choose 10–20 seconds of clean speech with no music, overlapping speakers, or long silence. Example extraction after choosing the correct start time:

```sh
ffmpeg -ss 30 -i recording.mp3 -t 15 -ac 1 -ar 24000 reference.wav
```

Set VOICE_REFERENCE_FILE to that WAV. Keep recordings outside the public repository or in ignored references/. Supplied recordings have not been listened to or scored for reference quality.

## Connect Claude Desktop

Merge into your existing MCP configuration, replacing the paths with absolute paths on your computer:

```json
{
  "mcpServers": {
    "gpthub-voice": {
      "command": "node",
      "args": [
        "--env-file=/absolute/path/GPTHUB/.env",
        "/absolute/path/GPTHUB/mcp/server.js"
      ]
    }
  }
}
```

Restart Claude Desktop and check that generate_voiceover is available. Use a full Node executable path if needed. On Windows use forward slashes or escape backslashes.

For Claude Code:

```sh
claude mcp add --transport stdio --scope user gpthub-voice -- node --env-file=/absolute/path/GPTHUB/.env /absolute/path/GPTHUB/mcp/server.js
```

## Automation instruction

> Preserve my script's words. Use the supported cues documented in local_voice/TAGS.md when requested. Call generate_voiceover with tagged text, a default delivery, and an optional filename prefix. Split scripts longer than 1,500 characters at sentence boundaries and generate sequentially. Return WAV paths and all warnings. Do not claim unsupported reactions or accents were rendered. Do not claim separate requests have been merged.

The tool now parses delivery, pause, pacing, and reaction cues; see local_voice/TAGS.md for exact limitations. The model itself has not been trained to understand these tags. Each request loads the model; keep initial tests short. The output is WAV; conversion, merging, and channel publishing can remain in your existing automation. Audio is saved locally, and file access by other Claude tools depends on permissions. The tool does not publish anything.

## Validation status

Node/MCP tests use a fake local engine; they do not prove model inference, cloning quality, or speed. Live model setup remains to be validated on your target hardware. `npm test` checks the transport and local-engine integration.

## Windows without NVIDIA GPU

A CPU installer is included at `scripts/setup-windows.ps1`. It is prepared for Windows but has not been run on a Windows machine. Allow several GB for packages/model caches; 16 GB RAM is preferable. Performance must be measured on your PC.

Install Node.js 22+ and Python 3.11 (including the Python launcher) from their official websites. Open PowerShell in this project directory and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

The execution policy override applies only to this invocation; inspect the script before running it. It installs CPU PyTorch and Chatterbox in `.voice-venv`, preserves an existing `.env`, and writes `claude-config.local.json` with your actual computer paths. It does not edit Claude's configuration automatically. Merge that entry into Claude Desktop's developer configuration and restart Claude.

Provide a clean 10–20 second WAV reference at `references/voice.wav`, or change VOICE_REFERENCE_FILE in `.env` to your chosen file. WAV avoids MP3 decoder differences. You can export a WAV selection with an audio editor. Keep reference files private and out of Git.

Start with a single sentence in Claude. Model weights must download once before inference; generation can be slow on CPU. Audio remains on your PC. Similarity and speed have not been validated, so check a short sample before automating full channel scripts. The current implementation reloads the model for each call and does not stream; optimization can follow a successful quality check.
