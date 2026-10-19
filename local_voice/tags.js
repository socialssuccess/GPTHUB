// Tags are tool instructions. The speech model never receives bracketed cues.
const natural = { exaggeration: 0.5, cfg_weight: 0.5, speed: 1, gain_db: 0 };
const presets = {
  excited: { exaggeration: 0.8, speed: 1.08 },
  sad: { exaggeration: 0.35, speed: 0.88 },
  angry: { exaggeration: 0.8, gain_db: 1 },
  nervous: { exaggeration: 0.65, speed: 1.06 },
  frustrated: { exaggeration: 0.7 },
  scared: { exaggeration: 0.65 },
  tired: { exaggeration: 0.25, speed: 0.88 },
  curious: { exaggeration: 0.6 },
  playful: { exaggeration: 0.75, speed: 1.05 },
  peaceful: { exaggeration: 0.3, speed: 0.94 },
  amazed: { exaggeration: 0.8 },
  anxious: { exaggeration: 0.65, speed: 1.06 },
  whispers: { exaggeration: 0.3, gain_db: -6 },
  shouts: { exaggeration: 0.8, gain_db: 2 },
  calm: { exaggeration: 0.3, speed: 0.95 },
  deadpan: { exaggeration: 0.2 },
  sarcastically: { exaggeration: 0.65, speed: 0.95 },
  flatly: { exaggeration: 0.2 },
  cheerfully: { exaggeration: 0.75, speed: 1.04 },
  warm: { exaggeration: 0.55 },
  decisive: { cfg_weight: 0.6 },
  confident: { cfg_weight: 0.6, exaggeration: 0.55 },
  clear: { cfg_weight: 0.6 },
  slowly: { speed: 0.85 },
  rushed: { speed: 1.18 },
  'slightly faster': { speed: 1.1 },
  'building energy': { exaggeration: 0.75 },
  thoughtful: { exaggeration: 0.4 },
  slower: { speed: 0.88 },
  'drawn out': { speed: 0.8 },
  smug: { exaggeration: 0.6, speed: 0.95 },
};
const aliases = { whispering: 'whispers', shouting: 'shouts', sarcastic: 'sarcastically', 'clears throat': 'clear throat', giggles: 'giggle', yawn: 'yawns', sigh: 'sighs', gasp: 'gasps', laugh: 'laughs' };
const reactions = new Set(['laughs', 'giggle', 'big laugh', 'sighs', 'gasps', 'clear throat', 'yawns']);
export function parseTaggedScript(text, delivery = 'natural') {
  const segments = [], warnings = new Set(), tags = [];
  let settings = { ...natural, exaggeration: { natural: 0.5, calm: 0.3, expressive: 0.75 }[delivery] };
  const speech = value => {
    if (/[\[\]]/.test(value)) throw new Error('Unmatched tag bracket. Use [cue] followed by spoken text.');
    if (value.trim()) segments.push({ type: 'speech', text: value.trim(), ...settings });
  };
  let previous = 0;
  for (const match of text.matchAll(/\[([^\[\]]+)\]/g)) {
    speech(text.slice(previous, match.index));
    previous = match.index + match[0].length;
    const cue = match[1].toLowerCase().trim().replace(/\s+/g, ' ');
    tags.push(cue);
    const pause = cue.match(/^(?:pause|short pause|long pause)(?:\s*:?\s*(\d+(?:\.\d+)?)\s*s)?$/);
    if (pause) {
      const seconds = pause[1] ? Number(pause[1]) : cue.startsWith('short') ? 0.3 : cue.startsWith('long') ? 1.2 : 0.65;
      if (seconds < 0.05 || seconds > 5) throw new Error('Explicit pauses must be between 0.05 and 5 seconds.');
      segments.push({ type: 'silence', seconds });
      continue;
    }
    const reaction = aliases[cue] || cue;
    if (reactions.has(reaction)) { segments.push({ type: 'reaction', cue: reaction }); continue; }
    if (/accent|pirate voice/.test(cue)) {
      warnings.add(`[${cue}] is unsupported; the configured reference voice is retained.`);
      continue;
    }
    if (cue === 'stammers') { warnings.add('[stammers] is unsupported; write the desired repetitions explicitly in the spoken script.'); continue; }
    let atoms = cue.split(',').map(x => x.trim());
    if (cue === 'starting calm, then losing patience') {
      warnings.add(`[${cue}] is approximated as frustrated delivery; a gradual emotional transition is not supported.`);
      atoms = ['frustrated'];
    }
    if (cue === 'nervous, trying to sound confident') atoms = ['nervous', 'decisive'];
    // A new delivery cue replaces the previous cue; pause/reaction cues preserve it.
    const next = { ...natural };
    let recognized = false;
    for (let atom of atoms) {
      atom = aliases[atom] || atom;
      if (presets[atom]) { Object.assign(next, presets[atom]); recognized = true; }
      else warnings.add(`[${atom}] is unsupported and was omitted from spoken text.`);
    }
    if (recognized) {
      settings = next;
      warnings.add('Emotion and tone cues use approximate expression/pacing settings, not native emotion control.');
      if (atoms.some(x => /whisper|shout/.test(x))) warnings.add('Whispers/shouts adjust expression and volume; they do not reproduce true whispering or shouting.');
    }
  }
  speech(text.slice(previous));
  if (!segments.some(x => x.type === 'speech')) throw new Error('Include spoken text, not only tags.');
  if (segments.length > 40) throw new Error('Too many sections; use at most 40 sections per request.');
  return { segments, warnings: [...warnings], tags };
}
