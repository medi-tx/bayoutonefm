
/* =========================================================
   SUPABASE AUTH + CLOUD SYNC
   ========================================================= */
let authMode = 'login'; // 'login' or 'signup'
// Bump this string any time the Terms of Service / Privacy Policy materially change —
// it forces every user (even ones who already accepted an older version) to re-consent.
const TERMS_VERSION = 'v2';

function hasAcceptedCurrentTerms(user){
  const meta = (user && user.user_metadata) || {};
  return meta.terms_version === TERMS_VERSION && !!meta.terms_accepted_at;
}

// Resolves once the current user has accepted the current Terms/Privacy Policy —
// either because they already had (resolves immediately), or because they just
// clicked "Agree & Continue" in the blocking modal.
function ensureTermsAccepted(user){
  return new Promise((resolve)=>{
    if(hasAcceptedCurrentTerms(user)){ resolve(true); return; }

    const overlay = document.getElementById('termsGateOverlay');
    const checkbox = document.getElementById('terms-gate-checkbox');
    const errorEl = document.getElementById('terms-gate-error');
    const acceptBtn = document.getElementById('termsGateAcceptBtn');
    const logoutBtn = document.getElementById('termsGateLogoutBtn');
    checkbox.checked = false;
    errorEl.style.display = 'none';
    overlay.classList.add('open');

    const onAccept = async ()=>{
      if(!checkbox.checked){
        errorEl.textContent = 'Please check the box to agree before continuing.';
        errorEl.style.display = '';
        return;
      }
      acceptBtn.disabled = true; acceptBtn.textContent = '…';
      const { error } = await sb.auth.updateUser({
        data: { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION }
      });
      acceptBtn.disabled = false; acceptBtn.textContent = 'Agree & Continue';
      if(error){
        errorEl.textContent = error.message || 'Something went wrong. Please try again.';
        errorEl.style.display = '';
        return;
      }
      overlay.classList.remove('open');
      acceptBtn.removeEventListener('click', onAccept);
      logoutBtn.removeEventListener('click', onLogout);
      resolve(true);
    };
    const onLogout = async ()=>{
      if(syncDirty || syncInFlight){
        const proceed = window.confirm('Your changes are still saving to the cloud. If you log out before saving finishes, your latest edits may be lost.\n\nLog out anyway?');
        if(!proceed) return;
        try{
          syncInFlight = false;
          await Promise.race([ doSync(0, syncRevision), new Promise(res=> setTimeout(res, 3000)) ]);
        }catch(e){}
      }
      overlay.classList.remove('open');
      acceptBtn.removeEventListener('click', onAccept);
      logoutBtn.removeEventListener('click', onLogout);
      await sb.auth.signOut();
      resolve(false);
    };
    acceptBtn.addEventListener('click', onAccept);
    logoutBtn.addEventListener('click', onLogout);
  });
}
let syncTimer = null;

function showAuthScreen(){
  document.getElementById('recoveryScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('loginFields').style.display = '';
  document.getElementById('forgotFields').style.display = 'none';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = 'none';
}
function showApp(){
  document.getElementById('recoveryScreen').style.display = 'none';
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrap').style.display = '';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = '';
}
function showRecoveryScreen(){
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('recoveryScreen').style.display = 'flex';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = 'none';
}
function setAuthError(msg){
  const el = document.getElementById('auth-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setAuthMessage(msg){
  const el = document.getElementById('auth-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}

document.getElementById('auth-toggle-btn').addEventListener('click', ()=>{
  trackEvent('toggle_auth_mode');
  authMode = (authMode === 'login') ? 'signup' : 'login';
  document.getElementById('auth-submit-btn').textContent = authMode === 'login' ? 'Log in' : 'Sign up';
  document.getElementById('auth-toggle-btn').textContent = authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in';
  document.getElementById('auth-consent-row').style.display = authMode === 'signup' ? '' : 'none';
  document.getElementById('auth-confirm-row').style.display = authMode === 'signup' ? '' : 'none';
  setAuthError(null); setAuthMessage(null);
});

document.getElementById('auth-submit-btn').addEventListener('click', async ()=>{
  trackEvent(authMode==='login'?'login':'signup');
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthError(null); setAuthMessage(null);
  if(!email || !password){ setAuthError('Enter an email and password.'); return; }
  if(authMode === 'signup' && !document.getElementById('auth-consent-checkbox').checked){
    setAuthError('Please agree to the Terms of Service and Privacy Policy to create an account.');
    return;
  }
  if(authMode === 'signup'){
    if(password.length < 6){ setAuthError('Password must be at least 6 characters.'); return; }
    const confirmPassword = document.getElementById('auth-confirm-password').value;
    if(password !== confirmPassword){ setAuthError('Passwords do not match.'); return; }
  }
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled = true; btn.textContent = '…';

  try{
    if(authMode === 'login'){
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if(error) setAuthError(error.message);
    } else {
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: { terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION } }
      });
      if(error){ setAuthError(error.message); return; }
      if(data.session){
        trackEvent('account_created');
        autoFriendSam(data.session.user.id);
      } else {
        trackEvent('account_created_pending_email');
        setAuthMessage('Check your email to confirm your account, then log in.');
      }
    }
  }catch(e){
    console.error('Auth error:', e);
    setAuthError(e.message || 'Something went wrong. Check your connection and try again.');
  }finally{
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Log in' : 'Sign up';
  }
});

async function autoFriendSam(newUserId){
  try{
    const { data: sam } = await sb.from('profiles').select('user_id').eq('username', 'samannleblanc').maybeSingle();
    if(!sam || !sam.user_id) return;
    if(sam.user_id === newUserId) return;
    await sb.from('friends').upsert(
      { requester_id: newUserId, addressee_id: sam.user_id, status: 'accepted' },
      { onConflict: 'requester_id,addressee_id' }
    );
  }catch(e){ console.warn('Auto-friend failed:', e); }
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && document.getElementById('authScreen').style.display !== 'none'){
    if(document.getElementById('forgotFields').style.display !== 'none'){
      document.getElementById('sendResetBtn').click();
    } else {
      document.getElementById('auth-submit-btn').click();
    }
  }
  if(e.key === 'Enter' && document.getElementById('recoveryScreen').style.display !== 'none'){
    document.getElementById('recoverySubmitBtn').click();
  }
});

