// Pure client-side premium decision (no imports, testable under node --test). R1119-HQ4-STUDIOS-46.
// resp: parsed JSON from /api/entitlement, or null when the call failed / was blocked / was malformed.
// Rules: fail OPEN for a token holder on any error (never lock out a genuine buyer). A bare legacy flag never unlocks on its own
// when the server enforces; it unlocks only while enforcement is off, or within an explicit server-supplied grace date.
function decide(resp, hasToken, legacyFlag, nowMs) {
  if (!resp || typeof resp !== 'object') return !!hasToken;
  if (resp.configured === false) return !!hasToken || (!!legacyFlag && resp.enforce === false);
  if (resp.premium === true) return true;
  if (resp.enforce !== true) return !!hasToken || !!legacyFlag; // enforcement off: behave as before
  const grace = !!resp.graceUntil && nowMs < Date.parse(resp.graceUntil);
  return !!legacyFlag && grace;
}
module.exports = { decide };
