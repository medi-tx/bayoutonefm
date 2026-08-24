import bcrypt from 'bcryptjs';
import { isCleanUsername } from './safety.js';

// The parental PIN gates account creation and server creation so a
// grown-up must be involved. Set PARENTAL_PIN in the environment to
// override the default.  The default is intentionally insecure - a
// warning is printed at server startup if the default is in use.
export const PARENTAL_PIN =
  process.env.PARENTAL_PIN && process.env.PARENTAL_PIN.length >= 4
    ? process.env.PARENTAL_PIN
    : '0000';

export function usingDefaultPin() {
  return !process.env.PARENTAL_PIN;
}

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

export function checkParentalPin(pin) {
  return pin === PARENTAL_PIN;
}

export function validUsername(name) {
  return (
    typeof name === 'string' &&
    name.length >= 3 &&
    name.length <= 20 &&
    /^[a-zA-Z0-9_]+$/.test(name) &&
    isCleanUsername(name)
  );
}

export function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 6 && pw.length <= 72;
}

export const AVATAR_COLORS = [
  '#7c5cff',
  '#ff7c9b',
  '#5cb8ff',
  '#ffc65c',
  '#5cffa8',
  '#ff8c5c',
  '#c65cff',
  '#5cffe0',
];

export function pickAvatarColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}