function setForgotError(msg){
  const el = document.getElementById('forgot-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setForgotMessage(msg){
  const el = document.getElementById('forgot-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
document.getElementById('forgotPasswordLink').addEventListener('click', ()=>{
  document.getElementById('loginFields').style.display = 'none';
  document.getElementById('forgotFields').style.display = '';
  document.getElementById('forgot-email').value = document.getElementById('auth-email').value;
  setForgotError(null); setForgotMessage(null);
});
document.getElementById('cancelForgotBtn').addEventListener('click', ()=>{
  document.getElementById('loginFields').style.display = '';
  document.getElementById('forgotFields').style.display = 'none';
});
document.getElementById('sendResetBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('forgot-email').value.trim();
  setForgotError(null); setForgotMessage(null);
  if(!email){ setForgotError('Enter your email.'); return; }
  const btn = document.getElementById('sendResetBtn');
  btn.disabled = true; btn.textContent = '…';
  try{
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if(error){
      console.error('Password reset email failed:', error);
      setForgotError(error.message || 'The reset email could not be sent. This is usually a temporary server issue — please try again in a moment, and if it keeps failing, contact support.');
      return;
    }
    setForgotMessage('If that email has an account, a reset link is on its way. Check your inbox (and spam). The link opens back here so you can set a new password.');
  }catch(e){
    console.error('Password reset request threw:', e);
    setForgotError('Something went wrong reaching the server. Please try again.');
  }finally{
    btn.disabled = false; btn.textContent = 'Send reset link';
  }
});

function setRecoveryError(msg){
  const el = document.getElementById('recovery-error');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
function setRecoveryMessage(msg){
  const el = document.getElementById('recovery-message');
  if(msg){ el.textContent = msg; el.style.display = ''; } else { el.style.display = 'none'; }
}
document.getElementById('recoverySubmitBtn').addEventListener('click', async ()=>{
  const pw1 = document.getElementById('recovery-password').value;
  const pw2 = document.getElementById('recovery-password-2').value;
  setRecoveryError(null); setRecoveryMessage(null);
  if(!pw1 || pw1.length < 6){ setRecoveryError('Password must be at least 6 characters.'); return; }
  if(pw1 !== pw2){ setRecoveryError('Passwords do not match.'); return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if(error){ setRecoveryError(error.message); return; }
  setRecoveryMessage('Password updated! Loading your cataloguex…');
  const { data: { session } } = await sb.auth.getSession();
  if(session && session.user) setTimeout(()=>loadAppForUser(session.user), 900);
});

  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    try{
      trackEvent('logout');
    }catch(e){}
    try{
      await sb.auth.signOut();
    }catch(e){ console.warn('signOut failed — forcing local logout:', e); }
    currentUserId = null;
    myProfile = null;
    appBootedFor = null;
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(CUSTOM_THEMES_KEY);
    applyTheme(DEFAULT_THEME);
    showSotdScheduleBtn();
    if(typeof syncCDButton === 'function') syncCDButton();
    unsubscribeNotifications();
    if(window.stopMsgRealtime) window.stopMsgRealtime();
    showAuthScreen();
  });

async function fetchUserData(userId){
  const { data, error } = await sb
    .from('user_data')
    .select('songs, people, wishlist')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){ console.error('Error loading your data:', error); return null; }
  return data;
}

async function ensureUserRow(userId){
  const { error } = await sb
    .from('user_data')
    .upsert({ user_id: userId, songs: [], people: [], wishlist: [] }, { onConflict: 'user_id', ignoreDuplicates: true });
  if(error) console.error('Error creating your data row:', error);
}

async function upsertGlobalSong(song, userId){
  try{
    const title = (song.title || '').trim();
    const artist = (song.artists && song.artists[0] || '').trim();
    if(!title || !artist) return false;
    const base = {
      p_title: title,
      p_artist: artist,
      p_album: (song.album || '').trim(),
      p_year: (song.year || '').toString().trim(),
      p_genres: song.genres || [],
      p_cover_art: song.coverArt || '',
      p_preview_url: song.previewUrl || '',
      p_explicit: song.explicit || false,
      p_added_by: userId || null
    };
    const full = {
      ...base,
      p_producers: song.producer || '',
      p_songwriters: song.songwriters || '',
      p_bpm: song.bpm || null,
      p_key: song.musicKey || '',
      p_duration: song.duration || '',
      p_record_label: song.recordLabel || '',
      p_spotify_url: song.spotifyUrl || '',
      p_apple_music_url: song.appleMusicUrl || '',
      p_youtube_music_url: song.youtubeMusicUrl || '',
      p_tidal_url: song.tidalUrl || '',
      p_release_date: song.releaseDate || '',
      p_artist_website: song.artistWebsite || '',
      p_track_number: song.trackNumber ? String(song.trackNumber) : ''
    };
    let res = await sb.rpc('upsert_global_song', full);
    if(res && res.error && (/does not exist|could not find the function|could not match|schema cache|argument|could not choose the best candidate/i.test(res.error.message || ''))){
      // Schema may be missing migration 0002 (extended fields) or have duplicate
      // RPC overloads — retry with the base column set against whatever resolves.
      res = await sb.rpc('upsert_global_song', base);
    }
    if(res && res.error){ console.error('global_songs upsert failed:', res.error.message); return false; }
    return true;
  }catch(e){ console.error('global_songs upsert failed:', e); return false; }
}

function upsertGlobalSongBatch(songsList, userId){
  if(!songsList || !songsList.length) return;
  const rows = songsList.filter(s => s && s.title && s.artists && s.artists[0]);
  if(!rows.length) return;
  rows.forEach(s => {
    upsertGlobalSong(s, userId);
  });
}

function syncToSongDb(song, userId){
  try{
    const title = (song.title || '').trim();
    const artist = (song.artists && song.artists[0] || '').trim();
    if(!title || !artist) return;
    const genreList = Array.isArray(song.genres)
      ? song.genres.filter(Boolean)
      : (typeof song.genres === 'string' && song.genres ? song.genres.split(/,\s*/).filter(Boolean) : []);
    const facts = {
      album: String(song.album || '').trim(),
      year: String(song.year || '').trim(),
      genres: genreList,
      track_number: (song.trackNumber !== '' && song.trackNumber !== null && song.trackNumber !== undefined) ? Number(song.trackNumber) : null,
      duration: String(song.duration || ''),
      cover_art: song.coverArt || null,
      record_label: String(song.recordLabel || ''),
      producer: String(song.producer || ''),
      songwriters: String(song.songwriters || ''),
      bpm: String(song.bpm || ''),
      key: String(song.musicKey || ''),
      explicit: !!song.explicit,
      release_date: String(song.releaseDate || ''),
      artist_website: String(song.artistWebsite || '')
    };
    const links = {};
    if(song.spotifyUrl) links.spotify = song.spotifyUrl;
    if(song.appleMusicUrl) links.apple = song.appleMusicUrl;
    if(song.youtubeMusicUrl) links.youtube = song.youtubeMusicUrl;
    if(song.tidalUrl) links.tidal = song.tidalUrl;
    if(Object.keys(links).length) facts.streaming_links = links;
    const localId = userId || null;

    // Enrichment payload: only the factual fields that actually have data, so we
    // never clobber richer values in a shared row with our empty strings.
    const enrich = {};
    ['album','year','cover_art','record_label','producer','songwriters','bpm','key','explicit','release_date','artist_website'].forEach(k=>{
      if(facts[k] !== '' && facts[k] !== null && facts[k] !== undefined) enrich[k] = facts[k];
    });
    if(genreList.length) enrich.genres = genreList;
    if(facts.track_number !== null && facts.track_number !== undefined) enrich.track_number = facts.track_number;
    if(facts.duration) enrich.duration = facts.duration;
    if(Object.keys(links).length) enrich.streaming_links = links;

    // Insert ladders: full row (after migration 0004 adds the new columns),
    // then the live songdb.html schema, then progressively smaller sets.
    const full = { title, artist, ...facts, source: 'user', added_by: localId };
    const compact = {
      title, artist,
      album: facts.album, year: facts.year, genres: genreList,
      track_number: facts.track_number, duration: facts.duration,
      cover_art: facts.cover_art, record_label: facts.record_label,
      producer: facts.producer, songwriters: facts.songwriters,
      bpm: facts.bpm, key: facts.key
    };
    if(Object.keys(links).length) compact.streaming_links = links;
    compact.source = 'user';
    compact.added_by = localId;
    const core = { title, artist, album: facts.album, year: facts.year, genres: genreList, cover_art: facts.cover_art, source: 'user', added_by: localId };
    const minimal = { title, artist, cover_art: facts.cover_art, source: 'user', added_by: localId };
    const ladder = [full, compact, core, minimal];
    let attempt = 0;
    function schemeError(err){
      return !!(err && (err.code === '42P10' || err.code === '42703' || err.code === '42P01' || /does not exist|undefined_column|could not find.*column/i.test(err.message || '')));
    }
    function tryInsert(){
      const row = ladder[attempt];
      if(!row){ console.error('[syncToSongDb] insert failed after all fallbacks'); return; }
      try{
        sb.from('song_database').insert(row).then(({error})=>{
          if(!error || error.code === '23505') return;
          if(schemeError(error)){ attempt++; setTimeout(tryInsert, 0); }
          else console.error('[syncToSongDb] insert error:', error.message);
        }).catch(e=>{ console.error('[syncToSongDb] insert threw:', e); });
      }catch(e){ console.error('[syncToSongDb] insert threw:', e); }
    }
    // Enrich an existing matching row; only insert when no row exists yet.
    try{
      sb.from('song_database').select('id').ilike('title', title).ilike('artist', artist).limit(1)
        .then(({data, error})=>{
          if(error){ tryInsert(); return; }
          if(data && data.length){
            if(Object.keys(enrich).length){
              sb.from('song_database').update(enrich).eq('id', data[0].id)
                .then(({error: uerr})=>{ if(uerr && !schemeError(uerr)) console.error('[syncToSongDb] enrich failed:', uerr.message); })
                .catch(e=>{ console.error('[syncToSongDb] enrich threw:', e); });
            }
            return;
          }
          tryInsert();
        })
        .catch(()=>{ tryInsert(); });
    }catch(e){ tryInsert(); }
  }catch(e){ console.error('[syncToSongDb] error:', e); }
}
function syncToSongDbBatch(songsList, userId){
  if(!songsList || !songsList.length) return;
  songsList.forEach(s => syncToSongDb(s, userId));
}

function backfillSongDb(){
  if(!sb || !currentUserId) return;
  if(localStorage.getItem('bayoutonefm-songdb-backfill-v2-' + currentUserId)) return;
  const candidates = (typeof songs !== 'undefined' ? songs : [])
    .filter(s => s && s.title && s.artists && s.artists[0]);
  if(!candidates.length) return;
  const keyOf = s => (s.title || '').trim().toLowerCase() + '|||' + (s.artists[0] || '').trim().toLowerCase();
  const want = new Map(candidates.map(s => [keyOf(s), s]));
  const titles = [...new Set(candidates.map(s => (s.title || '').trim()))];
  const existing = new Set();
  const CHUNK = 500;
  let chunk = 0;
  function fetchChunk(){
    const slice = titles.slice(chunk * CHUNK, (chunk + 1) * CHUNK);
    if(!slice.length){ done(); return; }
    chunk++;
    sb.from('song_database').select('title, artist').in('title', slice)
      .then(({ data })=>{
        (data || []).forEach(r => existing.add((r.title || '').trim().toLowerCase() + '|||' + (r.artist || '').trim().toLowerCase()));
        fetchChunk();
      })
      .catch(()=> fetchChunk());
  }
  function done(){
    const missing = [...want.entries()].filter(([k])=> !existing.has(k)).map(([,s])=> s);
    if(!missing.length) return;
    const BATCH = 3, DELAY = 700;
    let i = 0;
    (function next(){
      if(i >= missing.length){
        localStorage.setItem('bayoutonefm-songdb-backfill-v2-' + currentUserId, '1');
        console.log('[backfill] pushed', missing.length, 'existing songs into the song database');
        return;
      }
      missing.slice(i, i + BATCH).forEach(s => syncToSongDb(s, currentUserId));
      i += BATCH;
      setTimeout(next, DELAY);
    })();
  }
  fetchChunk();
}

function dailySongDatabaseSync(){
  if(!sb || !currentUserId) return;
  const KEY = 'bayoutonefm-songdb-daily-v2-' + currentUserId;
  let last = 0;
  try{ last = Number(localStorage.getItem(KEY) || 0); }catch(e){}
  if(last && (Date.now() - last) < 86400000) return; // once per day
  const done = ()=>{
    try{ localStorage.setItem(KEY, String(Date.now())); }catch(e){}
  };
  const fetchAll = () => new Promise((resolve, reject)=>{
    const rows = [];
    const PAGE = 500;
    let offset = 0;
    const fields = 'title, artist, album, year, genres, cover_art, explicit, producer, songwriters, bpm, key, duration, record_label, track_number, streaming_links, release_date, artist_website';
    (function nextPage(){
      sb.from('song_database').select(fields).order('created_at', { ascending: true }).range(offset, offset + PAGE - 1)
        .then(({ data, error })=>{
          if(error){ reject(error); return; }
          if(!data || !data.length){ resolve(rows); return; }
          rows.push(...data);
          if(data.length < PAGE){ resolve(rows); return; }
          offset += PAGE;
          nextPage();
        })
        .catch(reject);
    })();
  });
  const mapRow = (r) => {
    const links = r.streaming_links || {};
    return {
      title: ((r.title || '') + '').trim(),
      artists: [((r.artist || '') + '').trim()],
      album: r.album || '',
      year: r.year || '',
      genres: Array.isArray(r.genres) ? r.genres : [],
      coverArt: r.cover_art || '',
      explicit: !!r.explicit,
      producer: r.producer || '',
      songwriters: r.songwriters || '',
      bpm: r.bpm ? (Number(r.bpm) || null) : null,
      musicKey: r.key || '',
      duration: r.duration || '',
      recordLabel: r.record_label || '',
      spotifyUrl: links.spotify || '',
      appleMusicUrl: links.apple || '',
      youtubeMusicUrl: links.youtube || '',
      tidalUrl: links.tidal || '',
      releaseDate: r.release_date || '',
      artistWebsite: r.artist_website || '',
      trackNumber: r.track_number
    };
  };
  const syncRows = (rowsToSync) => new Promise((resolve)=>{
    const BATCH = 5;
    const DELAY = 500;
    let i = 0, ok = 0, fail = 0;
    (function next(){
      if(i >= rowsToSync.length){
        console.log('[dailySongSync] synced', ok, 'of', rowsToSync.length, 'songs' + (fail ? ' (' + fail + ' failed)' : ''));
        resolve();
        return;
      }
      Promise.all(rowsToSync.slice(i, i + BATCH).map(s => upsertGlobalSong(s, null))).then(results => {
        results.forEach(r => { if(r) ok++; else fail++; });
        i += BATCH;
        setTimeout(next, DELAY);
      });
    })();
  });
  fetchAll()
    .then(rows => {
      const want = new Map();
      rows.forEach(r => {
        const t = ((r.title || '') + '').trim();
        const a = ((r.artist || '') + '').trim();
        if(!t || !a) return;
        const k = t.toLowerCase() + '|||' + a.toLowerCase();
        if(!want.has(k)) want.set(k, mapRow(r));
      });
      if(!want.size){ done(); return; }
      return syncRows([...want.values()]).then(()=>{
        done();
      });
    })
    .catch(e => console.error('[dailySongSync] failed:', e));
}

function enrichExplicitStatus(){
  const missingExplicit = songs.filter(s => typeof s.explicit === 'undefined' && s.title && s.artists && s.artists[0]);
  if(!missingExplicit.length) return;
  const BATCH = 3;
  const DELAY = 800;
  let i = 0;
  function nextBatch(){
    if(i >= missingExplicit.length){ save(); return; }
    const batch = missingExplicit.slice(i, i + BATCH);
    i += BATCH;
    Promise.all(batch.map(s => {
      const term = (s.title||'') + ' ' + (s.artists[0]||'');
      return deezerSearch(term, 3).then(results => {
        if(!results || !results.length) return null;
        const r = results.find(x => (x.trackName||'').trim().toLowerCase() === (s.title||'').trim().toLowerCase() && (x.artistName||'').trim().toLowerCase() === (s.artists[0]||'').trim().toLowerCase());
        return r ? { idx: songs.indexOf(s), explicit: !!r.explicit } : null;
      }).catch(()=> null);
    })).then(results => {
      results.filter(Boolean).forEach(r => {
        if(r.idx > -1 && typeof songs[r.idx].explicit === 'undefined'){
          songs[r.idx].explicit = r.explicit;
        }
      });
      setTimeout(nextBatch, DELAY);
    }).catch(()=> setTimeout(nextBatch, DELAY));
  }
  nextBatch();
}

async function searchGlobalSongs(query, limit = 25){
  try{
    const { data, error } = await sb.rpc('search_global_songs', { search_term: query, result_limit: limit });
    if(error){
      const { data: fallback } = await sb.from('global_songs').select('*').or(`title.ilike.%${query}%,artist.ilike.%${query}%`).limit(limit);
      return fallback || [];
    }
    return data || [];
  }catch(e){ return []; }
}

async function updateGlobalSong(song){
  try{
    const title = (song.title || '').trim();
    const artist = (song.artists && song.artists[0] || '').trim();
    if(!title || !artist) return;
    const updates = {};
    if(song.year) updates.year = song.year.toString().trim();
    if(song.genres && song.genres.length) updates.genres = song.genres;
    if(song.album) updates.album = song.album.trim();
    if(song.coverArt) updates.cover_art = song.coverArt;
    if(song.previewUrl) updates.preview_url = song.previewUrl;
    if(typeof song.explicit === 'boolean') updates.explicit = song.explicit;
    if(song.producer) updates.producers = song.producer;
    if(song.songwriters) updates.songwriters = song.songwriters;
    if(song.bpm !== null && song.bpm !== undefined) updates.bpm = song.bpm;
    if(song.musicKey) updates.key = song.musicKey;
    if(song.duration) updates.duration = song.duration;
    if(song.recordLabel) updates.record_label = song.recordLabel;
    if(song.spotifyUrl) updates.spotify_url = song.spotifyUrl;
    if(song.appleMusicUrl) updates.apple_music_url = song.appleMusicUrl;
    if(song.youtubeMusicUrl) updates.youtube_music_url = song.youtubeMusicUrl;
    if(song.tidalUrl) updates.tidal_url = song.tidalUrl;
    if(song.releaseDate) updates.release_date = song.releaseDate;
    if(song.artistWebsite) updates.artist_website = song.artistWebsite;
    if(song.trackNumber) updates.track_number = String(song.trackNumber);
    if(Object.keys(updates).length === 0) return;
    await sb.from('global_songs').update(updates).eq('title', title).ilike('artist', artist);
  }catch(e){ console.error('global_songs update failed:', e); }
}

function slimSongForUpload(s){
  const c = Object.assign({}, s);
  ['album','year','why','credit','lyricSnippet','heard','source','clusterName','producer','songwriters','duration','recordLabel','musicKey','spotifyUrl','appleMusicUrl','youtubeMusicUrl','tidalUrl','releaseDate','artistWebsite'].forEach(k=>{
    if(c[k] === '' || c[k] === null || c[k] === undefined) delete c[k];
  });
  ['artists','genres','tags','remindsOf','edits'].forEach(k=>{
    if(Array.isArray(c[k]) && c[k].length === 0) delete c[k];
  });
  if(c.tier === '' || c.tier === null || c.tier === undefined) delete c.tier;
  if(c.bpm === null || c.bpm === undefined) delete c.bpm;
  return c;
}
let syncDirty = false;
let syncInFlight = false;
let syncRetryTimer = null;
let syncRevision = 0;

function setSyncStatus(state){
  const el = document.getElementById('syncStatus');
  if(!el) return;
  if(state === 'syncing'){ el.textContent = 'Saving…'; el.className = 'sync-status syncing'; }
  else if(state === 'saved'){ el.textContent = 'Saved'; el.className = 'sync-status saved'; }
  else if(state === 'error'){ el.textContent = 'Save failed — retrying'; el.className = 'sync-status error'; }
  else { el.textContent = ''; el.className = 'sync-status'; }
}

let cloudLoadFailed = false;

const coverStoreCache = new Map();
async function storeCoverArt(song){
  if(!currentUserId || !sb || !sb.storage || !song.coverArt) return song.coverArt;
  const src = String(song.coverArt);
  if(!src.startsWith('data:')) return song.coverArt;
  const key = src.slice(0, 256);
  if(coverStoreCache.has(key)) return coverStoreCache.get(key);
  try{
    const blob = dataUrlToBlob(src);
    if(!blob) return song.coverArt;
    const ext = (blob.type || 'image/png').split('/')[1] || 'png';
    const path = 'covers/' + currentUserId + '/' + (song.id || Date.now()) + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
    const { error } = await sb.storage.from('stickers').upload(path, blob, { contentType: blob.type || 'image/png', upsert: true });
    if(error){ console.error('Cover upload error:', error); return song.coverArt; }
    const { data } = sb.storage.from('stickers').getPublicUrl(path);
    const url = data && data.publicUrl ? data.publicUrl : song.coverArt;
    coverStoreCache.set(key, url);
    return url;
  }catch(e){ console.error('Cover upload failed:', e); return song.coverArt; }
}
function dataUrlToBlob(dataUrl){
  try{
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
    if(!m) return null;
    const mime = m[1] || 'image/png';
    const isBase64 = !!m[2];
    const body = isBase64 ? atob(m[3]) : decodeURIComponent(m[3]);
    const arr = new Uint8Array(body.length);
    for(let i=0;i<body.length;i++) arr[i] = body.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }catch(e){ return null; }
}

// Keep every song's cover art in its own row (song_covers) so a large library
// sync that has to strip covers from the user_data payload never loses them.
async function syncCovers(songList){
  if(!currentUserId || !sb || !songList || !songList.length) return;
  try{
    const rows = [];
    const withCover = new Set();
    const presentIds = [];
    for(const s of songList){
      if(!s || !s.id) continue;
      presentIds.push(s.id);
      if(s.coverArt){
        withCover.add(s.id);
        rows.push({ user_id: currentUserId, song_id: s.id, cover_art: String(s.coverArt), updated_at: new Date().toISOString() });
      }
    }
    for(let i = 0; i < rows.length; i += 200){
      const { error } = await sb.from('song_covers').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,song_id' });
      if(error) throw error;
    }
    // Current songs that no longer carry a cover should drop their saved row too.
    const noCover = presentIds.filter(id => !withCover.has(id));
    for(let i = 0; i < noCover.length; i += 50){
      const ids = noCover.slice(i, i + 50);
      const { error } = await sb.from('song_covers').delete().eq('user_id', currentUserId).in('song_id', ids);
      if(error) throw error;
    }
  }catch(e){ console.error('Cover sync to song_covers failed (covers stay stored locally):', e); }
}

async function doSync(attempt, startRevision){
  if(!currentUserId) return;
  if(syncInFlight) return; // already uploading; post-success check will re-sync if needed
  if(cloudLoadFailed){
    console.warn('Cloud sync skipped: previous load from Supabase failed. Nothing was overwritten. Reload the page to reconnect before saving.');
    return;
  }
  syncInFlight = true;
  setSyncStatus('syncing');
  try{
    const updated = new Date().toISOString();
    const localIds = new Set(songs.map(s=>s.id));
    // Move base64 cover art to storage first so the upload stays small and
    // covers actually make it into the saved songs (big data: URLs used to
    // trip the size limit and get stripped).
    const slimSongs = [];
    for(const s of songs){
      const c = Object.assign({}, s);
      c.coverArt = await storeCoverArt(c);
      slimSongs.push(slimSongForUpload(c));
    }
    // Covers persist outside the (size-limited) user_data row.
    await syncCovers(slimSongs);
    let payload = { user_id: currentUserId, songs: slimSongs, people, wishlist, updated_at: updated };
    if(JSON.stringify(payload).length < 900000){
      await pushUserData(payload);
    } else {
      // Large cataloguex: save people+wishlist first, then merge songs with remote
      await pushUserData({ user_id: currentUserId, people, wishlist, updated_at: updated });
      const { data: existing } = await sb.from('user_data').select('songs').eq('user_id', currentUserId).maybeSingle();
      const remoteOnly = (((existing && existing.songs) || [])).filter(s => !localIds.has(s.id));
      const merged = [...slimSongs, ...remoteOnly];
      payload = { user_id: currentUserId, songs: merged, updated_at: updated };
      if(JSON.stringify(payload).length < 900000){
        await pushUserData(payload);
      } else {
        // Still too big — drop remote-only songs we can't verify, keep local state authoritative
        // and strip heavy fields (base64 art, edit logs)
        payload.songs = merged.map(s => {
          const c = Object.assign({}, s);
          if(c.coverArt && c.coverArt.startsWith('data:')) delete c.coverArt;
          if(c.edits && c.edits.length > 3) c.edits = c.edits.slice(-3);
          return c;
        });
        if(JSON.stringify(payload).length >= 900000){
          // Final fallback: drop cover art entirely from upload copy only
          payload.songs = payload.songs.map(s => { const c = Object.assign({}, s); delete c.coverArt; return c; });
        }
        await pushUserData(payload);
        console.warn('Saved songs in reduced form due to size limit. Full data preserved locally.');
      }
    }
    syncDirty = false;
    syncInFlight = false;
    setSyncStatus('saved');
    if(syncRetryTimer){ clearTimeout(syncRetryTimer); syncRetryTimer = null; }
    // If another change landed while we were uploading, sync again immediately.
    if(startRevision !== syncRevision){ doSync(0, syncRevision); }
  }catch(e){
    syncDirty = true;
    const delay = Math.min(30000, 2000 * Math.pow(2, attempt)); // 2s, 4s, 8s, 16s, 30s…
    setSyncStatus('error');
    console.error('Cloud save failed (attempt ' + (attempt + 1) + '), retrying in ' + delay + 'ms:', e);
    if(syncRetryTimer) clearTimeout(syncRetryTimer);
    syncRetryTimer = setTimeout(()=> { syncInFlight = false; doSync(attempt + 1, syncRevision); }, delay);
  }
}
function pushUserData(payload){
  return sb.from('user_data').upsert(payload, { onConflict: 'user_id' }).then(r=>{
    if(r.error) throw r.error;
  });
}
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && syncDirty && currentUserId && !syncInFlight){
    clearTimeout(syncTimer);
    syncTimer = setTimeout(()=> doSync(0, syncRevision), 1000);
  }
});
// Retry a pending/again save whenever the connection comes back.
window.addEventListener('online', ()=>{
  if(syncDirty && currentUserId && !syncInFlight){ doSync(0, syncRevision); }
});
// Background safety net: if a save is still pending (e.g. tab left open through an outage), retry periodically.
setInterval(()=>{
  if(syncDirty && currentUserId && !syncInFlight){ doSync(0, syncRevision); }
}, 20000);
function syncToSupabase(){
  if(!currentUserId) return;
  syncDirty = true;
  syncRevision++;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(()=> doSync(0, syncRevision), 400);
}

