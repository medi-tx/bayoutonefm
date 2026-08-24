(function () {
  'use strict';

  const INSTRUMENTS = [
    { id: 'kick', name: 'Kick', max: 2 },
    { id: 'snare', name: 'Snare', max: 2 },
    { id: 'hh', name: 'Hi-Hat', max: 3 },
    { id: 'clap', name: 'Clap', max: 2 },
    { id: 'bass', name: 'Bass', max: 2 },
    { id: 'lead', name: 'Lead', max: 2 }
  ];

  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const SCALES = {
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Minor': [0, 2, 3, 5, 7, 8, 10],
    'Maj Pent': [0, 2, 4, 7, 9],
    'Min Pent': [0, 3, 5, 7, 10],
    'Blues': [0, 3, 5, 6, 7, 10],
    'Dorian': [0, 2, 3, 5, 7, 9, 10]
  };

  const LS_CFG = 'mus$icmaker_sb_cfg';
  const LS_STATE = 'mus$icmaker_state_v1';

  const SETUP_SQL = "-- mus$icmaker Supabase setup\n-- Run this in your Supabase project's SQL Editor.\n\ncreate table if not exists public.profiles (\n  id uuid primary key references auth.users(id) on delete cascade,\n  username text unique not null,\n  time_ms bigint not null default 0,\n  created_at timestamptz not null default now()\n);\n\ncreate table if not exists public.beats (\n  id bigint generated always as identity primary key,\n  owner uuid not null references public.profiles(id) on delete cascade,\n  name text not null,\n  pattern jsonb not null,\n  bpm int not null,\n  root text not null,\n  scale text not null,\n  updated_at timestamptz not null default now()\n);\n\ncreate table if not exists public.lyrics (\n  id bigint generated always as identity primary key,\n  owner uuid not null references public.profiles(id) on delete cascade,\n  title text not null default 'Untitled',\n  text text not null default '',\n  updated_at timestamptz not null default now()\n);\n\ncreate table if not exists public.beat_shares (\n  beat_id bigint not null references public.beats(id) on delete cascade,\n  shared_with uuid not null references public.profiles(id) on delete cascade,\n  shared_by uuid not null references public.profiles(id) on delete cascade,\n  created_at timestamptz not null default now(),\n  primary key (beat_id, shared_with)\n);\n\ncreate table if not exists public.lyric_shares (\n  lyric_id bigint not null references public.lyrics(id) on delete cascade,\n  shared_with uuid not null references public.profiles(id) on delete cascade,\n  shared_by uuid not null references public.profiles(id) on delete cascade,\n  created_at timestamptz not null default now(),\n  primary key (lyric_id, shared_with)\n);\n\ncreate table if not exists public.friend_requests (\n  \"from\" uuid not null references public.profiles(id) on delete cascade,\n  \"to\" uuid not null references public.profiles(id) on delete cascade,\n  status text not null default 'pending' check (status in ('pending','accepted','declined')),\n  created_at timestamptz not null default now(),\n  primary key (\"from\", \"to\"),\n  check (\"from\" <> \"to\")\n);\n\ncreate or replace view public.users_public as\n  select id, username, created_at from public.profiles;\ngrant select on public.users_public to anon, authenticated;\n\nalter table public.profiles enable row level security;\nalter table public.beats enable row level security;\nalter table public.lyrics enable row level security;\nalter table public.beat_shares enable row level security;\nalter table public.lyric_shares enable row level security;\nalter table public.friend_requests enable row level security;\n\ncreate policy \"profiles_select_own\" on public.profiles for select to authenticated using (id = auth.uid());\ncreate policy \"profiles_insert_own\" on public.profiles for insert to authenticated with check (id = auth.uid());\ncreate policy \"profiles_update_own\" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());\n\ncreate policy \"beats_select\" on public.beats for select to authenticated\n  using (owner = auth.uid() or exists(select 1 from public.beat_shares bs where bs.beat_id = beats.id and bs.shared_with = auth.uid()));\ncreate policy \"beats_insert_own\" on public.beats for insert to authenticated with check (owner = auth.uid());\ncreate policy \"beats_update_own\" on public.beats for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());\ncreate policy \"beats_delete_own\" on public.beats for delete to authenticated using (owner = auth.uid());\n\ncreate policy \"lyrics_select\" on public.lyrics for select to authenticated\n  using (owner = auth.uid() or exists(select 1 from public.lyric_shares ls where ls.lyric_id = lyrics.id and ls.shared_with = auth.uid()));\ncreate policy \"lyrics_insert_own\" on public.lyrics for insert to authenticated with check (owner = auth.uid());\ncreate policy \"lyrics_update_own\" on public.lyrics for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());\ncreate policy \"lyrics_delete_own\" on public.lyrics for delete to authenticated using (owner = auth.uid());\n\ncreate policy \"beat_shares_select\" on public.beat_shares for select to authenticated\n  using (shared_with = auth.uid() or shared_by = auth.uid());\ncreate policy \"beat_shares_insert\" on public.beat_shares for insert to authenticated\n  with check (shared_by = auth.uid() and exists(select 1 from public.beats b where b.id = beat_id and b.owner = auth.uid()));\ncreate policy \"beat_shares_delete\" on public.beat_shares for delete to authenticated\n  using (shared_with = auth.uid() or shared_by = auth.uid());\n\ncreate policy \"lyric_shares_select\" on public.lyric_shares for select to authenticated\n  using (shared_with = auth.uid() or shared_by = auth.uid());\ncreate policy \"lyric_shares_insert\" on public.lyric_shares for insert to authenticated\n  with check (shared_by = auth.uid() and exists(select 1 from public.lyrics l where l.id = lyric_id and l.owner = auth.uid()));\ncreate policy \"lyric_shares_delete\" on public.lyric_shares for delete to authenticated\n  using (shared_with = auth.uid() or shared_by = auth.uid());\n\ncreate policy \"fr_select\" on public.friend_requests for select to authenticated\n  using (\"from\" = auth.uid() or \"to\" = auth.uid());\ncreate policy \"fr_insert\" on public.friend_requests for insert to authenticated\n  with check (\"from\" = auth.uid() and \"to\" <> auth.uid());\ncreate policy \"fr_update\" on public.friend_requests for update to authenticated\n  using (\"to\" = auth.uid()) with check (\"to\" = auth.uid());\ncreate policy \"fr_delete\" on public.friend_requests for delete to authenticated\n  using (\"from\" = auth.uid() or \"to\" = auth.uid());\n\ncreate or replace function public.increment_time(delta bigint)\nreturns void language sql security definer as $$\n  update public.profiles set time_ms = coalesce(time_ms, 0) + delta where id = auth.uid();\n$$;\ngrant execute on function public.increment_time(bigint) to authenticated;\n\ncreate or replace function public.handle_new_user()\nreturns trigger language plpgsql security definer as $$\nbegin\n  insert into public.profiles (id, username)\n  values (new.id, new.raw_user_meta_data->>'username')\n  on conflict do nothing;\n  return new;\nend;\n$$;\ndrop trigger if exists on_auth_user_created on auth.users;\ncreate trigger on_auth_user_created\n  after insert on auth.users\n  for each row execute function public.handle_new_user();";

  const DEFAULTS = {
    bpm: 120,
    masterVol: 80,
    root: 'A',
    scale: 'Min Pent',
    volumes: { kick: 80, snare: 75, hh: 60, clap: 70, bass: 70, lead: 65 },
    muted: { kick: false, snare: false, hh: false, clap: false, bass: false, lead: false },
    pattern: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hh: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      bass: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1],
      lead: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0]
    }
  };

  const $ = function (id) { return document.getElementById(id); };

  const playBtn = $('playBtn');
  const stopBtn = $('stopBtn');
  const bpmSlider = $('bpmSlider');
  const bpmValue = $('bpmValue');
  const tapBtn = $('tapBtn');
  const rootSel = $('rootSel');
  const scaleSel = $('scaleSel');
  const masterVol = $('masterVol');
  const masterVolVal = $('masterVolVal');
  const randomBtn = $('randomBtn');
  const clearBtn = $('clearBtn');
  const exportBtn = $('exportBtn');
  const exportBars = $('exportBars');
  const beatSelect = $('beatSelect');
  const saveBeatBtn = $('saveBeatBtn');
  const loadBeatBtn = $('loadBeatBtn');
  const deleteBeatBtn = $('deleteBeatBtn');

  const lyricsArea = $('lyricsArea');
  const songTitle = $('songTitle');
  const songList = $('songList');
  const savedBadge = $('savedBadge');

  const setupScreen = $('setupScreen');
  const sbUrlInput = $('sbUrl');
  const sbKeyInput = $('sbKey');
  const setupErrorEl = $('setupError');
  const authScreen = $('authScreen');
  const mainEl = document.querySelector('main');
  const footerEl = document.querySelector('footer');
  const userbar = $('userbar');
  const userNameEl = $('userName');
  const userTimeEl = $('userTime');
  const authTabLogin = $('authTabLogin');
  const authTabSignup = $('authTabSignup');
  const loginForm = $('loginForm');
  const signupForm = $('signupForm');
  const authErrorEl = $('authError');
  const loginUser = $('loginUser');
  const loginPass = $('loginPass');
  const signupUser = $('signupUser');
  const signupPass = $('signupPass');
  const signupPass2 = $('signupPass2');

  const friendsList = $('friendsList');
  const incomingList = $('incomingList');
  const outgoingList = $('outgoingList');
  const searchInput = $('userSearch');
  const searchBtn = $('searchBtn');
  const searchResults = $('searchResults');
  const inboxBeatsEl = $('inboxBeats');
  const inboxLyricsEl = $('inboxLyrics');
  const refreshSocialBtn = $('refreshSocialBtn');

  let state = clone(DEFAULTS);
  let ac = null;
  let online = null;
  let isPlaying = false;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let leadIndex = 0;
  let taps = [];
  let beats = [];
  let songs = [];
  let currentSongId = null;
  let sb = null;
  let me = null;
  let myName = '';
  let timeMsBaseline = 0;
  let sessionSince = 0;
  let timeTimer = null;
  let persistTimer = null;
  let saveTimer = null;
  let songSaveTimer = null;
  let selectsPopulated = false;
  let studioWired = false;
  let friends = [];
  let friendUidSet = new Set();
  let pendingToSet = new Set();
  let pendingFromSet = new Set();
  let inboxBeats = [];
  let inboxLyrics = [];

  /* ===================== HELPERS ===================== */

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function hide(el) { el.setAttribute('hidden', ''); }
  function show(el) { el.removeAttribute('hidden'); }

  function loadConfig() {
    try { return JSON.parse(localStorage.getItem(LS_CFG)); } catch (e) { return null; }
  }
  function saveConfig(cfg) {
    try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch (e) {}
  }

  function stateKey() { return LS_STATE + '_' + (me ? me.id : 'guest'); }

  function loadStateFor(uid) {
    try {
      const raw = localStorage.getItem(LS_STATE + '_' + uid);
      if (!raw) return clone(DEFAULTS);
      const s = JSON.parse(raw);
      const merged = Object.assign(clone(DEFAULTS), s);
      merged.pattern = Object.assign(clone(DEFAULTS.pattern), s.pattern || {});
      for (const inst of INSTRUMENTS) {
        merged.volumes[inst.id] = (s.volumes && s.volumes[inst.id] != null) ? s.volumes[inst.id] : DEFAULTS.volumes[inst.id];
        merged.muted[inst.id] = (s.muted && s.muted[inst.id] != null) ? s.muted[inst.id] : false;
        if (!merged.pattern[inst.id] || merged.pattern[inst.id].length !== 16) merged.pattern[inst.id] = DEFAULTS.pattern[inst.id].slice();
      }
      return merged;
    } catch (e) { return clone(DEFAULTS); }
  }

  function saveState() {
    if (!me) return;
    try { localStorage.setItem(stateKey(), JSON.stringify(state)); } catch (e) {}
  }

  function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm ' + sec + 's';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }

  /* ===================== AUDIO ENGINE ===================== */

  function noteToMidi(name, octave) { return (octave + 1) * 12 + NOTES.indexOf(name); }
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function bassMidi() { return noteToMidi(state.root, 2); }
  function leadBaseMidi() { return noteToMidi(state.root, 3) + 12; }
  function leadSeqMidi() {
    const scale = SCALES[state.scale] || SCALES['Min Pent'];
    const m = scale[leadIndex % scale.length] + leadBaseMidi();
    leadIndex++;
    return m;
  }

  function makeNoise(actx) {
    if (actx.__noise) return actx.__noise;
    const len = Math.floor(actx.sampleRate);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    actx.__noise = buf;
    return buf;
  }

  function playKick(actx, t, dest) {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.3);
  }

  function playSnare(actx, t, dest) {
    const o = actx.createOscillator();
    const og = actx.createGain();
    o.type = 'triangle';
    o.frequency.value = 200;
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og); og.connect(dest);
    o.start(t); o.stop(t + 0.15);

    const s = actx.createBufferSource();
    s.buffer = makeNoise(actx);
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400;
    const ng = actx.createGain();
    ng.gain.setValueAtTime(0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    s.connect(hp); hp.connect(ng); ng.connect(dest);
    s.start(t); s.stop(t + 0.2);
  }

  function playHat(actx, t, dest, open) {
    const s = actx.createBufferSource();
    s.buffer = makeNoise(actx);
    const hp = actx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = open ? 6000 : 8000;
    const g = actx.createGain();
    const decay = open ? 0.35 : 0.06;
    g.gain.setValueAtTime(open ? 0.35 : 0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(hp); hp.connect(g); g.connect(dest);
    s.start(t); s.stop(t + decay + 0.05);
  }

  function playClap(actx, t, dest) {
    for (let i = 0; i < 3; i++) {
      const bt = t + i * 0.012;
      const s = actx.createBufferSource();
      s.buffer = makeNoise(actx);
      const bp = actx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.5;
      const g = actx.createGain();
      g.gain.setValueAtTime(0.5, bt);
      g.gain.exponentialRampToValueAtTime(0.001, bt + 0.03);
      s.connect(bp); bp.connect(g); g.connect(dest);
      s.start(bt); s.stop(bt + 0.05);
    }
    const s = actx.createBufferSource();
    s.buffer = makeNoise(actx);
    const bp = actx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1.5;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.6, t + 0.036);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(bp); bp.connect(g); g.connect(dest);
    s.start(t + 0.036); s.stop(t + 0.3);
  }

  function playBass(actx, t, dest) {
    const f = midiToFreq(bassMidi());
    const o = actx.createOscillator();
    const o2 = actx.createOscillator();
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.value = f; o2.frequency.value = f;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    o.connect(g); o2.connect(g); g.connect(lp); lp.connect(dest);
    o.start(t); o2.start(t); o.stop(t + 0.25); o2.stop(t + 0.25);
  }

  function playLead(actx, t, dest) {
    const f = midiToFreq(leadSeqMidi());
    const o = actx.createOscillator();
    const o2 = actx.createOscillator();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = f; o2.frequency.value = f * 2;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.22, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    const lp = actx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(dest);
    o.start(t); o2.start(t); o.stop(t + 0.26); o2.stop(t + 0.26);
  }

  function volumeFor(id) {
    if (state.muted[id]) return 0;
    return Math.pow(state.volumes[id] / 100, 1.4) * 0.85;
  }

  function createDestinations(actx) {
    const master = actx.createGain();
    master.gain.value = Math.pow(state.masterVol / 100, 1.4);
    const per = {};
    for (const inst of INSTRUMENTS) {
      const g = actx.createGain();
      g.gain.value = volumeFor(inst.id);
      g.connect(master);
      per[inst.id] = g;
    }
    return { master: master, per: per };
  }

  function scheduleStep(s, t, actx, dests) {
    for (const inst of INSTRUMENTS) {
      const v = state.pattern[inst.id][s];
      if (!v) continue;
      const dest = dests.per[inst.id];
      if (inst.id === 'kick') playKick(actx, t, dest);
      else if (inst.id === 'snare') playSnare(actx, t, dest);
      else if (inst.id === 'hh') playHat(actx, t, dest, v === 2);
      else if (inst.id === 'clap') playClap(actx, t, dest);
      else if (inst.id === 'bass') playBass(actx, t, dest);
      else if (inst.id === 'lead') playLead(actx, t, dest);
    }
  }

  function scheduler() {
    while (nextTime < ac.currentTime + 0.1) {
      scheduleStep(step, nextTime, ac, online);
      nextTime += 60 / state.bpm / 4;
      updatePlayhead(step);
      step = (step + 1) % 16;
    }
    timer = setTimeout(scheduler, 25);
  }

  function updatePlayhead(i) {
    document.querySelectorAll('.cell.playing').forEach(function (c) { c.classList.remove('playing'); });
    document.querySelectorAll('.colhead-step.playing').forEach(function (c) { c.classList.remove('playing'); });
    document.querySelectorAll('[data-step="' + i + '"]').forEach(function (c) { c.classList.add('playing'); });
  }

  async function play() {
    if (isPlaying) return;
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      online = createDestinations(ac);
      online.master.connect(ac.destination);
    }
    if (ac.state === 'suspended') await ac.resume();
    isPlaying = true;
    step = 0;
    leadIndex = 0;
    nextTime = ac.currentTime + 0.05;
    playBtn.innerHTML = '&#10074;&#10074; Pause';
    scheduler();
  }

  function stop() {
    isPlaying = false;
    if (timer) { clearTimeout(timer); timer = null; }
    playBtn.innerHTML = '&#9654; Play';
    document.querySelectorAll('.cell.playing').forEach(function (c) { c.classList.remove('playing'); });
    document.querySelectorAll('.colhead-step.playing').forEach(function (c) { c.classList.remove('playing'); });
    step = 0;
  }

  function encodeWAV(buffer, sr) {
    const n = buffer.length;
    const ab = new ArrayBuffer(44 + n * 2);
    const v = new DataView(ab);
    const ws = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, n * 2, true);
    const d = buffer.getChannelData(0);
    let o = 44;
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, d[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      o += 2;
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  async function exportWAV() {
    const bars = parseInt(exportBars.value, 10);
    const total = bars * 16;
    const sr = 44100;
    const dur = total * (60 / state.bpm / 4);
    const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const dests = createDestinations(off);
    dests.master.connect(off.destination);
    leadIndex = 0;
    for (let s = 0; s < total; s++) {
      scheduleStep(s, s * (60 / state.bpm / 4), off, dests);
    }
    const rendered = await off.startRendering();
    const blob = encodeWAV(rendered, sr);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mus$icmaker-beat.wav';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  /* ===================== GRID UI ===================== */

  function renderCell(id, i, el) {
    const v = state.pattern[id][i];
    el.classList.toggle('on', v > 0);
    el.classList.toggle('strong', v >= 2);
  }

  function renderGrid() {
    for (const inst of INSTRUMENTS) {
      const steps = document.querySelector('.row[data-inst="' + inst.id + '"] .steps');
      if (steps) steps.querySelectorAll('.cell').forEach(function (c, i) { renderCell(inst.id, i, c); });
    }
  }

  function toggleCell(id, i, el) {
    const inst = INSTRUMENTS.find(function (x) { return x.id === id; });
    state.pattern[id][i] = (state.pattern[id][i] + 1) % inst.max;
    renderCell(id, i, el);
    saveState();
  }

  function buildGrid() {
    const header = $('colHeaderSteps');
    header.innerHTML = '';
    for (let i = 0; i < 16; i++) {
      const d = document.createElement('div');
      d.className = 'colhead-step' + (i % 4 === 0 ? ' bar' : '');
      d.dataset.step = i;
      d.textContent = Math.floor(i / 4) + 1;
      header.appendChild(d);
    }

    const rows = $('gridRows');
    rows.innerHTML = '';
    for (const inst of INSTRUMENTS) {
      const row = document.createElement('div');
      row.className = 'row';
      row.dataset.inst = inst.id;

      const label = document.createElement('div');
      label.className = 'rowlabel';
      const name = document.createElement('span');
      name.className = 'iname';
      name.textContent = inst.name;
      const mute = document.createElement('button');
      mute.className = 'mute-btn' + (state.muted[inst.id] ? '' : ' on');
      mute.textContent = 'M';
      mute.title = 'Mute';
      mute.addEventListener('click', function () {
        state.muted[inst.id] = !state.muted[inst.id];
        mute.classList.toggle('on', !state.muted[inst.id]);
        row.classList.toggle('muted', state.muted[inst.id]);
        if (online) online.per[inst.id].gain.value = volumeFor(inst.id);
        saveState();
      });
      if (state.muted[inst.id]) row.classList.add('muted');
      const vol = document.createElement('input');
      vol.type = 'range';
      vol.min = 0; vol.max = 100;
      vol.value = state.volumes[inst.id];
      vol.title = inst.name + ' volume';
      vol.addEventListener('input', function () {
        state.volumes[inst.id] = parseInt(vol.value, 10);
        if (online) online.per[inst.id].gain.value = volumeFor(inst.id);
        saveState();
      });
      label.appendChild(name);
      label.appendChild(mute);
      label.appendChild(vol);

      const steps = document.createElement('div');
      steps.className = 'steps';
      for (let i = 0; i < 16; i++) {
        const c = document.createElement('button');
        c.className = 'cell';
        c.dataset.step = i;
        c.addEventListener('click', function () { toggleCell(inst.id, i, c); });
        steps.appendChild(c);
      }
      row.appendChild(label);
      row.appendChild(steps);
      rows.appendChild(row);
    }
    renderGrid();
  }

  function randomize() {
    const density = { kick: 0.28, snare: 0.2, hh: 0.5, clap: 0.12, bass: 0.3, lead: 0.25 };
    for (const inst of INSTRUMENTS) {
      for (let i = 0; i < 16; i++) {
        if (Math.random() < density[inst.id]) {
          state.pattern[inst.id][i] = (inst.id === 'hh' && Math.random() < 0.25) ? 2 : 1;
        } else {
          state.pattern[inst.id][i] = 0;
        }
      }
    }
    renderGrid();
    saveState();
  }

  function clearPattern() {
    for (const inst of INSTRUMENTS) {
      for (let i = 0; i < 16; i++) state.pattern[inst.id][i] = 0;
    }
    renderGrid();
    saveState();
  }

  function setBpm(b) {
    state.bpm = b;
    bpmSlider.value = b;
    bpmValue.textContent = b + ' BPM';
    saveState();
  }

  function populateStudioControls() {
    if (selectsPopulated) return;
    selectsPopulated = true;
    NOTES.forEach(function (n) {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      rootSel.appendChild(o);
    });
    Object.keys(SCALES).forEach(function (s) {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      scaleSel.appendChild(o);
    });
  }

  function applyControlsFromState() {
    bpmSlider.value = state.bpm;
    bpmValue.textContent = state.bpm + ' BPM';
    rootSel.value = state.root;
    scaleSel.value = state.scale;
    masterVol.value = state.masterVol;
    masterVolVal.textContent = state.masterVol;
  }

  function wireStudio() {
    if (studioWired) return;
    studioWired = true;

    playBtn.addEventListener('click', play);
    stopBtn.addEventListener('click', stop);
    bpmSlider.addEventListener('input', function () { setBpm(parseInt(bpmSlider.value, 10)); });
    rootSel.addEventListener('change', function () { state.root = rootSel.value; saveState(); });
    scaleSel.addEventListener('change', function () { state.scale = scaleSel.value; saveState(); });
    masterVol.addEventListener('input', function () {
      state.masterVol = parseInt(masterVol.value, 10);
      masterVolVal.textContent = state.masterVol;
      if (online) online.master.gain.value = Math.pow(state.masterVol / 100, 1.4);
      saveState();
    });
    tapBtn.addEventListener('click', function () {
      const now = performance.now();
      taps.push(now);
      if (taps.length > 1 && now - taps[taps.length - 2] > 2000) taps = [now];
      if (taps.length >= 2) {
        const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
        if (avg > 0) setBpm(Math.round(Math.max(60, Math.min(200, 60000 / avg))));
      }
    });
    randomBtn.addEventListener('click', randomize);
    clearBtn.addEventListener('click', function () {
      if (confirm('Clear the whole pattern?')) clearPattern();
    });
    exportBtn.addEventListener('click', async function () {
      if (!me) return;
      exportBtn.disabled = true;
      exportBtn.textContent = 'Rendering\u2026';
      try {
        await exportWAV();
      } catch (e) {
        alert('Export failed: ' + e.message);
      }
      exportBtn.textContent = 'Export WAV';
      exportBtn.disabled = false;
    });

    saveBeatBtn.addEventListener('click', saveBeatPrompt);
    loadBeatBtn.addEventListener('click', loadSelectedBeat);
    deleteBeatBtn.addEventListener('click', deleteSelectedBeat);
  }

  /* ===================== BEATS (cloud) ===================== */

  async function loadBeats() {
    if (!me) return;
    const { data, error } = await sb.from('beats').select('id,name,pattern,bpm,root,scale,updated_at')
      .eq('owner', me.id).order('updated_at', { ascending: false });
    if (error) { console.log('loadBeats', error.message); beats = []; repopulateBeatSelect(); return; }
    beats = data.map(function (b) {
      return { id: b.id, name: b.name, pattern: b.pattern, bpm: b.bpm, root: b.root, scale: b.scale, savedAt: new Date(b.updated_at).getTime() };
    });
    repopulateBeatSelect();
  }

  function repopulateBeatSelect() {
    beatSelect.innerHTML = '';
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = '\u2014 saved beats \u2014';
    beatSelect.appendChild(ph);
    beats.forEach(function (b) {
      const o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name;
      beatSelect.appendChild(o);
    });
    beatSelect.value = '';
  }

  async function saveBeatPrompt() {
    if (!me) return;
    const name = prompt('Name this beat:', 'My Beat');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    const existing = beats.find(function (b) { return b.name === trimmed; });
    const payload = {
      name: trimmed,
      pattern: state.pattern,
      bpm: state.bpm,
      root: state.root,
      scale: state.scale,
      updated_at: new Date().toISOString()
    };
    if (existing) {
      const { error } = await sb.from('beats').update(payload).eq('id', existing.id).eq('owner', me.id);
      if (error) { alert('Save failed: ' + error.message); return; }
    } else {
      const ins = Object.assign({ owner: me.id }, payload);
      const { error } = await sb.from('beats').insert(ins);
      if (error) { alert('Save failed: ' + error.message); return; }
    }
    await loadBeats();
    const saved = beats.find(function (b) { return b.name === trimmed; });
    if (saved) beatSelect.value = String(saved.id);
  }

  function loadSelectedBeat() {
    if (!me) return;
    const id = parseInt(beatSelect.value, 10);
    if (!id) return;
    const b = beats.find(function (x) { return x.id === id; });
    if (!b) return;
    state.pattern = clone(b.pattern);
    state.bpm = b.bpm;
    state.root = b.root;
    state.scale = b.scale;
    renderGrid();
    applyControlsFromState();
    saveState();
  }

  async function deleteSelectedBeat() {
    if (!me) return;
    const id = parseInt(beatSelect.value, 10);
    if (!id) return;
    const b = beats.find(function (x) { return x.id === id; });
    if (!b) return;
    if (!confirm('Delete beat "' + b.name + '"?')) return;
    const { error } = await sb.from('beats').delete().eq('id', id).eq('owner', me.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    await loadBeats();
  }

  /* ===================== LYRICS (cloud) ===================== */

  async function loadSongs() {
    if (!me) return;
    const { data, error } = await sb.from('lyrics').select('id,title,text,updated_at')
      .eq('owner', me.id).order('updated_at', { ascending: false });
    if (error) { console.log('loadSongs', error.message); songs = []; return; }
    songs = data.map(function (s) { return { id: s.id, title: s.title, text: s.text }; });
    if (!songs.length) {
      const { data: ins, error: ie } = await sb.from('lyrics').insert({ owner: me.id, title: 'My First Song', text: '' }).select().single();
      if (!ie && ins) songs = [{ id: ins.id, title: ins.title, text: ins.text }];
    }
    const lastId = parseInt(localStorage.getItem('mus$icmaker_lastsong_' + me.id) || '0', 10);
    currentSongId = songs.some(function (s) { return s.id === lastId; }) ? lastId : (songs[0] ? songs[0].id : null);
    refreshLyricsUI();
  }

  function saveSongsLocal() {
    if (!me) return;
    try { localStorage.setItem('mus$icmaker_lastsong_' + me.id, String(currentSongId)); } catch (e) {}
  }

  function setCurrentSong(id) {
    currentSongId = id;
    saveSongsLocal();
  }

  function currentSong() {
    return songs.find(function (s) { return s.id === currentSongId; });
  }

  function flashSaved() {
    savedBadge.classList.add('show');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { savedBadge.classList.remove('show'); }, 1600);
  }

  function updateStats() {
    const text = lyricsArea.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const lines = text ? text.split('\n').length : 1;
    $('lyrStats').textContent = words + ' words \u00B7 ' + chars + ' characters \u00B7 ' + lines + ' lines';
  }

  function renderSongList() {
    songList.innerHTML = '';
    songs.forEach(function (song) {
      const li = document.createElement('li');
      if (song.id === currentSongId) li.classList.add('active');
      const span = document.createElement('span');
      span.className = 'song-title-mini';
      span.textContent = song.title || 'Untitled';
      span.title = song.title || 'Untitled';
      const del = document.createElement('button');
      del.className = 'song-del';
      del.textContent = '\u00D7';
      del.title = 'Delete';
      del.addEventListener('click', function (e) {
        e.stopPropagation();
        deleteSong(song);
      });
      li.appendChild(span);
      li.appendChild(del);
      li.addEventListener('click', function () {
        setCurrentSong(song.id);
        loadSongIntoEditor();
        renderSongList();
      });
      songList.appendChild(li);
    });
  }

  function loadSongIntoEditor() {
    const song = currentSong();
    if (!song) return;
    songTitle.value = song.title || '';
    lyricsArea.value = song.text || '';
    updateStats();
  }

  function refreshLyricsUI() {
    renderSongList();
    loadSongIntoEditor();
  }

  function persistCurrent() {
    const song = currentSong();
    if (!song) return;
    song.title = songTitle.value || 'Untitled';
    song.text = lyricsArea.value;
    flashSaved();
    clearTimeout(songSaveTimer);
    songSaveTimer = setTimeout(async function () {
      if (!me) return;
      const { error } = await sb.from('lyrics').update({ title: song.title, text: song.text, updated_at: new Date().toISOString() })
        .eq('id', song.id).eq('owner', me.id);
      if (error) console.log('lyrics save', error.message);
      renderSongList();
    }, 500);
  }

  async function newSong() {
    if (!me) return;
    const title = 'Song ' + (songs.length + 1);
    const { data, error } = await sb.from('lyrics').insert({ owner: me.id, title: title, text: '' }).select().single();
    if (error) { alert('Could not create song: ' + error.message); return; }
    songs.unshift({ id: data.id, title: data.title, text: data.text });
    setCurrentSong(data.id);
    refreshLyricsUI();
    songTitle.focus();
  }

  async function deleteSong(song) {
    if (!me) return;
    if (!confirm('Delete "' + (song.title || 'Untitled') + '"?')) return;
    const { error } = await sb.from('lyrics').delete().eq('id', song.id).eq('owner', me.id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    songs = songs.filter(function (s) { return s.id !== song.id; });
    if (!songs.length) {
      const ins = await sb.from('lyrics').insert({ owner: me.id, title: 'My First Song', text: '' }).select().single();
      if (!ins.error && ins.data) songs = [{ id: ins.data.id, title: ins.data.title, text: ins.data.text }];
    }
    if (currentSongId === song.id) setCurrentSong(songs[0] ? songs[0].id : null);
    refreshLyricsUI();
  }

  function initLyrics() {
    document.querySelectorAll('.section-buttons .btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const label = btn.dataset.section;
        const start = lyricsArea.selectionStart;
        const end = lyricsArea.selectionEnd;
        const before = lyricsArea.value.slice(0, start);
        const after = lyricsArea.value.slice(end);
        const insert = '\n[' + label + ']\n\n';
        lyricsArea.value = before + insert + after;
        const caret = start + insert.length;
        lyricsArea.focus();
        lyricsArea.setSelectionRange(caret, caret);
        updateStats();
        persistCurrent();
      });
    });

    $('newSongBtn').addEventListener('click', newSong);

    songTitle.addEventListener('input', function () { persistCurrent(); });
    lyricsArea.addEventListener('input', function () { updateStats(); persistCurrent(); });

    $('renameBtn').addEventListener('click', function () {
      const song = currentSong();
      if (!song) return;
      const name = prompt('Rename song:', song.title || 'Untitled');
      if (name && name.trim()) {
        songTitle.value = name.trim();
        persistCurrent();
      }
    });

    $('deleteBtn').addEventListener('click', function () {
      const song = currentSong();
      if (song) deleteSong(song);
    });

    $('exportTxtBtn').addEventListener('click', function () {
      const song = currentSong();
      if (!song) return;
      const body = song.title + '\n\n' + (song.text || '');
      const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (song.title || 'song').replace(/[^a-z0-9 _-]+/gi, '') + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    });
  }

  /* ===================== AUTH + TIME (Supabase) ===================== */

  function getTotalMs() { return timeMsBaseline + (Date.now() - sessionSince); }
  function updateTimeDisplay() { userTimeEl.textContent = 'Time on site: ' + formatTime(getTotalMs()); }

  async function persistElapsed() {
    if (!me) return;
    const delta = Date.now() - sessionSince;
    if (delta < 500) return;
    sessionSince = Date.now();
    timeMsBaseline += delta;
    updateTimeDisplay();
    try { await sb.rpc('increment_time', { delta: delta }); } catch (e) {}
  }

  function startTimers() {
    updateTimeDisplay();
    clearInterval(timeTimer);
    clearInterval(persistTimer);
    timeTimer = setInterval(updateTimeDisplay, 1000);
    persistTimer = setInterval(persistElapsed, 30000);
  }

  function stopTimers() {
    clearInterval(timeTimer);
    clearInterval(persistTimer);
    timeTimer = null;
    persistTimer = null;
  }

  function setAuthError(msg) { authErrorEl.textContent = msg; }
  function setSetupError(msg) { setupErrorEl.textContent = msg; }

  function showSetup() {
    hide(authScreen);
    hide(mainEl);
    hide(footerEl);
    hide(userbar);
    show(setupScreen);
    if ($('setupSql')) $('setupSql').textContent = SETUP_SQL;
  }

  function showAuth() {
    hide(setupScreen);
    hide(mainEl);
    hide(footerEl);
    hide(userbar);
    show(authScreen);
    loginForm.reset();
    signupForm.reset();
    setAuthError('');
  }

  function showApp() {
    hide(setupScreen);
    hide(authScreen);
    show(mainEl);
    show(footerEl);
    show(userbar);
  }

  function fakeEmail(username) { return username.toLowerCase() + '@musicmaker.app'; }

  async function doSignup() {
    const n = signupUser.value.trim();
    const p = signupPass.value;
    const p2 = signupPass2.value;
    if (!/^[A-Za-z0-9_]{3,20}$/.test(n)) { setAuthError('Username must be 3-20 characters: letters, numbers, or underscores.'); return; }
    if (p.length < 4) { setAuthError('Password must be at least 4 characters.'); return; }
    if (p !== p2) { setAuthError('Passwords do not match.'); return; }
    const { data: existing, error: dupErr } = await sb.from('users_public').select('id').ilike('username', n).limit(1);
    if (dupErr) { setAuthError('DB check failed: ' + dupErr.message); return; }
    if (existing && existing.length) { setAuthError('That username is already taken.'); return; }
    const { data, error } = await sb.auth.signUp({ email: fakeEmail(n), password: p, options: { data: { username: n } } });
    if (error) { setAuthError(error.message); return; }
    if (!data.session) {
      setAuthError('Could not log in. In your Supabase project, turn OFF "Confirm email" (Authentication -> Providers -> Email), then try again.');
      return;
    }
    await onAuthed(data.user);
  }

  async function doLogin() {
    const n = loginUser.value.trim();
    const p = loginPass.value;
    if (!n || !p) { setAuthError('Enter your username and password.'); return; }
    const { data, error } = await sb.auth.signInWithPassword({ email: fakeEmail(n), password: p });
    if (error) { setAuthError(error.message); return; }
    await onAuthed(data.user);
  }

  function wireAuthForms() {
    authTabLogin.addEventListener('click', function () {
      authTabLogin.classList.add('active'); authTabSignup.classList.remove('active');
      loginForm.hidden = false; signupForm.hidden = true; setAuthError('');
    });
    authTabSignup.addEventListener('click', function () {
      authTabSignup.classList.add('active'); authTabLogin.classList.remove('active');
      loginForm.hidden = true; signupForm.hidden = false; setAuthError('');
    });
    loginForm.addEventListener('submit', function (e) { e.preventDefault(); doLogin(); });
    signupForm.addEventListener('submit', function (e) { e.preventDefault(); doSignup(); });
    $('logoutBtn').addEventListener('click', logout);
  }

  async function onAuthed(user) {
    me = user;
    let prof = null;
    try {
      const r = await sb.from('profiles').select('username,time_ms').eq('id', me.id).single();
      prof = r.data;
    } catch (e) {}
    myName = (prof && prof.username) || (user.user_metadata && user.user_metadata.username) || 'me';
    timeMsBaseline = (prof && prof.time_ms) ? prof.time_ms : 0;
    sessionSince = Date.now();
    userNameEl.textContent = myName;

    state = loadStateFor(me.id);
    buildGrid();
    applyControlsFromState();

    showApp();
    startTimers();

    await refreshAll();
    goTab('studio');
  }

  async function refreshAll() {
    await Promise.all([loadBeats(), loadSongs(), loadFriendsAndRequests(), loadInbox()]);
    renderSocial();
  }

  function goTab(name) {
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    const btn = document.getElementById('tabBtn' + name.charAt(0).toUpperCase() + name.slice(1));
    const tab = document.getElementById('tab-' + name);
    if (btn) btn.classList.add('active');
    if (tab) tab.classList.add('active');
    if (name === 'social' && me) refreshAll();
  }

  async function logout() {
    await persistElapsed();
    stop();
    try { await sb.auth.signOut(); } catch (e) {}
    resetToAuth();
  }

  function resetToAuth() {
    stop();
    stopTimers();
    me = null;
    beats = [];
    songs = [];
    currentSongId = null;
    friends = [];
    friendUidSet = new Set();
    pendingToSet = new Set();
    pendingFromSet = new Set();
    inboxBeats = [];
    inboxLyrics = [];
    repopulateBeatSelect();
    if (songList) songList.innerHTML = '';
    if (lyricsArea) lyricsArea.value = '';
    if (songTitle) songTitle.value = '';
    if ( $('lyrStats') ) $('lyrStats').textContent = '0 words \u00B7 0 characters \u00B7 1 line';
    ['friendsList', 'incomingList', 'outgoingList', 'searchResults', 'inboxBeats', 'inboxLyrics'].forEach(function (id) {
      const el = $(id);
      if (el) el.innerHTML = '<div class="empty">Sign in to see.</div>';
    });
    showAuth();
  }

  /* ===================== SOCIAL ===================== */

  async function fetchUsernames(ids) {
    if (!ids.length) return [];
    const { data, error } = await sb.from('users_public').select('id,username').in('id', ids);
    if (error) { console.log('fetchUsernames', error.message); return []; }
    return data || [];
  }

  async function loadFriendsAndRequests() {
    if (!me) return;
    const uid = me.id;
    const { data: acc } = await sb.from('friend_requests').select('from,to,status')
      .eq('status', 'accepted').or('from.eq.' + uid + ',to.eq.' + uid);
    const fids = new Set();
    (acc || []).forEach(function (r) { fids.add(r.from === uid ? r.to : r.from); });
    friendUidSet = fids;

    const { data: inc } = await sb.from('friend_requests').select('from,created_at')
      .eq('to', uid).eq('status', 'pending').order('created_at', { ascending: false });
    pendingFromSet = new Set((inc || []).map(function (r) { return r.from; }));

    const { data: out } = await sb.from('friend_requests').select('to')
      .eq('from', uid).eq('status', 'pending');
    pendingToSet = new Set((out || []).map(function (r) { return r.to; }));

    friends = (await fetchUsernames([...fids])).map(function (u) { return { id: u.id, username: u.username }; });

    incoming = await fetchUsernames([...pendingFromSet]);
    outgoing = await fetchUsernames([...pendingToSet]);
  }

  let incoming = [];
  let outgoing = [];

  function userRow(u, actions, extra) {
    const row = document.createElement('div');
    row.className = 'user-row';
    const name = document.createElement('span');
    name.className = 'user-row-name';
    name.textContent = u.username;
    if (extra) {
      const ex = document.createElement('span');
      ex.className = 'from';
      ex.textContent = extra;
      const wrap = document.createElement('div');
      wrap.appendChild(name);
      wrap.appendChild(ex);
      row.appendChild(wrap);
    } else {
      row.appendChild(name);
    }
    const btns = document.createElement('span');
    btns.className = 'row-btns';
    actions.forEach(function (a) {
      const b = document.createElement('button');
      b.className = 'btn mini' + (a.cls ? ' ' + a.cls : '');
      b.textContent = a.label;
      b.disabled = !!a.disabled;
      if (a.disabled) b.classList.add('disabled');
      b.addEventListener('click', a.fn);
      btns.appendChild(b);
    });
    row.appendChild(btns);
    return row;
  }

  function renderSocial() {
    friendsList.innerHTML = '';
    if (!friends.length) friendsList.innerHTML = '<div class="empty">No friends yet. Search for users to add.</div>';
    friends.forEach(function (f) {
      friendsList.appendChild(userRow(f, [
        { label: 'Send beat', cls: 'accent', fn: function () { sendBeatPicker(f); } },
        { label: 'Send lyrics', cls: 'accent', fn: function () { sendLyricsPicker(f); } }
      ]));
    });

    incomingList.innerHTML = '';
    if (!incoming.length) incomingList.innerHTML = '<div class="empty">No pending requests.</div>';
    incoming.forEach(function (u) {
      incomingList.appendChild(userRow(u, [
        { label: 'Accept', cls: 'accent', fn: function () { acceptRequest(u.id); } },
        { label: 'Decline', fn: function () { declineRequest(u.id); } }
      ]));
    });

    outgoingList.innerHTML = '';
    if (!outgoing.length) outgoingList.innerHTML = '<div class="empty">No outgoing requests.</div>';
    outgoing.forEach(function (u) {
      outgoingList.appendChild(userRow(u, [
        { label: 'Cancel', fn: function () { cancelRequest(u.id); } }
      ]));
    });

    renderInbox();
  }

  async function sendRequest(to) {
    const { error } = await sb.from('friend_requests').insert({ from: me.id, to: to, status: 'pending' });
    if (error) {
      if (error.code === '23505') { alert('Already requested or friends.'); }
      else { alert('Could not send request: ' + error.message); }
      return;
    }
    await loadFriendsAndRequests();
    renderSocial();
    searchUsers(searchInput.value.trim());
  }

  async function acceptRequest(from) {
    const { error } = await sb.from('friend_requests').update({ status: 'accepted' })
      .eq('from', from).eq('to', me.id);
    if (error) { alert('Could not accept: ' + error.message); return; }
    await loadFriendsAndRequests();
    renderSocial();
    searchUsers(searchInput.value.trim());
  }

  async function declineRequest(from) {
    const { error } = await sb.from('friend_requests').delete()
      .eq('from', from).eq('to', me.id);
    if (error) { alert('Could not decline: ' + error.message); return; }
    await loadFriendsAndRequests();
    renderSocial();
    searchUsers(searchInput.value.trim());
  }

  async function cancelRequest(to) {
    const { error } = await sb.from('friend_requests').delete()
      .eq('from', me.id).eq('to', to);
    if (error) { alert('Could not cancel: ' + error.message); return; }
    await loadFriendsAndRequests();
    renderSocial();
  }

  async function searchUsers(q) {
    if (!q) { searchResults.innerHTML = '<div class="empty">Type a username to search.</div>'; return; }
    const { data, error } = await sb.from('users_public').select('id,username')
      .ilike('username', '%' + q + '%').neq('id', me.id).limit(30);
    if (error) { searchResults.innerHTML = '<div class="empty">Search failed.</div>'; return; }
    if (!data.length) { searchResults.innerHTML = '<div class="empty">No users found.</div>'; return; }
    searchResults.innerHTML = '';
    data.forEach(function (u) {
      let actions;
      if (friendUidSet.has(u.id)) {
        actions = [{ label: 'Friend', disabled: true }];
      } else if (pendingToSet.has(u.id)) {
        actions = [{ label: 'Requested', disabled: true }];
      } else if (pendingFromSet.has(u.id)) {
        actions = [{ label: 'Accept', cls: 'accent', fn: function () { acceptRequest(u.id); } }];
      } else {
        actions = [{ label: 'Add friend', cls: 'accent', fn: function () { sendRequest(u.id); } }];
      }
      searchResults.appendChild(userRow(u, actions));
    });
  }

  function openPicker(title, options, onPick) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const card = document.createElement('div');
    card.className = 'modal-card';
    const h = document.createElement('div');
    h.className = 'modal-title';
    h.textContent = title;
    card.appendChild(h);
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nothing to share yet.';
      card.appendChild(empty);
    }
    options.forEach(function (opt) {
      const b = document.createElement('button');
      b.className = 'btn modal-opt';
      b.textContent = opt.label;
      b.addEventListener('click', function () { overlay.remove(); onPick(opt.value); });
      card.appendChild(b);
    });
    const cancel = document.createElement('button');
    cancel.className = 'btn small';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', function () { overlay.remove(); });
    card.appendChild(cancel);
    overlay.appendChild(card);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function sendBeatPicker(friend) {
    const opts = beats.map(function (b) { return { value: b.id, label: b.name }; });
    openPicker('Send a beat to ' + friend.username, opts, async function (beatId) {
      const { error } = await sb.from('beat_shares').insert({ beat_id: beatId, shared_with: friend.id, shared_by: me.id });
      if (error) {
        if (error.code === '23505') alert('Already shared that beat.');
        else alert('Share failed: ' + error.message);
        return;
      }
      alert('Beat sent to ' + friend.username + '!');
    });
  }

  function sendLyricsPicker(friend) {
    const opts = songs.map(function (s) { return { value: s.id, label: s.title || 'Untitled' }; });
    openPicker('Send lyrics to ' + friend.username, opts, async function (lyricId) {
      const { error } = await sb.from('lyric_shares').insert({ lyric_id: lyricId, shared_with: friend.id, shared_by: me.id });
      if (error) {
        if (error.code === '23505') alert('Already shared those lyrics.');
        else alert('Share failed: ' + error.message);
        return;
      }
      alert('Lyrics sent to ' + friend.username + '!');
    });
  }

  async function loadInbox() {
    if (!me) return;
    const uid = me.id;

    inboxBeats = [];
    const { data: bs } = await sb.from('beat_shares').select('beat_id,shared_by,created_at')
      .eq('shared_with', uid).order('created_at', { ascending: false });
    if (bs && bs.length) {
      const beatIds = [...new Set(bs.map(function (r) { return r.beat_id; }))];
      const sharerIds = [...new Set(bs.map(function (r) { return r.shared_by; }))];
      const [br, ur] = await Promise.all([
        sb.from('beats').select('id,name,pattern,bpm,root,scale').in('id', beatIds),
        sb.from('users_public').select('id,username').in('id', sharerIds)
      ]);
      const beatMap = new Map((br.data || []).map(function (b) { return [b.id, b]; }));
      const nameMap = new Map((ur.data || []).map(function (u) { return [u.id, u.username]; }));
      bs.forEach(function (r) {
        const b = beatMap.get(r.beat_id);
        if (b) inboxBeats.push({ id: b.id, name: b.name, pattern: b.pattern, bpm: b.bpm, root: b.root, scale: b.scale, fromName: nameMap.get(r.shared_by) || 'user' });
      });
    }

    inboxLyrics = [];
    const { data: ls } = await sb.from('lyric_shares').select('lyric_id,shared_by,created_at')
      .eq('shared_with', uid).order('created_at', { ascending: false });
    if (ls && ls.length) {
      const lyricIds = [...new Set(ls.map(function (r) { return r.lyric_id; }))];
      const sharerIds = [...new Set(ls.map(function (r) { return r.shared_by; }))];
      const [lr, ur] = await Promise.all([
        sb.from('lyrics').select('id,title,text').in('id', lyricIds),
        sb.from('users_public').select('id,username').in('id', sharerIds)
      ]);
      const lyricMap = new Map((lr.data || []).map(function (l) { return [l.id, l]; }));
      const nameMap = new Map((ur.data || []).map(function (u) { return [u.id, u.username]; }));
      ls.forEach(function (r) {
        const l = lyricMap.get(r.lyric_id);
        if (l) inboxLyrics.push({ id: l.id, title: l.title, text: l.text, fromName: nameMap.get(r.shared_by) || 'user' });
      });
    }
  }

  function renderInbox() {
    inboxBeatsEl.innerHTML = '';
    if (!inboxBeats.length) inboxBeatsEl.innerHTML = '<div class="empty">No beats shared with you.</div>';
    inboxBeats.forEach(function (b) {
      inboxBeatsEl.appendChild(inboxRow(b.name, 'from ' + b.fromName, [
        { label: 'Load', cls: 'accent', fn: function () { loadBeatToStudio(b); } },
        { label: 'Save copy', fn: function () { copyBeatToMine(b); } }
      ]));
    });

    inboxLyricsEl.innerHTML = '';
    if (!inboxLyrics.length) inboxLyricsEl.innerHTML = '<div class="empty">No lyrics shared with you.</div>';
    inboxLyrics.forEach(function (l) {
      inboxLyricsEl.appendChild(inboxRow(l.title || 'Untitled', 'from ' + l.fromName, [
        { label: 'Copy to my songs', cls: 'accent', fn: function () { copyLyricToMine(l); } }
      ]));
    });
  }

  function inboxRow(title, extra, actions) {
    const row = document.createElement('div');
    row.className = 'inbox-row';
    const wrap = document.createElement('div');
    const t = document.createElement('div');
    t.className = 'user-row-name';
    t.textContent = title;
    const e = document.createElement('div');
    e.className = 'from';
    e.textContent = extra;
    wrap.appendChild(t);
    wrap.appendChild(e);
    row.appendChild(wrap);
    const btns = document.createElement('span');
    btns.className = 'row-btns';
    actions.forEach(function (a) {
      const b = document.createElement('button');
      b.className = 'btn mini' + (a.cls ? ' ' + a.cls : '');
      b.textContent = a.label;
      b.addEventListener('click', a.fn);
      btns.appendChild(b);
    });
    row.appendChild(btns);
    return row;
  }

  function loadBeatToStudio(b) {
    state.pattern = clone(b.pattern);
    state.bpm = b.bpm;
    state.root = b.root;
    state.scale = b.scale;
    renderGrid();
    applyControlsFromState();
    saveState();
    goTab('studio');
  }

  async function copyBeatToMine(b) {
    if (!me) return;
    const { data, error } = await sb.from('beats').insert({
      owner: me.id, name: (b.name || 'Beat') + ' (copy)',
      pattern: b.pattern, bpm: b.bpm, root: b.root, scale: b.scale
    }).select().single();
    if (error) { alert('Copy failed: ' + error.message); return; }
    await loadBeats();
    alert('Saved to your beats.');
  }

  async function copyLyricToMine(l) {
    if (!me) return;
    const { data, error } = await sb.from('lyrics').insert({
      owner: me.id, title: (l.title || 'Untitled') + ' (copy)', text: l.text || ''
    }).select().single();
    if (error) { alert('Copy failed: ' + error.message); return; }
    songs.unshift({ id: data.id, title: data.title, text: data.text });
    setCurrentSong(data.id);
    refreshLyricsUI();
    alert('Added to your songs.');
  }

  function initSocial() {
    searchBtn.addEventListener('click', function () { searchUsers(searchInput.value.trim()); });
    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') searchUsers(searchInput.value.trim()); });
    refreshSocialBtn.addEventListener('click', async function () {
      refreshSocialBtn.disabled = true;
      await refreshAll();
      refreshSocialBtn.disabled = false;
    });
  }

  /* ===================== TABS + KEYBOARD ===================== */

  function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { goTab(btn.dataset.tab); });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === 'Space') {
      const tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
      if (!me) return;
      e.preventDefault();
      if (isPlaying) stop(); else play();
    }
  });

  window.addEventListener('beforeunload', function () {
    saveState();
    if (me) persistCurrent();
    if (me) persistElapsed();
  });

  /* ===================== BOOT ===================== */

  function boot() {
    populateStudioControls();
    wireStudio();
    wireAuthForms();
    initLyrics();
    initSocial();
    initTabs();

    const setupSqlEl = $('setupSql');
    if (setupSqlEl) setupSqlEl.textContent = SETUP_SQL;

    $('saveCfgBtn').addEventListener('click', function () {
      let url = sbUrlInput.value.trim();
      const key = sbKeyInput.value.trim();
      if (!url || !key) { setSetupError('Enter both your Project URL and anon (publishable) key.'); return; }
      if (!/^https?:\/\//.test(url)) { setSetupError('Project URL should start with https://'); return; }
      try { url = new URL(url).origin; } catch (e) {
        setSetupError('Project URL is not valid. It looks like https://xxxxx.supabase.co');
        return;
      }
      if (!/\.supabase\.co$/.test(url)) {
        setSetupError('That URL does not look like a Supabase Project URL (it should end in .supabase.co).');
        return;
      }
      if (key.length < 20) {
        setSetupError('That key looks too short. Copy the full anon/publishable key.');
        return;
      }
      saveConfig({ url: url, anonKey: key });
      location.reload();
    });

    $('reconfigureBtn').addEventListener('click', function () {
      if (confirm('Clear the saved Supabase keys and re-enter them?')) {
        try { localStorage.removeItem(LS_CFG); } catch (e) {}
        location.reload();
      }
    });

    const cfg = loadConfig();
    if (!cfg || !cfg.url || !cfg.anonKey || !window.supabase) { showSetup(); return; }

    try {
      sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    } catch (e) {
      setSetupError('Could not create Supabase client: ' + e.message);
      showSetup();
      return;
    }

    hide(setupScreen);
    (async function () {
      try {
        const { data, error } = await sb.auth.getSession();
        if (error) throw error;
        if (data && data.session) { await onAuthed(data.session.user); }
        else { showAuth(); }
      } catch (e) {
        setSetupError('Could not connect to Supabase. Check your URL and anon key. (' + (e.message || e) + ')');
        showSetup();
      }
    })();

    sb.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') resetToAuth();
    });
  }

  boot();
})();