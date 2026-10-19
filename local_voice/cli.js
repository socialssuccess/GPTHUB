import { readFile } from 'node:fs/promises';
import { generateVoice } from '../mcp/voice.js';
const [script, delivery = 'natural'] = process.argv.slice(2);
if (!script) {
  console.error('Usage: npm run voice -- /path/to/script.txt [natural|calm|expressive]');
  process.exitCode = 1;
} else {
  try {
    const text = await readFile(script, 'utf8');
    console.log(JSON.stringify(await generateVoice({ text, delivery }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