let currentUserId = null;
window.currentUserId = currentUserId;
let currentUserEmail = null;
let emailWasPending = false;
window.resetCataloguex = async function(){
  console.log('Resetting cataloguex for user:', currentUserId);
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PEOPLE_KEY);
  localStorage.removeItem(WISHLIST_KEY);
  const { error } = await sb.from('user_data').upsert({ user_id: currentUserId, songs: [], people: [], wishlist: [], updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if(error) console.error('Reset error:', error);
  else console.log('Reset done, reloading...');
  location.reload();
};
let myProfile = null;
let myFriendsCount = 0;
let appBootedFor = null;

async function fetchMyProfile(userId){
  let lastError = null;
  for(let attempt = 0; attempt < 3; attempt++){
    const { data, error } = await sb
      .from('profiles')
      .select('user_id, username, bio, photo, theme, custom_themes, certified_tester')
      .eq('user_id', userId)
      .maybeSingle();
    if(error){
      lastError = error;
      console.error('Error loading your profile (retrying without theme column):', error);
      // theme column may not exist in this database yet — fall back so onboarding/login still works
      const retry = await sb
        .from('profiles')
        .select('user_id, username, bio, photo')
        .eq('user_id', userId)
        .maybeSingle();
      if(retry.error){
        console.error('Error loading your profile (attempt ' + (attempt+1) + '):', retry.error);
        lastError = retry.error;
        await new Promise(r=>setTimeout(r, 500 * (attempt+1)));
        continue;
      }
      return retry.data;
    }
    return data;
  }
  if(lastError) console.error('Gave up loading profile after retries:', lastError);
  return null;
}

async function upsertMyProfile(fields){
  const { data, error } = await sb.from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('user_id', currentUserId)
    .select();
  if(error) return error;
  if(!data || data.length === 0){
    const row = { user_id: currentUserId, updated_at: new Date().toISOString(), ...fields };
    const { error: insErr } = await sb.from('profiles').insert(row);
    return insErr;
  }
  return null;
}

function renderMyAvatar(){
  const el = document.getElementById('myAvatarContent');
  if(myProfile && myProfile.photo){
    el.innerHTML = `<img loading="lazy" decoding="async" src="${myProfile.photo}" alt="Profile photo">`;
  } else {
    el.innerHTML = '♪';
  }
}

function showLoginBanner(){
  var old = document.getElementById('loginBanner');
  if(old) old.remove();
  var d = document.createElement('div');
  d.id = 'loginBanner';
  d.style.cssText = 'position:fixed;top:env(safe-area-inset-top, 0px);left:0;right:0;z-index:9998;background:var(--paper);color:var(--on-paper);border-bottom:1px solid var(--border);padding:14px 44px 14px 14px;font-family:"Space Grotesk",sans-serif;font-size:13px;line-height:1.5;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.15);word-break:break-word;';
  d.innerHTML = 'Please contact <a href="mailto:bayoutonefm@outlook.com" style="color:var(--teal);">bayoutonefm@outlook.com</a> with any bugs, questions, suggestions, or concerns. We are always happy to help. Thanks! :)';
  var x = document.createElement('button');
  x.textContent = '\u00d7';
  x.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;cursor:pointer;color:var(--on-paper);padding:4px 8px;line-height:1;';
  x.addEventListener('click', function(ev){ ev.stopPropagation(); d.remove(); });
  d.addEventListener('click', function(){ d.remove(); });
  d.appendChild(x);
  document.body.appendChild(d);
  setTimeout(function(){ d.style.transition='opacity 0.3s'; d.style.opacity='0'; setTimeout(function(){ d.remove(); }, 300); }, 6000);
}

function isSamAdmin(){
  return !!(myProfile && myProfile.username === 'samannleblanc');
}
const TESTER_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdfM-OtLC51PooQoj0yz5S9rHAlN7Jbvw1a97hNkGXrXqMITA/viewform?usp=publish-editor';
// Certified testers' form links — replace with the real ones when provided.
const TESTER_BUG_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdnpkYw1R0bmcihAJ_8LWOVgvGXHva3S47RdwfnlFsr1yO1LA/viewform?usp=header';
const TESTER_FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSc0_nHWNov42KuchI1LRchUS2Cdg3DR3b67wueXY-rQDjdoyQ/viewform?usp=header';
const TESTER_QUESTIONS_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd_h2sp0dSkxhgPK2DX0XlSjjDVBWE0VLAhniq8cEExv6ImxQ/viewform?usp=publish-editor';
function isCertifiedTester(){
  return !!(myProfile && myProfile.certified_tester === true);
}
function syncTesterButton(){
  const btn = document.getElementById('testerBtn');
  if(btn) btn.textContent = '🧪 Tester';
  const hubList = document.getElementById('testerHubList');
  if(hubList && typeof testerHubItemsHtml === 'function') hubList.innerHTML = testerHubItemsHtml();
}
async function autoFriendSam(){
  try{
    if(!sb || !currentUserId) return;
    if(isSamAdmin()) return;
    if(myFriendIds && myFriendIds.has('samannleblanc')) return;
    const { data: sam, error: samErr } = await sb
      .from('profiles')
      .select('user_id')
      .eq('username', 'samannleblanc')
      .maybeSingle();
    if(samErr || !sam || !sam.user_id) return;
    if(sam.user_id === currentUserId) return;
    if(myFriendIds && myFriendIds.has(sam.user_id)) return;
    const { data: existing } = await sb
      .from('friends')
      .select('id, status')
      .or(`and(requester_id.eq.${currentUserId},addressee_id.eq.${sam.user_id}),and(requester_id.eq.${sam.user_id},addressee_id.eq.${currentUserId})`)
      .maybeSingle();
    if(existing){
      if(existing.status === 'accepted' && myFriendIds) myFriendIds.add(sam.user_id);
      return;
    }
    const { error } = await sb.from('friends').upsert(
      { requester_id: currentUserId, addressee_id: sam.user_id, status: 'accepted' },
      { onConflict: 'requester_id,addressee_id' }
    );
    if(error){ console.error('Error auto-friending samannleblanc:', error); return; }
    if(myFriendIds) myFriendIds.add(sam.user_id);
    const uname = (myProfile && myProfile.username) ? '@' + myProfile.username : 'A new listener';
    try{ sendNotif(sam.user_id, 'friend_accept', uname + ' joined bayoutonefm — you are now friends automatically'); }catch(e){}
    console.log('[autofriend] Linked with samannleblanc');
  }catch(e){ console.error('[autofriend]', e); }
}

async function loadAppForUser(user){
  if(appBootedFor === user.id) return;
  appBootedFor = user.id;
  currentUserId = user.id;
  currentUserEmail = user.email || null;
  updateEmailConfirmBanner(user);
  // Per-user localStorage keys to prevent cross-account data bleed
  STORAGE_KEY = 'song-journal-entries-' + user.id;
  PEOPLE_KEY = 'song-journal-people-' + user.id;
  WISHLIST_KEY = 'song-journal-wishlist-' + user.id;
  myProfile = await fetchMyProfile(user.id);
  showAnalyticsExport();
  showSotdScheduleBtn();
  renderMyAvatar();
  if(myProfile && myProfile.theme){
    applyTheme(myProfile.theme);
    localStorage.setItem(THEME_KEY, JSON.stringify(myProfile.theme));
  } else {
    applyTheme(DEFAULT_THEME);
    localStorage.setItem(THEME_KEY, JSON.stringify(DEFAULT_THEME));
  }
  if(myProfile && myProfile.custom_themes){
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(myProfile.custom_themes));
  } else {
    localStorage.setItem(CUSTOM_THEMES_KEY, '[]');
  }
  renderThemePresets();
  if(typeof syncThemeEditorVisibility === 'function') syncThemeEditorVisibility();
  if(typeof syncTesterButton === 'function') syncTesterButton();
  if(typeof syncCDButton === 'function') syncCDButton();
  if(typeof syncUpdatesLogButton === 'function') syncUpdatesLogButton();
  await ensureUserRow(user.id);
  const remote = await fetchUserData(user.id);
  cloudLoadFailed = remote == null;
  if(cloudLoadFailed) console.error('Cloud load failed — cataloguex shown empty for safety. Your data has NOT been deleted; it is still safe in Supabase.');
  songs = (remote && remote.songs) || [];
  if(examplesRemoved()){
    const before = songs.length;
    songs = songs.filter(s=>!s.isSeedExample);
    if(songs.length !== before) console.warn('Stripped ' + (before - songs.length) + ' example songs from Supabase data');
  }
  // Sync localStorage to match Supabase (Supabase is source of truth)
  const prevLocal = localStorage.getItem(STORAGE_KEY);
  if(songs.length === 0 && prevLocal && prevLocal.length > 10 && prevLocal !== JSON.stringify([])){
    // Cloud came back empty but we have a real local catalogue — keep a recoverable backup
    // before the empty state can clobber it. (Real "clear" flows re-seed examples, so this is never a legit empty.)
    try{
      localStorage.setItem(STORAGE_KEY + '-bak', prevLocal + '|' + Date.now());
      console.warn('Cloud returned an empty catalogue while local had songs — backed up previous list to "' + STORAGE_KEY + '-bak".');
    }catch(e){ /* storage full; skip */ }
  }
  // Reattach cover art that lives outside the user_data row (song_covers) plus
  // any covers still cached locally, so a large-library sync never wipes them.
  try{
    const localCovers = new Map();
    try{
      const prev = JSON.parse(prevLocal || '[]');
      if(Array.isArray(prev)) prev.forEach(s => { if(s && s.id && s.coverArt) localCovers.set(s.id, s.coverArt); });
    }catch(e){}
    const { data: coverRows } = await sb.from('song_covers').select('song_id, cover_art').eq('user_id', user.id);
    const cloudCovers = new Map((coverRows || []).map(r => [r.song_id, r.cover_art]).filter(([id, url]) => id && url));
    let reattached = 0;
    for(const s of songs){
      if(!s || s.coverArt) continue;
      const fromCloud = cloudCovers.get(s.id);
      if(fromCloud){ s.coverArt = fromCloud; reattached++; }
      else if(localCovers.has(s.id)){ s.coverArt = localCovers.get(s.id); reattached++; }
    }
    if(reattached) console.log('Reattached cover art for ' + reattached + ' songs.');
  }catch(e){ console.warn('Could not reattach saved cover art:', e); }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  prefetchPreviews(songs);
  people = (remote && remote.people) || [];
  {
    const before = people.length;
    people = people.filter(p=>!String(p.id||'').startsWith('ex-'));
    if(people.length !== before) savePeople();
  }
  {
    let stripped = false;
    songs.forEach(s=>{
      if(s.remindsOf && s.remindsOf.some(id=>String(id||'').startsWith('ex-'))){
        s.remindsOf = s.remindsOf.filter(id=>!String(id||'').startsWith('ex-'));
        stripped = true;
      }
    });
    if(stripped) save();
  }
  wishlist = (remote && remote.wishlist) || [];

  const songTitles = new Set(songs.map(s => normalizeTitle(s.title)));
  const songKeys = new Set(songs.map(s => normalizeTitle(s.title) + '||' + (s.artists||[]).map(normalizeArtist).sort().join(' ')));
  const wishlistBefore = wishlist.length;
  wishlist = wishlist.filter(w => {
    const key = normalizeTitle(w.title) + '||' + (w.artists||[]).map(normalizeArtist).sort().join(' ');
    if(songKeys.has(key)) return false;
    if(songTitles.has(normalizeTitle(w.title)) && w.lyricSnippet === undefined && w.why === undefined) return false;
    return true;
  });
  if(wishlistBefore !== wishlist.length){
    console.warn(`Cleaned ${wishlistBefore - wishlist.length} cataloguex songs from wishlist`);
    syncToSupabase();
  }

  // run the existing migration/backfill logic against the loaded songs
  songs.forEach(s=>{
    if(!s.artists){ s.artists = s.artist ? [s.artist] : []; }
    delete s.artist;
    if(!s.genres){ s.genres = s.genre ? [s.genre] : []; }
    delete s.genre;
  });
  songs.forEach((s,i)=>{ if(!s.createdAt) s.createdAt = songs.length - i; });
  songs.forEach(s=>{
    if(!s.tier){
      const r = s.rating || 0;
      if(r >= 5) s.tier = 'S';
      else if(r === 4) s.tier = 'A';
      else if(r === 3) s.tier = 'B';
      else if(r > 0) s.tier = 'C';
      else s.tier = null;
    }
    delete s.rating;
  });

  seedPeopleIfEmpty();
  seedIfEmpty();
  enrichExplicitStatus();
  const [friendRows, profiles] = await Promise.all([fetchMyFriendRows(), fetchAllProfiles()]);
  allProfilesCache = profiles;
  processFriendRows(friendRows);
  myFriendsCount = friendRows.filter(r=>r.status==='accepted').length;
  autoFriendSam();
  renderPeople();
  try{
    const savedSort = localStorage.getItem('bayoutonefm-sort');
    if(savedSort){ const sel = document.getElementById('sortBy'); if(sel && [...sel.options].some(o=>o.value===savedSort)) sel.value = savedSort; }
    const savedGenre = localStorage.getItem('bayoutonefm-filter-genre');
    if(savedGenre){ const sel = document.getElementById('filterGenre'); if(sel) sel.value = savedGenre; }
    const savedMood = localStorage.getItem('bayoutonefm-filter-mood');
    if(savedMood){ const sel = document.getElementById('filterMood'); if(sel) sel.value = savedMood; }
    const savedMode = localStorage.getItem('bayoutonefm-view-mode');
    if(savedMode === 'archive') showArchived = true;
    else if(savedMode === 'wishlist') viewingWishlist = true;
    else if(savedMode === 'tierboard') viewingTierBoard = true;
    else if(savedMode === 'timeline') viewingTimeline = true;
  }catch(e){}
  updateViewUI();
  await loadStickers();
  render();
  setTimeout(()=> enrichAllMissingArtwork(), 10000);
  setTimeout(()=> backfillSongDb(), 1500);
  setTimeout(()=> dailySongDatabaseSync(), 4000);
  setTimeout(()=> pullTopArtistsDaily(), 6000);

  const accepted = await ensureTermsAccepted(user);
  if(!accepted) return; // user chose to log out instead of accepting

  showApp();
  showLoginBanner();
  checkRoute();

  if(!myProfile || !myProfile.username){
    openOnboarding();
  }

subscribeNotifications();
  if(window.startMsgRealtime) window.startMsgRealtime();

  /* ---- invite link redemption ---- */
  try{
    const params = new URLSearchParams(location.search);
    const inviteId = params.get('invite');
    if(inviteId && inviteId !== currentUserId){
      const alreadyFriend = myFriendIds && myFriendIds.has(inviteId);
      const alreadyRequested = outgoingRequestIds && outgoingRequestIds.has(inviteId);
      if(!alreadyFriend && !alreadyRequested){
        await sendFriendRequest(inviteId);
        history.replaceState(null, '', location.pathname + location.hash);
      } else {
        history.replaceState(null, '', location.pathname + location.hash);
      }
    }
  }catch(e){}
}

