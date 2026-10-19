import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';

async function withServer(options, run) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const speech = (url, body) => fetch(`${url}/api/speech`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
test('studio and assets load; missing key is reported', async () => {
  await withServer({ apiKey: '' }, async url => {
    const page = await fetch(url);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Your script/);
    for (const asset of ['/app.js', '/style.css']) assert.equal((await fetch(url + asset)).status, 200);
    assert.deepEqual(await (await fetch(url + '/api/status')).json(), { configured: false });
    assert.equal((await speech(url, { text: 'Hello', voice: 'nova' })).status, 503);
  });
});
test('invalid requests never reach paid provider', async () => {
  await withServer({ apiKey: 'test-only', fetcher: () => assert.fail('Unexpected provider request') }, async url => {
    for (const body of [null, {}, { text: '', voice: 'nova' }, { text: 'x'.repeat(4001), voice: 'nova' }, { text: 'Hello', voice: 'invalid' }, { text: 'Hello', voice: 'nova', speed: 4 }]) {
      assert.equal((await speech(url, body)).status, 400);
    }
  });
});
test('speech audio and requested voice/speed pass through', async () => {
  await withServer({ apiKey: 'test-only', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/audio/speech');
    assert.deepEqual(JSON.parse(options.body), { model: 'tts-1', input: 'Hello', voice: 'nova', speed: 1.2, response_format: 'mp3' });
    return new Response(new Uint8Array([73, 68, 51]));
  } }, async url => {
    const response = await speech(url, { text: 'Hello', voice: 'nova', speed: 1.2 });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(await response.text(), 'ID3');
  });
});
test('provider failures return a helpful error without credentials', async () => {
  await withServer({ apiKey: 'test-only', fetcher: async () => new Response('private provider error', { status: 401 }) }, async url => {
    const response = await speech(url, { text: 'Hello', voice: 'nova' });
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: 'The speech provider rejected the server API key.' });
  });
});
