import { BAD_WORDS } from './words.js';

// Common leetspeak / substitution characters to normalize before matching.
const SUBSTITUTIONS = {
  '@': 'a',
  '4': 'a',
  '3': 'e',
  '1': 'i',
  '!': 'i',
  '0': 'o',
  '$': 's',
  '5': 's',
  '7': 't',
  '+': 't',
};

// Reverse map: letter -> characters that kids might use to replace it.
const REV = {};
for (const [k, v] of Object.entries(SUBSTITUTIONS)) {
  (REV[v] ??= []).push(k);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Lowercase, replace leetspeak, and collapse 3+ repeated chars to one so
// "shiiit" / "fuuuuck" still match the blocked word.
function normalizeStr(text) {
  let out = '';
  for (const ch of text.toLowerCase()) {
    out += SUBSTITUTIONS[ch] ?? ch;
  }
  return out.replace(/(.)\1{2,}/g, '$1');
}

// Build one capture-group for a single letter that also accepts its leet variants.
function letterGroup(c) {
  const alts = [c, ...(REV[c] || [])].map(escapeRe);
  return '(?:' + alts.join('|') + ')';
}

// Tolerant inner pattern for a blocked word: each letter (or its leet variant),
// with optional separators (space, hyphen, underscore, dot) between letters.
function tolerantInner(word) {
  return word
    .split('')
    .map(letterGroup)
    .join('[\\s\\-_.]*');
}

// Non-global regex for detection (whole-word, case-insensitive, alphanumeric boundaries).
function detectRe(word) {
  return new RegExp('(^|[^a-z0-9])' + tolerantInner(word) + '([^a-z0-9]|$)', 'i');
}

// Global regex for masking the original text (captures the leading boundary and the word).
// Trailing boundary is a lookahead so we do not consume the following character,
// but still require a real word break — otherwise "hell" would also mask "hello".
function maskRe(word) {
  return new RegExp(
    '(^|[^a-zA-Z0-9])(' + tolerantInner(word) + ')(?=[^a-zA-Z0-9]|$)',
    'gi'
  );
}

// Phone number patterns (US-style and long digit sequences).
const PHONE_PATTERNS = [
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // 555 123 4567
  /\b\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g, // international
];

// Email pattern.
const EMAIL_PATTERN = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi;

/**
 * Sanitize a chat message for kid safety.
 * Returns { cleaned, flagged, reasons }.
 */
export function sanitize(raw) {
  if (typeof raw !== 'string') return { cleaned: '', flagged: false, reasons: [] };
  const reasons = [];
  let text = raw;

  // --- PII redaction: phone numbers ---
  for (const re of PHONE_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(text)) {
      reasons.push('phone number');
      re.lastIndex = 0;
      text = text.replace(re, '[phone hidden]');
    }
  }

  // --- PII redaction: email addresses ---
  EMAIL_PATTERN.lastIndex = 0;
  if (EMAIL_PATTERN.test(text)) {
    reasons.push('email');
    EMAIL_PATTERN.lastIndex = 0;
    text = text.replace(EMAIL_PATTERN, '[email hidden]');
  }

  // --- Profanity filter ---
  const normalized = ' ' + normalizeStr(text) + ' ';
  const profaneFound = [];
  for (const word of BAD_WORDS) {
    if (detectRe(word).test(normalized)) profaneFound.push(word);
  }

  if (profaneFound.length > 0) {
    reasons.push('profanity');
    const masked = maskProfanity(text);
    // If masking could not fully remove the profanity (leetspeak/repeats it
    // couldn't pattern-match), hide the whole message so kids never see it.
    const maskedNorm = ' ' + normalizeStr(masked) + ' ';
    const stillDirty = profaneFound.some((w) => detectRe(w).test(maskedNorm));
    text = stillDirty ? "[removed - let's keep it kind!]" : masked;
  }

  return {
    cleaned: text,
    flagged: reasons.length > 0,
    reasons,
  };
}

// Replace detected profanity in the ORIGINAL text with asterisks, keeping
// the first character so the shape of the message stays readable ("d***").
function maskProfanity(text) {
  let masked = text;
  for (const word of BAD_WORDS) {
    const re = maskRe(word);
    masked = masked.replace(re, (match, boundary, wordMatch) => {
      const stars = '*'.repeat(Math.max(wordMatch.length - 1, 1));
      return boundary + wordMatch[0] + stars;
    });
  }
  return masked;
}

// Check whether a username passes the profanity filter (used at registration).
// For names there is no "word boundary" concept, so a blocked word is rejected
// even when it appears as a substring (e.g. "shithead").
export function isCleanUsername(name) {
  const normalized = normalizeStr(name);
  for (const word of BAD_WORDS) {
    const re = new RegExp(tolerantInner(word), 'i');
    if (re.test(normalized)) return false;
  }
  return true;
}