/* ---- Apple Music / iTunes search (album + song lookup) ----
   Uses the public iTunes Search API via JSONP (no auth/token needed,
   and JSONP sidesteps the CORS restrictions the plain fetch endpoint has). */
function itunesJsonp(url){
  return new Promise((resolve, reject)=>{
    const cbName = 'itunesCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{
      delete window[cbName];
      script.remove();
    };
    window[cbName] = (data)=>{
      settled = true;
      cleanup();
      resolve(data);
    };
    script.onerror = ()=>{
      if(!settled){ settled = true; cleanup(); reject(new Error('itunes_request_failed')); }
    };
    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{
      if(!settled){ settled = true; cleanup(); reject(new Error('itunes_request_timed_out')); }
    }, 10000);
  });
}
async function itunesFetch(url){
  const cleanUrl = url.replace(/&callback=[^&]*/, '');
  const res = await fetch(cleanUrl, { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('itunes_http_' + res.status);
  return await res.json();
}
async function itunesFetchProxy(url){
  const cleanUrl = url.replace(/&callback=[^&]*/, '');
  const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(cleanUrl);
  const res = await fetch(proxyUrl);
  if(!res.ok) throw new Error('itunes_proxy_' + res.status);
  return await res.json();
}
async function itunesSearch(term, entity, limit){
  const url = 'https://itunes.apple.com/search?media=music&entity=' + entity + '&limit=' + (limit||8) + '&term=' + encodeURIComponent(term);
  let data = null;
  try{ data = await itunesJsonp(url); }catch(e){
    try{ data = await itunesFetch(url); }catch(e2){
      try{ data = await itunesFetchProxy(url); }catch(e3){ throw e3; }
    }
  }
  const results = (data && data.results) || [];
  if(entity === 'song') return results.filter(r=>r.wrapperType==='track' && r.kind!=='music-video');
  if(entity === 'album') return results.filter(r=>r.wrapperType==='collection');
  return results;
}
async function deezerSearch(q, limit){
  const url = 'https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=' + (limit||25);
  const data = await new Promise((resolve, reject)=>{
    const cbName = 'dzCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_jsonp_failed')); } };
    script.src = 'https://api.deezer.com/search?q=' + encodeURIComponent(q) + '&limit=' + (limit||25) + '&output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_timeout')); } }, 4000);
  });
  return (data.data || []).map(r=>({
    trackId: 'dz-' + r.id,
    trackName: r.title || 'Untitled',
    artistName: (r.artist && r.artist.name) || '',
    collectionName: (r.album && r.album.title) || '',
    releaseDate: '',
    primaryGenreName: '',
    artworkUrl100: r.album && r.album.cover_medium ? r.album.cover_medium.replace(/\/\d+x\d+bb/, '/150x150bb') : null,
    previewUrl: r.preview || null,
    trackViewUrl: r.link || null,
    explicit: r.explicit === true || r.explicit === 1
  }));
}
async function deezerChartArtists(limit){
  const data = await new Promise((resolve, reject)=>{
    const cbName = 'dzArtCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_chart_jsonp_failed')); } };
    script.src = 'https://api.deezer.com/chart/0/artists?limit=' + (limit||10) + '&output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_chart_timeout')); } }, 6000);
  });
  return (data.data || []).map(r=>({
    artistId: r.id,
    artistName: (r.name || '').trim(),
    picture: r.picture_big || r.picture_medium || null
  }));
}
async function deezerArtistTopTracks(artistId, limit){
  const data = await new Promise((resolve, reject)=>{
    const cbName = 'dzTopCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_top_jsonp_failed')); } };
    script.src = 'https://api.deezer.com/artist/' + encodeURIComponent(artistId) + '/top?limit=' + (limit||5) + '&output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_top_timeout')); } }, 6000);
  });
  return (data.data || []).map(r=>({
    title: r.title || 'Untitled',
    artistName: (r.artist && r.artist.name) || '',
    albumName: (r.album && r.album.title) || '',
    coverArt: (r.album && (r.album.cover_medium || r.album.cover_small)) || null,
    previewUrl: r.preview || '',
    explicit: r.explicit === true || r.explicit === 1,
    durationSec: r.duration || 0
  }));
}
function pullTopArtistsDaily(){
  if(!sb || !currentUserId) return;
  const KEY = 'bayoutonefm-topartists-daily-v2-' + currentUserId;
  let last = 0;
  try{ last = Number(localStorage.getItem(KEY) || 0); }catch(e){}
  if(last && (Date.now() - last) < 86400000) return; // once per day
  const done = ()=>{ try{ localStorage.setItem(KEY, String(Date.now())); }catch(e){} };
  const ARTISTS = 10;
  const TRACKS = 5;
  const DELAY = 400;
  const push = (songObj) => { syncToSongDb(songObj, null); upsertGlobalSong(songObj, null); };
  deezerChartArtists(ARTISTS)
    .then(artists => {
      if(!artists || !artists.length) throw new Error('no top artists returned');
      let total = 0, i = 0;
      const nextArtist = ()=>{
        if(i >= artists.length){
          done();
          console.log('[topArtists] pulled top tracks from', artists.length, 'artists (' + total + ' tracks) into the database');
          return;
        }
        const artist = artists[i++];
        deezerArtistTopTracks(artist.artistId, TRACKS)
          .then(tracks => {
            (tracks || []).forEach(t => {
              const a = (t.artistName || artist.artistName || '').trim();
              if(!t.title || !a) return;
              const songObj = {
                title: (t.title || '').trim(),
                artists: [a],
                album: t.albumName || '',
                coverArt: t.coverArt || null,
                previewUrl: t.previewUrl || '',
                explicit: !!t.explicit,
                duration: t.durationSec ? (
                  t.durationSec > 3600
                    ? Math.floor(t.durationSec/3600) + ':' + String(Math.floor((t.durationSec%3600)/60)).padStart(2,'0') + ':' + String(t.durationSec%60).padStart(2,'0')
                    : Math.floor(t.durationSec/60) + ':' + String(t.durationSec%60).padStart(2,'0')
                ) : ''
              };
              push(songObj);
              total++;
            });
            setTimeout(nextArtist, DELAY);
          })
          .catch(()=> setTimeout(nextArtist, DELAY));
      };
      nextArtist();
    })
    .catch(e => console.error('[topArtists] pull failed:', e));
}
async function deezerAlbumSearch(q, limit){
  const url = 'https://api.deezer.com/search/album?q=' + encodeURIComponent(q) + '&limit=' + (limit||8);
  const data = await new Promise((resolve, reject)=>{
    const cbName = 'dzAlbCb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_alb_jsonp_failed')); } };
    script.src = 'https://api.deezer.com/search/album?q=' + encodeURIComponent(q) + '&limit=' + (limit||8) + '&output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('deezer_alb_timeout')); } }, 10000);
  });
  return (data.data || []).map(r=>({
    collectionId: 'dza-' + r.id,
    collectionName: r.title || 'Untitled album',
    artistName: (r.artist && r.artist.name) || '',
    releaseDate: r.release_date || '',
    primaryGenreName: '',
    artworkUrl100: r.cover_medium || r.cover_small || null
  }));
}
async function lookupItunesAlbum(collectionId){
  const url = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(collectionId) + '&entity=song&limit=200';
  let data = null;
  try{ data = await itunesJsonp(url); }catch(e){
    try{ data = await itunesFetch(url); }catch(e2){
      try{ data = await itunesFetchProxy(url); }catch(e3){ throw e3; }
    }
  }
  return (data && data.results) || [];
}
function upscaleArtwork(url){
  return url ? url.replace(/\d+x\d+bb(?=\.\w+$)/, '150x150bb') : null;
}

