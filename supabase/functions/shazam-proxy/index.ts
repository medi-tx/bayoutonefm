// Supabase Edge Function: shazam-proxy
//
// Purpose: "Live Listen" song identification for bayoutonefm.
//
// The browser records a few seconds of audio, computes a Shazam audio fingerprint
// locally (shazamio-core WASM — audio never leaves the user's machine), then POSTs the
// tiny signature object to this function. This function forwards the signature to
// Shazam's own discovery API (which blocks direct browser calls via CORS) and returns
// the matched track info as a normalized "hit".
//
// There is no API key to upload and no per-user quota to police: Shazam's v5 discovery
// endpoint is public and keyless (that's what the mobile apps use). To be a good citizen
// this endpoint is still auth-gated the same way as spotify-token, and Shazam itself
// rate-limits with a retryms value on empty matches.
//
// Deploy:
//   supabase functions deploy shazam-proxy

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SHAM_URL =
  'https://amp.shazam.com/discovery/v5/{lang}/{region}/{device}/-/tag/{u1}/{u2}?sync=true&webv3=true&sampling=true&connected=&shazamapiversion=v3&sharehub=true&hubv5minorversion=v5.1&hidelb=true&video=v3';

function randUuidUpper() {
  return crypto.randomUUID().toUpperCase();
}

function parseSongMeta(track) {
  // Pull Album / Release / Label / writers out of the SONG section's metadata[]
  // (Shazam returns these as { title, text } pairs like "Released", "Album", "Label").
  const out = { album: '', year: '', recordLabel: '', producer: '', songwriters: '' };
  const sections = Array.isArray(track.sections) ? track.sections : [];
  for (const sec of sections) {
    if (sec && sec.type !== 'SONG') continue;
    const meta = Array.isArray(sec.metadata) ? sec.metadata : [];
    for (const m of meta) {
      const key = String(m.title).toLowerCase();
      const val = String(m.text).trim();
      if ((key === 'album' || key === 'albumname') && !out.album) out.album = val;
      else if ((key === 'released' || key === 'release date' || key === 'released date') && !out.year) {
        out.year = (val.match(/\d{4}/) || [])[0] || '';
      } else if (['label', 'recordlabel', 'copyright'].includes(key) && !out.recordLabel) out.recordLabel = val;
      else if ((key === 'produced by' || key === 'producer') && !out.producer) out.producer = val;
      else if (key.includes('writer') && !out.songwriters) out.songwriters = val;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sig = body?.signature;
  if (!sig || !sig.uri) {
    return new Response(JSON.stringify({ error: 'missing_signature' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const samplems = Number(sig.samplems) || 8000;
  const lang = String(sig.lang || 'en-US');
  const region = String(sig.region || 'US');
  const timezone = String(sig.timezone || 'UTC');

  const url = SHAM_URL
    .replace('{lang}', lang)
    .replace('{region}', region)
    .replace('{device}', 'iphone')
    .replace('{u1}', randUuidUpper())
    .replace('{u2}', randUuidUpper());

  const payload = {
    timezone,
    signature: { uri: sig.uri, samplems },
    timestamp: Date.now(),
    context: {},
    geolocation: {},
  };

  let data;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shazam-Platform': 'IPHONE',
        'X-Shazam-AppVersion': '14.1.0',
        'Accept': '*/*',
        'Accept-Language': lang,
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        'User-Agent': 'Shazam/3685 CFNetwork/1197 Darwin/20.0.0',
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error('shazam_http_' + resp.status);
    data = await resp.json();
  } catch (e) {
    console.error('shazam fetch failed', e);
    return new Response(JSON.stringify({ error: 'shazam_unreachable' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const track = data && data.track;
  if (!track) {
    const retryms = Number(data && data.retryms) || 12000;
    return new Response(
      JSON.stringify({ matches: (data && data.matches) || [], tagid: data && data.tagid, retryms, hit: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const meta = parseSongMeta(track);
  const images = (track.images || {});
  const coverArt = images.coverarthq || images.coverart || '';

  // Pull a Spotify / Apple Music / Deezer link out of hub.providers when present.
  let spotifyUrl = '';
  let appleUrl = '';
  const hub = track.hub || {};
  const providers = Array.isArray(hub.providers) ? hub.providers : [];
  for (const p of providers) {
    const pType = String(p.type || '').toUpperCase();
    const options = Array.isArray(p.options) ? p.options : [];
    for (const opt of options) {
      const actions = Array.isArray(opt.actions) ? opt.actions : [];
      for (const a of actions) {
        const uri = String(a.uri || '');
        if (pType === 'SPOTIFY' && uri.startsWith('https://open.spotify.com') && !spotifyUrl) spotifyUrl = uri;
        if (pType === 'APPLEMUSIC' && uri.startsWith('https://') && !appleUrl) appleUrl = uri;
      }
    }
  }

  const hit = {
    title: track.title || '',
    artists: [track.subtitle].filter(Boolean),
    album: meta.album,
    year: meta.year,
    coverArt,
    genres: track.genres && track.genres.primary ? [track.genres.primary] : [],
    recordLabel: meta.recordLabel,
    producer: meta.producer,
    songwriters: meta.songwriters,
    spotifyUrl,
    appleMusicUrl: appleUrl,
    source: 'shazam',
  };

  return new Response(
    JSON.stringify({ matches: data.matches || [], tagid: data.tagid, hit }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});