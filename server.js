import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const voices = ['alloy', 'ash', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];
export function createServer({ apiKey = process.env.OPENAI_API_KEY, fetcher = fetch } = {}) {
  return http.createServer(async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'GET' && req.url === '/api/status') return json(200, { configured: Boolean(apiKey) });
    if (req.method === 'POST' && req.url === '/api/speech') {
      try {
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 24000) return json(413, { error: 'Request is too large.' });
        }
        let data;
        try { data = JSON.parse(body); } catch { return json(400, { error: 'Invalid JSON.' }); }
        if (!data || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 4000 || !voices.includes(data.voice)) {
          return json(400, { error: 'Choose a voice and enter between 1 and 4,000 characters.' });
        }
        const speed = data.speed ?? 1;
        if (typeof speed !== 'number' || speed < 0.5 || speed > 2) return json(400, { error: 'Speed must be between 0.5 and 2.' });
        if (!apiKey) return json(503, { error: 'Add OPENAI_API_KEY to the server’s .env file to enable generation.' });
        const upstream = await fetcher('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'tts-1', input: data.text.trim(), voice: data.voice, speed, response_format: 'mp3' }),
          signal: AbortSignal.timeout(60000),
        });
        if (!upstream.ok) return json(502, { error: upstream.status === 401 ? 'The speech provider rejected the server API key.' : 'The speech provider could not generate audio. Check your account billing and try again.' });
        const audio = Buffer.from(await upstream.arrayBuffer());
        res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
        res.end(audio);
      } catch { json(502, { error: 'Unable to reach the speech provider. Please try again.' }); }
      return;
    }
    const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    if (req.method !== 'GET' || !files[req.url]) return json(404, { error: 'Not found.' });
    try {
      const [file, type] = files[req.url];
      const content = await readFile(fileURLToPath(new URL(`./public/${file}`, import.meta.url)));
      res.writeHead(200, { 'Content-Type': type });
      res.end(content);
    } catch { json(500, { error: 'Unable to load the app.' }); }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createServer().listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`Voice Studio running on port ${process.env.PORT || 3000}`));
}