/* ---- MusicBrainz fallback (song + album lookup) ----
   iTunes' JSONP lookup can fail on some mobile browsers/blocked networks.
   MusicBrainz + Cover Art Archive are CORS-friendly (Access-Control-Allow-Origin: *),
   so this gives every search a working fallback that also pulls in art. */
async function mbFetchJson(url){
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('mb_http_' + res.status);
  return await res.json();
}
async function mbReleaseCover(releaseId){
  try{
    const res = await fetch('https://coverartarchive.org/release/' + releaseId + '/front-250');
    if(res.ok) return res.url;
  }catch(e){}
  return null;
}
function mbArtistName(credit){
  return Array.isArray(credit) && credit.length ? (credit[0].artist && credit[0].artist.name) || credit[0].name || '' : '';
}
function mbRecordingToItunesShape(rec){
  const release = (rec.releases && rec.releases[0]) || null;
  const date = (release && release.date) || '';
  return {
    trackId: 'mb-' + (rec.id || ''),
    trackName: rec.title || 'Unknown song',
    artistName: mbArtistName(rec['artist-credit']),
    collectionName: (release && release.title) || '',
    releaseDate: date,
    primaryGenreName: (rec.tags && rec.tags[0] && rec.tags[0].name) || '',
    artworkUrl100: null,
    trackViewUrl: rec.id ? 'https://musicbrainz.org/recording/' + rec.id : null
  };
}
async function mbSearchSongs(q){
  const url = 'https://musicbrainz.org/ws/2/recording/?query=' + encodeURIComponent(q) + '&fmt=json&limit=8';
  const data = await mbFetchJson(url);
  const rows = (data.recordings || []).map(mbRecordingToItunesShape);
  const covers = await Promise.all(rows.map(r=>{
    const rec = (data.recordings || []).find(x=>'mb-' + (x.id||'') === String(r.trackId));
    const rel = rec && rec.releases && rec.releases[0];
    return rel ? mbReleaseCover(rel.id) : null;
  }));
  rows.forEach((r,i)=>{ if(covers[i]) r.artworkUrl100 = covers[i]; });
  return rows;
}
async function mbAlbumToItunesShape(rg){
  const date = rg['first-release-date'] || '';
  const release = (rg.releases && rg.releases[0]) || null;
  return {
    collectionId: 'mbg-' + (rg.id || ''),
    collectionName: rg.title || 'Untitled album',
    artistName: mbArtistName(rg['artist-credit']),
    releaseDate: date,
    artworkUrl100: release ? await mbReleaseCover(release.id) : null
  };
}
async function mbSearchAlbums(q){
  const url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=8';
  const data = await mbFetchJson(url);
  const groups = (data['release-groups'] || []).filter(g=>!g['primary-type'] || g['primary-type'] === 'Album');
  return await Promise.all(groups.map(mbAlbumToItunesShape));
}
async function mbLoadAlbum(groupId){
  const id = groupId.replace(/^mbg-/, '');
  const g = await mbFetchJson('https://musicbrainz.org/ws/2/release-group/' + encodeURIComponent(id) + '?inc=releases&fmt=json');
  const release = (g.releases && g.releases[0]) || null;
  const albumInfo = {
    collectionName: g.title || '',
    artistName: mbArtistName(g['artist-credit']),
    releaseDate: g['first-release-date'] || (release && release.date) || '',
    primaryGenreName: (g.tags && g.tags[0] && g.tags[0].name) || '',
    artworkUrl100: release ? await mbReleaseCover(release.id) : null
  };
  let tracks = [];
  if(release){
    const r = await mbFetchJson('https://musicbrainz.org/ws/2/release/' + encodeURIComponent(release.id) + '?inc=recordings+artist-credits&fmt=json');
    const media = r.media || [];
    tracks = media.reduce((acc,m)=>{
      (m.tracks || []).forEach(t=>{
        const title = t.title || (t.recording && t.recording.title) || '';
        const artist = mbArtistName(t['artist-credit'] || (t.recording && t.recording['artist-credit']));
        if(title) acc.push({ title, artist });
      });
      return acc;
    }, []);
  }
  return { albumInfo, tracks };
}

