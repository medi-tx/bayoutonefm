// Emoji defined via Unicode code points so the source stays pure ASCII.
// This prevents the emoji characters from being altered by tooling/transport.
const cp = String.fromCodePoint;

export const ICON = {
  rainbow: cp(0x1f308),
  snow: cp(0x2744),
  cloud: cp(0x2601),
  island: cp(0x1f3dd),
  star: cp(0x2b50),
  blossom: cp(0x1f338),
  bolt: cp(0x26a1),
  smile: cp(0x1f604),
  crown: cp(0x1f451),
  plus: cp(0x2795),
  door: cp(0x1f6aa),
  cross: cp(0x274c),
  send: cp(0x1f4e9),
  speech: cp(0x1f4ac),
  hash: '#',
  lock: cp(0x1f512),
  sparkles: cp(0x2728),
  party: cp(0x1f389),
  shield: cp(0x1f6e1),
  turtle: cp(0x1f422),
  wave: cp(0x1f44b),
  whisper: cp(0x1f910),
};

export const SERVER_ICONS = [
  ICON.rainbow,
  ICON.snow,
  ICON.cloud,
  ICON.island,
  ICON.bolt,
  ICON.blossom,
  ICON.smile,
  ICON.crown,
];

export const DEFAULT_ICON = ICON.rainbow;