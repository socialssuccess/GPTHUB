import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateVoice } from '../mcp/voice.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('fixed local reference and delivery reach engine; output files are distinct', async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'local-voice-'));
  const reference = path.join(outputDir, 'reference.wav');
  await writeFile(reference, 'reference');
  try {
    const options = { reference, outputDir, python: 'test-python', runner: async (python, args, input) => {
      assert.equal(python, 'test-python');
      assert.match(args[0], /generate.py$/);
      assert.equal(input.reference, reference);
      assert.equal(input.text, 'Hello!');
      assert.equal(input.delivery, 'expressive');
      await writeFile(input.output, 'RIFF-audio');
    } };
    const first = await generateVoice({ text: 'Hello!', delivery: 'expressive' }, options);
    const second = await generateVoice({ text: 'Hello!', delivery: 'expressive' }, options);
    assert.notEqual(first.file, second.file);
    assert.equal(first.format, 'wav');
    assert.equal(await readFile(first.file, 'utf8'), 'RIFF-audio');
    await assert.rejects(generateVoice({ text: 'Hi', filename: '../escape' }, options), /Filename/);
    await assert.rejects(generateVoice({ text: 'Hi', delivery: 'unknown' }, options), /delivery/);
  } finally { await rm(outputDir, { recursive: true, force: true }); }
});
test('missing local configuration is actionable', async () => {
  await assert.rejects(generateVoice({ text: 'Hello' }, { reference: '' }), /Configure VOICE_REFERENCE_FILE/);
  await assert.rejects(generateVoice({ text: 'Hello' }, { reference: '/does-not-exist.wav' }), /missing or unreadable/);
});
test('real MCP handshake discovers local tool and reports missing reference', async () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: process.execPath, args: ['mcp/server.js'], env: { PATH: process.env.PATH, VOICE_REFERENCE_FILE: '' }, stderr: 'pipe' });
  try {
    await client.connect(transport);
    const result = await client.listTools();
    assert.equal(result.tools.length, 1);
    assert.equal(result.tools[0].name, 'generate_voiceover');
    const call = await client.callTool({ name: 'generate_voiceover', arguments: { text: 'Hello' } });
    assert.equal(call.isError, true);
    assert.match(call.content[0].text, /Configure VOICE_REFERENCE_FILE/);
  } finally { await client.close(); }
});
test('tag plan reaches engine and missing reactions are reported', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voice-tags-'));
  const reference = path.join(directory, 'reference.wav');
  await writeFile(reference, 'reference');
  try {
    const result = await generateVoice({ text: '[deadpan] Hello. [short pause] [excited] Welcome! [laughs] [French accent] Goodbye.' }, {
      reference, outputDir: directory, reactionsFile: '', runner: async (python, args, input) => {
        assert.equal(input.segments[0].exaggeration, 0.2);
        assert.equal(input.segments[1].seconds, 0.3);
        assert.equal(input.segments[2].text, 'Welcome!');
        assert.equal(input.segments[2].speed, 1.08);
        await writeFile(input.output, 'audio');
      },
    });
    assert.ok(result.warnings.some(x => x.includes('[laughs] omitted')));
    assert.ok(result.warnings.some(x => x.includes('accent') && x.includes('unsupported')));
    assert.ok(result.tags.includes('short pause'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('configured reaction sample is passed to the local renderer', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'voice-reactions-'));
  const reference = path.join(directory, 'reference.wav');
  const reactionsFile = path.join(directory, 'reactions.json');
  await writeFile(reference, 'sample');
  await writeFile(reactionsFile, JSON.stringify({ laughs: reference }));
  try {
    const result = await generateVoice({ text: 'Hello. [laughs]' }, { reference, outputDir: directory, reactionsFile,
      runner: async (python, args, input) => {
        assert.equal(input.segments[1].file, reference);
        await writeFile(input.output, 'audio');
      },
    });
    assert.equal(result.warnings.length, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