/* ---- album search (for "New Album" import) ---- */
let albumSearchDebounce = null;
async function renderAlbumSearchResults(query){
  const wrap = document.getElementById('albumSearchResults');
  const q = query.trim();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'block';
  wrap.innerHTML = '<p class="profile-empty-note">Searching…</p>';
  let albums;
  try{
    albums = await deezerAlbumSearch(q, 8);
  }catch(e){
    albums = null;
  }
  if(!albums || albums.length === 0){
    try{
      albums = await itunesSearch(q, 'album', 8);
    }catch(e2){}
  }
  if(!albums || albums.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching albums.</p>';
    return;
  }
  wrap.innerHTML = albums.map(a=>`
      <button type="button" class="discover-row" data-collection-id="${a.collectionId}">
        ${a.artworkUrl100 ? `<img loading="lazy" decoding="async" src="${a.artworkUrl100}" alt="Album cover">` : `<span class="drow-fallback">${escapeHtml((a.collectionName||'?').charAt(0).toUpperCase())}</span>`}
        <span>
          <span class="drow-name">${escapeHtml(a.collectionName||'Untitled')}</span><br>
          <span class="drow-bio">${escapeHtml(a.artistName||'')}${a.releaseDate ? ' · '+a.releaseDate.slice(0,4) : ''}</span>
        </span>
        ${String(a.collectionId).indexOf('mbg-') !== 0 ? `<span class="preview-btn" data-preview="albs:${escapeAttr(a.collectionId)}" title="Play the first track as a 30-second preview" aria-label="Play a 30-second preview">▶︎</span>` : ''}
      </button>
    `).join('');
}
window.albumPreviewSong = async function(id){
  const collectionId = String(id).slice(5);
  try{
    const items = await lookupItunesAlbum(collectionId);
    const t = items.filter(x=>x.wrapperType==='track').sort((a,b)=>(a.trackNumber||0)-(b.trackNumber||0)).find(x=>x.previewUrl);
    if(!t) return null;
    return { id, title: t.trackName || 'Unknown song', artists: [t.artistName || ''], previewUrl: t.previewUrl || '' };
  }catch(e){ return null; }
};
async function selectItunesAlbum(collectionId){
  const wrap = document.getElementById('albumSearchResults');
  wrap.innerHTML = '<p class="profile-empty-note">Loading album…</p>';
  try{
    let albumInfo, tracks;
    if(String(collectionId).indexOf('mbg-') === 0){
      const mb = await mbLoadAlbum(collectionId);
      albumInfo = mb.albumInfo;
      tracks = mb.tracks;
    } else {
      const items = await lookupItunesAlbum(collectionId);
      albumInfo = items.find(x=>x.wrapperType==='collection') || items[0] || {};
      const trackItems = items.filter(x=>x.wrapperType==='track').sort((a,b)=>(a.trackNumber||0)-(b.trackNumber||0));
      tracks = trackItems.map(t=>({ title: t.trackName, artist: t.artistName || albumInfo.artistName || '', no: t.trackNumber || null, label: albumInfo.recordLabel || '' }));
    }
    const cover = albumInfo.artworkUrl100 ? upscaleArtwork(albumInfo.artworkUrl100) : null;
    document.getElementById('mf-album').value = albumInfo.collectionName || '';
    document.getElementById('mf-year').value = albumInfo.releaseDate ? albumInfo.releaseDate.slice(0,4) : '';
    document.getElementById('mf-release-date').value = albumInfo.releaseDate || '';
    document.getElementById('mf-genre').value = albumInfo.primaryGenreName || '';
    document.getElementById('mf-artist').value = albumInfo.artistName || '';
    document.getElementById('mf-label').value = albumInfo.recordLabel || '';
    currentMultiCoverArt = cover;
    setImagePreview('mf-cover', cover);
    resetTitleBoxes(tracks);
    document.getElementById('mf-album-search').value = albumInfo.collectionName || '';
    wrap.style.display = 'none';
    wrap.innerHTML = '';
  }catch(e){
    wrap.innerHTML = `<p class="profile-empty-note">Could not load that album${e && e.message ? ': ' + escapeHtml(e.message) : ''}.</p>`;
  }
}
document.getElementById('mf-album-search').addEventListener('input', e=>{
  clearTimeout(albumSearchDebounce);
  const val = e.target.value;
  albumSearchDebounce = setTimeout(()=>renderAlbumSearchResults(val), 350);
});
document.getElementById('albumSearchResults').addEventListener('click', e=>{
  if(e.target.closest('[data-preview]')) return;
  const row = e.target.closest('[data-collection-id]');
  if(!row) return;
  selectItunesAlbum(row.dataset.collectionId);
});

