import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitize, isCleanUsername } from './safety.js';

test('masks a blocked word without mangling a longer innocent word in the same message', () => {
  const { cleaned, flagged, reasons } = sanitize('go to hell, hello friend');
  assert.equal(flagged, true);
  assert.deepEqual(reasons, ['profanity']);
  assert.match(cleaned, /h\*{3}/);
  assert.match(cleaned, /hello/);
  assert.doesNotMatch(cleaned, /h\*{3}o/);
});

test('does not flag hello on its own', () => {
  const { cleaned, flagged } = sanitize('hello');
  assert.equal(flagged, false);
  assert.equal(cleaned, 'hello');
});

test('still masks a blocked word used as its own token', () => {
  const { cleaned, flagged } = sanitize('hell');
  assert.equal(flagged, true);
  assert.equal(cleaned, 'h***');
});

test('rejects usernames that embed a blocked word', () => {
  assert.equal(isCleanUsername('shithead'), false);
  assert.equal(isCleanUsername('friendly'), true);
});
