import { parseTaggedScript } from '../local_voice/tags.js';
import { mkdir, access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function runEngine(python, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errorOutput = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Local generation timed out after 15 minutes. Try a shorter script.')); }, 900000);
    child.stderr.on('data', chunk => { errorOutput = (errorOutput + chunk).slice(-4000); });
    child.on('error', () => { clearTimeout(timer); reject(new Error('Could not start the local Python engine. Check VOICE_PYTHON and LOCAL_VOICE_SETUP.md.')); });
    child.stdin.on('error', () => {});
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Local voice engine failed. ${errorOutput.slice(-1600)}`));
    });
    child.stdin.end(JSON.stringify(input));
  });
}
let busy = false;
export async function generateVoice({ text, filename, delivery = 'natural' }, {
  reference = process.env.VOICE_REFERENCE_FILE,
  python = process.env.VOICE_PYTHON || 'python',
  outputDir = process.env.VOICE_OUTPUT_DIR || fileURLToPath(new URL('../output/', import.meta.url)),
  runner = runEngine,
  reactionsFile = process.env.VOICE_REACTIONS_FILE,
} = {}) {
  if (typeof text !== 'string' || !text.trim() || text.length > 1500) throw new Error('Provide 1–1,500 characters. Split longer scripts into sections.');
  if (filename && !/^[a-zA-Z0-9_-]{1,80}$/.test(filename)) throw new Error('Filename must contain only letters, digits, hyphens, or underscores.');
  if (!['natural', 'calm', 'expressive'].includes(delivery)) throw new Error('Choose natural, calm, or expressive delivery.');
  const plan = parseTaggedScript(text, delivery);
  const reactionSamples = reactionsFile ? JSON.parse(await readFile(reactionsFile, 'utf8')) : {};
  for (const segment of plan.segments) {
    if (segment.type !== 'reaction') continue;
    const sample = reactionSamples[segment.cue];
    if (typeof sample === 'string' && path.isAbsolute(sample)) {
      await access(sample).catch(() => { throw new Error(`Reaction sample for [${segment.cue}] is missing or unreadable.`); });
      segment.file = sample;
    } else plan.warnings.push(`[${segment.cue}] omitted: configure an absolute recording path in VOICE_REACTIONS_FILE to insert this sound.`);
  }
  if (!reference) throw new Error('Configure VOICE_REFERENCE_FILE and VOICE_PYTHON. See LOCAL_VOICE_SETUP.md.');
  await access(reference).catch(() => { throw new Error('The configured voice reference file is missing or unreadable.'); });
  if (busy) throw new Error('The local voice engine is busy. Wait for the current request to finish.');
  busy = true;
  try {
    const directory = path.resolve(outputDir);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${filename || 'voiceover'}-${randomUUID()}.wav`);
    await runner(python, [fileURLToPath(new URL('../local_voice/generate.py', import.meta.url))], { text, reference: path.resolve(reference), output: file, delivery, segments: plan.segments });
    await access(file).catch(() => { throw new Error('The local engine did not produce an audio file.'); });
    return { file, format: 'wav', engine: 'chatterbox', ai_generated: true, tags: plan.tags, warnings: plan.warnings };
  } finally { busy = false; }
}