/* ---- song search (for the single "Add a song" / "Edit song" modal) ---- */
let songSearchDebounce = null;
let songSearchCache = [];
async function renderSongSearchResults(query){
  const wrap = document.getElementById('songSearchResults');
  const q = query.trim();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  wrap.style.display = 'block';
  wrap.innerHTML = '<p class="profile-empty-note">Searching…</p>';
  const appleTrackMatch = q.match(/music\.apple\.com\/.*\/album\/.*\/(\d+)(?:\?i=(\d+))?/);
  const ytMatch = q.match(/(?:music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+)/);
  if((appleTrackMatch && appleTrackMatch[2]) || ytMatch){
    try{
      let trackData = null;
      if(appleTrackMatch && appleTrackMatch[2]){
        const resp = await fetch('https://itunes.apple.com/lookup?id=' + appleTrackMatch[2] + '&entity=song');
        if(resp.ok){
          const d = await resp.json();
          if(d.results&&d.results.length){ const t=d.results[0]; trackData = { title:t.trackName, artists:[t.artistName], album:t.collectionName||'', year:t.releaseDate||'', releaseDate:t.releaseDate||'', coverArt:t.artworkUrl100||null, explicit:!!t.trackExplicitness, previewUrl:t.previewUrl||'', appleMusicUrl:t.trackViewUrl||'' }; }
        }
      }
      if(trackData){
        document.getElementById('songSearchResults').style.display='none';
        document.getElementById('songSearchResults').innerHTML='';
        openAddFromData(trackData);
        if(trackData.appleMusicUrl) document.getElementById('f-apple').value=trackData.appleMusicUrl;
        if(trackData.youtubeMusicUrl) document.getElementById('f-youtube').value=trackData.youtubeMusicUrl;
        return;
      }
    }catch(e){ console.warn('URL lookup failed:', e); }
  }
  if(ytMatch && !trackUrlMatch && !(appleTrackMatch && appleTrackMatch[2])){
    const videoId = ytMatch[1] || ytMatch[2];
    let title = '';
    try{
      const resp = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+videoId+'&format=json');
      if(resp.ok){ const d = await resp.json(); title = d.title || ''; }
    }catch(e){}
    document.getElementById('songSearchResults').style.display='none';
    document.getElementById('songSearchResults').innerHTML='';
    openAddFromData({ title:title, artists:[], youtubeMusicUrl:q });
    document.getElementById('f-youtube').value = q;
    return;
  }
  const playlistUrl = q.match(/(music\.apple\.com\/.*\/playlist|tidal\.com\/.*\/playlist|music\.youtube\.com\/playlist|youtube\.com\/playlist)/);
  if(playlistUrl){
    document.getElementById('songSearchResults').style.display='none';
    document.getElementById('songSearchResults').innerHTML='';
    document.getElementById('spotify-url-input').value = q;
    document.getElementById('spotifyImportOverlay').classList.add('open');
    document.getElementById('spotify-url-input').dispatchEvent(new Event('input'));
    return;
  }
  let results;
  try{
    const globalResults = await searchGlobalSongs(q, 25);
    if(globalResults && globalResults.length){
      results = globalResults.map(g => ({
        trackName: g.title,
        artistName: g.artist,
        collectionName: g.album || '',
        artworkUrl100: g.cover_art || '',
        previewUrl: '',
        releaseDate: g.year ? g.year + '-01-01' : '',
        primaryGenreName: (g.genres && g.genres[0]) || '',
        trackId: 'gs-' + g.id,
        explicit: g.explicit || false
      }));
    }
  }catch(e){}
  if(!results || results.length === 0){
    try{
      results = await deezerSearch(q, 25);
    }catch(e){
      console.error('Deezer search failed:', e);
      results = null;
    }
  }
  if(!results || results.length === 0){
    try{
      results = await itunesSearch(q, 'song', 25);
    }catch(e2){
      console.error('iTunes search failed:', e2);
    }
  }
  songSearchCache = results || [];
  if(!results || results.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching songs.</p><button type="button" class="discover-row" id="manualAddBtn" style="cursor:pointer;"><span class="drow-name">+ Add it manually</span><span class="drow-bio">Enter the details yourself</span></button>';
    return;
  }
  const seen = new Set();
  const unique = results.filter(t=>{
    const key = (t.trackName||'').toLowerCase().trim() + '|||' + (t.artistName||'').toLowerCase().trim();
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const qNorm = q.toLowerCase().trim();
  const qWords = q.toLowerCase().split(/\s+/).filter(w=>w.length > 1);
  unique.sort((a,b)=>{
    const aT = (a.trackName||'').toLowerCase().trim();
    const aA = (a.artistName||'').toLowerCase().trim();
    const bT = (b.trackName||'').toLowerCase().trim();
    const bA = (b.artistName||'').toLowerCase().trim();
    let aScore = 0, bScore = 0;
    if(aT === qNorm) aScore += 10; else if(aT.startsWith(qNorm)) aScore += 8; else if(aT.includes(qNorm)) aScore += 4;
    if(bT === qNorm) bScore += 10; else if(bT.startsWith(qNorm)) bScore += 8; else if(bT.includes(qNorm)) bScore += 4;
    aScore += qWords.filter(w=> aT.includes(w)).length;
    bScore += qWords.filter(w=> bT.includes(w)).length;
    aScore += qWords.filter(w=> aA.includes(w)).length * 2;
    bScore += qWords.filter(w=> bA.includes(w)).length * 2;
    if(aT === qNorm && bT === qNorm) aScore += aA.length < bA.length ? 3 : aA.length > bA.length ? -3 : 0;
    if(bT === qNorm && aT === qNorm) bScore += bA.length < aA.length ? 3 : bA.length > aA.length ? -3 : 0;
    return bScore - aScore;
  });
  songSearchCache = unique;
  wrap.innerHTML = unique.map((t, i)=>`
    <button type="button" class="discover-row" data-track-id="${t.trackId}">
      ${t.artworkUrl100 ? `<img loading="lazy" decoding="async" src="${t.artworkUrl100}" alt="Album cover">` : `<span class="drow-fallback">${escapeHtml((t.trackName||'?').charAt(0).toUpperCase())}</span>`}
      <span>
        <span class="drow-name">${escapeHtml(t.trackName||'Untitled')}</span><br>
        <span class="drow-bio">${escapeHtml(t.artistName||'')}${t.collectionName ? ' · '+escapeHtml(t.collectionName) : ''}</span>
      </span>
      ${t.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
      <span class="preview-btn" data-preview="songsearch:${i}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</span>
    </button>
  `).join('');
}
function selectItunesSong(trackId){
  const t = songSearchCache.find(r=>String(r.trackId)===String(trackId));
  if(!t) return;
  currentSongSource = 'itunes';
  currentExplicit = !!t.explicit;
  document.getElementById('f-title').value = t.trackName || '';
  document.getElementById('f-artist').value = t.artistName || '';
  document.getElementById('f-album').value = t.collectionName || '';
  document.getElementById('f-year').value = t.releaseDate ? t.releaseDate.slice(0,4) : '';
  document.getElementById('f-release-date').value = t.releaseDate || '';
  document.getElementById('f-track').value = t.trackNumber || '';
  document.getElementById('f-genre').value = t.primaryGenreName || '';
  document.getElementById('f-label').value = t.recordLabel || '';
  const cover = t.artworkUrl100 ? upscaleArtwork(t.artworkUrl100) : null;
  currentCoverArt = cover;
  setImagePreview('f-cover', cover);
  const expBtn = document.getElementById('f-explicit-btn');
  const expLabel = document.getElementById('f-explicit-label');
  expBtn.classList.toggle('on', currentExplicit);
  expLabel.textContent = currentExplicit ? 'Explicit' : 'Not explicit';
  document.getElementById('f-song-search').value = t.trackName || '';
  document.getElementById('songSearchResults').style.display = 'none';
  document.getElementById('songSearchResults').innerHTML = '';
}
document.getElementById('f-song-search').addEventListener('input', e=>{
  clearTimeout(songSearchDebounce);
  const val = e.target.value;
  songSearchDebounce = setTimeout(()=>renderSongSearchResults(val), 350);
});
document.getElementById('songSearchResults').addEventListener('click', e=>{
  if(e.target.closest('[data-preview]')) return;
  if(e.target.closest('#manualAddBtn')){
    document.getElementById('songSearchResults').style.display = 'none';
    document.getElementById('songSearchResults').innerHTML = '';
    document.getElementById('f-title').focus();
    return;
  }
  const row = e.target.closest('[data-track-id]');
  if(!row) return;
  selectItunesSong(row.dataset.trackId);
});

document.getElementById('resetCataloguexBtn').addEventListener('click', ()=>{
  trackEvent('reset_cataloguex');
  const ok = confirm("Reset your cataloguex back to the built-in examples? This will delete every song and person you've added, along with all the details you've put in — tiers, notes, tags, and everything else. This can't be undone.");
  if(!ok) return;
  songs = [];
  people = [];
  clusterFilterId = null;
  remindsFilterId = null;
  showArchived = false;
  setExamplesRemoved(false);
  seedPeopleIfEmpty();
  seedIfEmpty();
  save();
  savePeople();
  render();
  renderPeople();

});

function updateEmailConfirmBanner(user){
  const banner = document.getElementById('emailConfirmBanner');
  if(!banner || !user){ if(banner) banner.style.display = 'none'; return; }
  const confirmed = user.email_confirmed_at || user.confirmed_at;
  const resendBtn = document.getElementById('emailConfirmResend');
  const title = banner.querySelector('.email-confirm-title');
  const note = banner.querySelector('.email-confirm-note');
  if(confirmed){
    if(emailWasPending){
      banner.classList.add('is-confirmed'); banner.classList.remove('is-pending');
      title.textContent = 'Email confirmed';
      note.textContent = 'Your email is verified — you\'re all set!';
      if(resendBtn) resendBtn.style.display = 'none';
      banner.style.display = '';
      setTimeout(()=>{ banner.style.display = 'none'; }, 4000);
    } else {
      banner.style.display = 'none';
    }
    emailWasPending = false;
  } else {
    emailWasPending = true;
    banner.classList.add('is-pending'); banner.classList.remove('is-confirmed');
    title.textContent = 'Confirm your email address';
    note.textContent = 'We sent a confirmation link to ';
    const b = document.createElement('b'); b.textContent = user.email || 'your email';
    note.appendChild(b);
    note.appendChild(document.createTextNode('. Open it to activate your account.'));
    if(resendBtn) resendBtn.style.display = '';
    banner.style.display = '';
  }
}

document.getElementById('emailConfirmResend').addEventListener('click', async (e)=>{
  const btn = e.currentTarget;
  const status = document.getElementById('emailConfirmStatus');
  if(!currentUserEmail){ if(status){ status.style.display=''; status.textContent='No email on file.'; } return; }
  btn.disabled = true; btn.textContent = '…';
  if(status){ status.style.display=''; status.textContent=''; }
  try{
    const { error } = await sb.auth.resend({ type:'signup', email: currentUserEmail });
    if(error){ if(status){ status.textContent = error.message || 'Could not resend. Try again.'; status.style.color = 'var(--rose)'; } }
    else { if(status){ status.textContent = 'Confirmation email sent — check your inbox (and spam).'; status.style.color = 'var(--on-ink)'; } }
  }catch(err){
    if(status){ status.textContent = 'Something went wrong. Try again.'; status.style.color = 'var(--rose)'; }
  }finally{
    btn.disabled = false; btn.textContent = 'Resend confirmation';
  }
});

sb.auth.onAuthStateChange((event, session)=>{
  if(event === 'PASSWORD_RECOVERY'){
    showRecoveryScreen();
    return;
  }
  if(event === 'SIGNED_OUT'){
    currentUserId = null;
    myProfile = null;
    appBootedFor = null;
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(CUSTOM_THEMES_KEY);
    applyTheme(DEFAULT_THEME);
    showSotdScheduleBtn();
    if(typeof syncCDButton === 'function') syncCDButton();
    unsubscribeNotifications();
    if(window.stopMsgRealtime) window.stopMsgRealtime();
    showAuthScreen();
  }
  if(session && session.user){
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    const acp = document.getElementById('auth-confirm-password'); if(acp) acp.value = '';
    setAuthError(null); setAuthMessage(null);
    loadAppForUser(session.user);
  } else {
    currentUserId = null;
    myProfile = null;
    appBootedFor = null;
    localStorage.removeItem(THEME_KEY);
    localStorage.removeItem(CUSTOM_THEMES_KEY);
    applyTheme(DEFAULT_THEME);
    showSotdScheduleBtn();
    if(typeof syncCDButton === 'function') syncCDButton();
    if(typeof syncUpdatesLogButton === 'function') syncUpdatesLogButton();
    unsubscribeNotifications();
    if(window.stopMsgRealtime) window.stopMsgRealtime();
    showAuthScreen();
  }
});

sb.auth.getSession().then(({ data: { session } })=>{
  if(session && session.user){
    loadAppForUser(session.user);
  } else {
    const username = usernameFromRoute();
    if(username){
      openPublicCataloguex(username);
    } else {
      showAuthScreen();
    }
  }
});

/* ---- UPDATES LOG (testers read it, samannleblanc posts) ---- */
(function(){
  const LOG_SYMBOLS = { broken:'✕', fixing:'○', working:'✓' };
  const LOG_NEXT = { broken:'fixing', fixing:'working', working:'broken' };
  const LOG_STATES = ['broken','fixing','working'];
  let updatesLogEntries = [];
  let updatesLogRealtime = null;

  function updatesLogOwner(){
    return !!(myProfile && myProfile.username === 'samannleblanc');
  }
  function canSeeUpdatesLog(){
    return updatesLogOwner()
      || ((typeof isCertifiedTester === 'function') && isCertifiedTester());
  }
  window.syncUpdatesLogButton = function(){
    const btn = document.getElementById('updatesLogBtn');
    if(!btn) return;
    btn.style.display = canSeeUpdatesLog() ? '' : 'none';
  };

  function updatesLogDate(iso){
    try{ return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); }
    catch(e){ return ''; }
  }
  function renderUpdatesLogEntry(entry){
    const status = LOG_STATES.indexOf(entry.status) !== -1 ? entry.status : 'broken';
    const sym = LOG_SYMBOLS[status];
    const isOwner = updatesLogOwner();
    return `<div class="updates-log-entry">
      <div class="updates-log-main">
        <div class="updates-log-title">${escapeHtml(entry.title || 'Untitled')}</div>
        ${entry.body ? `<div class="updates-log-body">${escapeHtml(entry.body)}</div>` : ''}
        <div class="updates-log-meta">${updatesLogDate(entry.updated_at || entry.created_at)}</div>
      </div>
      <button type="button" class="updates-log-status ${status}${isOwner ? ' clickable' : ''}" data-log-status="${escapeAttr(entry.id)}" title="${isOwner ? 'Click to cycle: ✕ broken → ○ fixing → ✓ working' : status}" aria-label="Status: ${status}">${sym}</button>
    </div>`;
  }
  function rerenderLogList(){
    const list = document.getElementById('updatesLogList');
    if(!list) return;
    if(updatesLogEntries.length === 0){
      list.innerHTML = '<p class="updates-log-empty">No updates yet — they\'ll show up here as soon as they\'re posted.</p>';
      return;
    }
    list.innerHTML = updatesLogEntries.map(renderUpdatesLogEntry).join('');
  }
  async function loadUpdatesLog(){
    const list = document.getElementById('updatesLogList');
    if(!list) return;
    list.innerHTML = '<p class="updates-log-empty">Loading…</p>';
    try{
      const { data, error } = await sb
        .from('updates_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if(error) throw error;
      updatesLogEntries = data || [];
      rerenderLogList();
    }catch(err){
      console.error('Could not load updates log:', err);
      list.innerHTML = '<p class="updates-log-empty">Couldn\'t load the updates log — try again in a bit.</p>';
    }
  }
  function startUpdatesLogRealtime(){
    if(!sb || !currentUserId || updatesLogRealtime) return;
    try{
      updatesLogRealtime = sb.channel('updates-log')
        .on('postgres_changes', { event:'*', schema:'public', table:'updates_log' }, ()=>{
          const ov = document.getElementById('updatesLogOverlay');
          if(ov && ov.classList.contains('open')) loadUpdatesLog();
        })
        .subscribe();
    }catch(e){ updatesLogRealtime = null; }
  }
  function openUpdatesLog(){
    trackEvent('open_updates_log');
    const composer = document.getElementById('updatesLogComposer');
    if(composer) composer.style.display = updatesLogOwner() ? '' : 'none';
    const overlay = document.getElementById('updatesLogOverlay');
    if(overlay) overlay.classList.add('open');
    loadUpdatesLog();
    startUpdatesLogRealtime();
  }
  window.openUpdatesLog = openUpdatesLog;
  function closeUpdatesLog(){
    const overlay = document.getElementById('updatesLogOverlay');
    if(overlay) overlay.classList.remove('open');
  }
  async function postUpdatesLogEntry(){
    if(!updatesLogOwner()) return;
    const titleEl = document.getElementById('updatesLogTitle');
    const bodyEl = document.getElementById('updatesLogBody');
    const btn = document.getElementById('updatesLogPostBtn');
    if(!titleEl || !bodyEl || !btn) return;
    const title = titleEl.value.trim();
    const body = bodyEl.value.trim();
    if(!title){ titleEl.focus(); return; }
    btn.disabled = true;
    try{
      const { data, error } = await sb.from('updates_log').insert({
        title: title,
        body: body,
        status: 'fixing',
        created_by: currentUserId
      }).select().single();
      if(error) throw error;
      titleEl.value = '';
      bodyEl.value = '';
      updatesLogEntries.unshift(data);
      rerenderLogList();
      trackEvent('updates_log_post');
    }catch(err){
      console.error('Could not post update:', err);
      if(typeof showToast === 'function') showToast('Couldn\'t post the update — try again.', 3200);
    }finally{
      btn.disabled = false;
    }
  }
  async function cycleUpdatesLogStatus(id){
    if(!updatesLogOwner()) return;
    const entry = updatesLogEntries.find(e=>e.id === id);
    if(!entry) return;
    const next = LOG_NEXT[entry.status] || 'fixing';
    const prev = entry.status;
    entry.status = next;
    rerenderLogList();
    try{
      const { error } = await sb.from('updates_log').update({ status: next }).eq('id', id);
      if(error){
        console.error('Could not update status:', error);
        entry.status = prev;
        rerenderLogList();
      }
    }catch(e){
      entry.status = prev;
      rerenderLogList();
    }
  }
  function initUpdatesLogEvents(){
    const openBtn = document.getElementById('updatesLogBtn');
    if(openBtn) openBtn.addEventListener('click', openUpdatesLog);
    const closeBtn = document.getElementById('updatesLogCloseBtn');
    if(closeBtn) closeBtn.addEventListener('click', closeUpdatesLog);
    const postBtn = document.getElementById('updatesLogPostBtn');
    if(postBtn) postBtn.addEventListener('click', postUpdatesLogEntry);
    const list = document.getElementById('updatesLogList');
    if(list) list.addEventListener('click', e=>{
      const st = e.target.closest('[data-log-status]');
      if(st) cycleUpdatesLogStatus(st.getAttribute('data-log-status'));
    });
    const overlay = document.getElementById('updatesLogOverlay');
    if(overlay) overlay.addEventListener('click', e=>{ if(e.target === overlay) closeUpdatesLog(); });
    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape' && overlay && overlay.classList.contains('open')) closeUpdatesLog();
    });
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initUpdatesLogEvents);
  } else {
    initUpdatesLogEvents();
  }
})();


