// Run: node --test tests/  Guards R1119-HQ4-STUDIOS-75: the privacy copy must not deny the unlock-token server check.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'legalContent.ts'), 'utf8');
const m = src.match(/"privacy":\s*("(?:[^"\\]|\\.)*")/);
const text = JSON.parse(m[1]).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');
test('privacy page makes one accurate statement about local storage and the unlock token', () => {
  assert.ok(!/is not sent to us\. Your full-game unlock is kept there/.test(text), 'contradiction phrase present');
  assert.ok(!/unlock is kept there as a signed token/.test(text), 'old token wording present');
  assert.ok(/signed token\. The game sends that token to our server only to check it is valid/.test(text));
  assert.ok(/leaderboard/i.test(text) && /saved to a Google Firebase database/.test(text));
  assert.ok(/the email is not stored/.test(text));
});
