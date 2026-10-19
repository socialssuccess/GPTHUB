import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTaggedScript } from '../local_voice/tags.js';

test('spoken text is preserved while pauses become timed silence', () => {
  const plan = parseTaggedScript('[smug] You think you\'re... average. [pause 0.8s] Adorable. [deadpan] You\'re wrong.');
  assert.deepEqual(plan.segments.filter(x => x.type === 'speech').map(x => x.text), ["You think you're... average.", 'Adorable.', "You're wrong."]);
  assert.equal(plan.segments[1].seconds, 0.8);
  assert.equal(plan.segments.at(-1).exaggeration, 0.2);
  assert.ok(plan.segments.filter(x => x.type === 'speech').every(x => !x.text.includes('[')));
});
test('the requested emotions, delivery, pacing, and composite cues are recognized', () => {
  const cues = ['excited','sad','angry','nervous','frustrated','scared','tired','curious','playful','peaceful','amazed','anxious','whispers','shouts','calm','deadpan','sarcastically','flatly','cheerfully','warm, decisive','confident, clear','slowly','rushed','slightly faster, building energy','thoughtful, slower','drawn out','whispering, nervous','starting calm, then losing patience','nervous, trying to sound confident'];
  for (const cue of cues) {
    const plan = parseTaggedScript(`[${cue}] Hello.`);
    assert.equal(plan.segments[0].text, 'Hello.');
    assert.ok(!plan.warnings.some(x => x.includes('unsupported')), cue);
  }
  assert.equal(parseTaggedScript('[whispering, nervous] Hello.').segments[0].gain_db, -6);
  assert.equal(parseTaggedScript('[thoughtful, slower] Hello.').segments[0].speed, 0.88);
});
test('reactions remain sample requests, while accents and unknown cues report limitations', () => {
  for (const cue of ['laughs','giggle','big laugh','sighs','gasps','clear throat','clears throat','yawns']) {
    assert.equal(parseTaggedScript(`Hello. [${cue}]`).segments[1].type, 'reaction');
  }
  for (const cue of ['pirate voice','French accent','strong Russian accent','stammers','invented cue']) {
    const plan = parseTaggedScript(`[${cue}] Hello.`);
    assert.equal(plan.segments[0].text, 'Hello.');
    assert.ok(plan.warnings.some(x => x.includes('unsupported')));
  }
});
test('invalid brackets and excessive pause durations fail before generation', () => {
  for (const text of ['[excited Hello.', 'Hello]', '[pause 9s] Hello.', '[pause 0s] Hello.', '[laughs]']) {
    assert.throws(() => parseTaggedScript(text));
  }
  assert.equal(parseTaggedScript('[short pause] Hello.').segments[0].seconds, 0.3);
});
