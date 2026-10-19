# GPTHUB Voice Studio

A local voice-over generator using Chatterbox voice cloning. Generate audio directly from script files, or let Claude Desktop / Claude Code call the included MCP tool. No paid speech API is required; model downloads, local computing, and any Claude usage have their own requirements.

## Start here

- **Windows setup and Claude connection:** [LOCAL_VOICE_SETUP.md](LOCAL_VOICE_SETUP.md)
- **Supported script cues and limitations:** [local_voice/TAGS.md](local_voice/TAGS.md)

Requires Node.js 22+, Python 3.11, and ffmpeg for tagged pacing. The initial model download is approximately 3 GB. NVIDIA GPUs are preferable; CPU inference works but can be slow. Windows setup instructions are provided, but have not been validated on a Windows computer.

```sh
npm ci
```

Install the Python environment following the platform instructions, then configure `.env` using `.env.example`. Set `VOICE_PYTHON` to the Python executable and `VOICE_REFERENCE_FILE` to a clean voice recording you are authorized to use. Keep recordings, model weights, generated audio, and credentials out of this public repository.

## Generate directly

```sh
npm run voice -- /absolute/path/script.txt natural
```

The command returns a local WAV path and any warnings. Default delivery can be `natural`, `calm`, or `expressive`. The tool accepts up to 1,500 characters per request and handles bracketed tags before synthesis. Pauses are exact silence; emotional delivery is approximate. Reaction cues require recordings, and accents are unsupported. See the tag guide for details.

## Use with Claude

The MCP server exposes `generate_voiceover`. Install the project, Python environment, model, and reference on the machine running the MCP server; GitHub access alone cannot run the model. See the Windows/Claude setup guide for configuration.

## Validation

```sh
npm test
```

Thirteen Node tests cover parsing, orchestration, errors, and a real MCP stdio connection. CPU inference was also exercised in a Linux cloud environment, including timed silence and speed processing. Audio quality and voice similarity require listening; they are not guaranteed by these checks. Chatterbox generates watermarked audio.

## Earlier browser prototype

`npm start` starts an earlier browser interface bound to loopback port 3000. It uses a separate OpenAI speech backend and requires OPENAI_API_KEY. It is not connected to the local voice-cloning engine. Do not deploy its paid endpoint publicly without authentication and rate limiting. The direct CLI and MCP tool above are the current local workflow.
