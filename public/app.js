const $ = (id) => document.getElementById(id);
let audioUrl;
$('text').addEventListener('input', () => { $('count').textContent = `${$('text').value.length.toLocaleString()} / 4,000`; });
$('speed').addEventListener('input', () => { $('pace').value = `${$('speed').value}×`; });
$('sample').addEventListener('click', () => {
  $('text').value = 'Every great idea deserves to be heard. Welcome to a space where your words become stories, your stories find a voice, and your imagination leads the way.';
  $('text').dispatchEvent(new Event('input'));
  $('text').focus();
});
fetch('/api/status').then(r => r.json()).then(data => {
  if (!data.configured) $('status').textContent = 'Studio preview · Add a server API key to generate audio.';
}).catch(() => { $('status').textContent = 'Could not connect to the server.'; });
$('studio').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('generate').disabled = true;
  $('status').textContent = 'Creating your voice-over…';
  try {
    const response = await fetch('/api/speech', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: $('text').value, voice: $('voice').value, speed: Number($('speed').value) }),
    });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Generation failed.'); }
    const blob = await response.blob();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    $('audio').src = audioUrl;
    $('download').href = audioUrl;
    $('result').hidden = false;
    $('status').textContent = 'Ready to play or download.';
  } catch (error) { $('status').textContent = error.message; }
  finally { $('generate').disabled = false; }
});
