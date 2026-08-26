
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
    trackEvent('logout');
    unsubscribeNotifications();
    myProfile = null;
  localStorage.removeItem(THEME_KEY);
  localStorage.removeItem(CUSTOM_THEMES_KEY);
  await sb.auth.signOut();
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
    if(!title || !artist) return;
    await sb.rpc('upsert_global_song', {
      p_title: title,
      p_artist: artist,
      p_album: (song.album || '').trim(),
      p_year: (song.year || '').toString().trim(),
      p_genres: song.genres || [],
      p_cover_art: song.coverArt || '',
      p_preview_url: song.previewUrl || '',
      p_explicit: song.explicit || false,
      p_added_by: userId || null,
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
    });
  }catch(e){ console.error('global_songs upsert failed:', e); }
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
    if(!title) return;
    sb.from('song_database').insert({
      title,
      artist: artist || '',
      album: (song.album || '').trim(),
      year: (song.year || '').toString().trim(),
      genres: song.genres || [],
      explicit: !!song.explicit,
      cover_art: song.coverArt || null,
      source: 'user',
      added_by: userId || null,
      producers: song.producer || '',
      songwriters: song.songwriters || '',
      bpm: song.bpm || null,
      key: song.musicKey || '',
      duration: song.duration || '',
      record_label: song.recordLabel || '',
      spotify_url: song.spotifyUrl || '',
      apple_music_url: song.appleMusicUrl || '',
      youtube_music_url: song.youtubeMusicUrl || '',
      tidal_url: song.tidalUrl || '',
      release_date: song.releaseDate || '',
      artist_website: song.artistWebsite || '',
      track_number: song.trackNumber ? String(song.trackNumber) : ''
    }).then(({error})=>{
      if(error && error.code !== '23505') console.error('[syncToSongDb] insert error:', error.message);
    });
  }catch(e){}
}
function syncToSongDbBatch(songsList, userId){
  if(!songsList || !songsList.length) return;
  songsList.forEach(s => syncToSongDb(s, userId));
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

async function doSync(attempt, startRevision){
  if(!currentUserId) return;
  if(syncInFlight) return; // already uploading; post-success check will re-sync if needed
  syncInFlight = true;
  setSyncStatus('syncing');
  try{
    const updated = new Date().toISOString();
    const localIds = new Set(songs.map(s=>s.id));
    let slimSongs = songs.map(slimSongForUpload);
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
      .select('user_id, username, bio, photo, theme, custom_themes')
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
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9998;background:var(--paper);color:var(--on-paper);border-bottom:1px solid var(--border);padding:14px 44px 14px 14px;font-family:"Space Grotesk",sans-serif;font-size:13px;line-height:1.5;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.15);word-break:break-word;';
  d.innerHTML = 'Please contact <a href="mailto:bayoutonefm@outlook.com" style="color:var(--teal);">bayoutonefm@outlook.com</a> with any bugs, questions, suggestions, or concerns. We are always happy to help. Thanks! :)';
  var x = document.createElement('button');
  x.textContent = '\u00d7';
  x.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;cursor:pointer;color:var(--on-paper);padding:4px 8px;line-height:1;';
  x.addEventListener('click', function(){ d.remove(); });
  d.appendChild(x);
  document.body.appendChild(d);
  setTimeout(function(){ d.style.transition='opacity 0.3s'; d.style.opacity='0'; setTimeout(function(){ d.remove(); }, 300); }, 8000);
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
  await ensureUserRow(user.id);
  const remote = await fetchUserData(user.id);
  songs = (remote && remote.songs) || [];
  if(examplesRemoved()){
    const before = songs.length;
    songs = songs.filter(s=>!s.isSeedExample);
    if(songs.length !== before) console.warn('Stripped ' + (before - songs.length) + ' example songs from Supabase data');
  }
  // Sync localStorage to match Supabase (Supabase is source of truth)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
  prefetchPreviews(songs);
  people = (remote && remote.people) || [];
  if(examplesRemoved()){
    const before = people.length;
    people = people.filter(p=>!String(p.id||'').startsWith('ex-'));
    if(people.length !== before) savePeople();
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

  const accepted = await ensureTermsAccepted(user);
  if(!accepted) return; // user chose to log out instead of accepting

  showApp();
  showLoginBanner();
  checkRoute();

  if(!myProfile || !myProfile.username){
    openOnboarding();
  } else if(!localStorage.getItem('usernameRedoDone_' + currentUserId) && localStorage.getItem(STORAGE_KEY)){
    localStorage.setItem('usernameRedoDone_' + currentUserId, '1');
    setTimeout(()=>{
      openOnboarding({ username: myProfile.username, bio: myProfile.bio || '', photo: myProfile.photo || null, promptMessage: 'Welcome back! Take a moment to review your username. You can keep it or pick a new one.' });
    }, 800);
  }

  subscribeNotifications();

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
  const trackUrlMatch = q.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/);
  const albumUrlMatch = q.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/);
  const appleTrackMatch = q.match(/music\.apple\.com\/.*\/album\/.*\/(\d+)(?:\?i=(\d+))?/);
  const ytMatch = q.match(/(?:music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+)/);
  if(trackUrlMatch || (appleTrackMatch && appleTrackMatch[2]) || ytMatch){
    try{
      let trackData = null;
      if(trackUrlMatch){
        const token = await fetchSpotifyToken();
        const resp = await fetch('https://api.spotify.com/v1/tracks/' + trackUrlMatch[1], { headers:{ Authorization:'Bearer '+token } });
        if(resp.ok){
          const t = await resp.json();
          trackData = { title:t.name, artists:(t.artists||[]).map(a=>a.name), album:(t.album&&t.album.name)||'', year:(t.album&&t.album.release_date)||'', coverArt:(t.album&&t.album.images&&t.album.images[0]&&t.album.images[0].url)||null, explicit:!!t.explicit, previewUrl:t.preview_url||'', spotifyUrl:t.external_urls&&t.external_urls.spotify||'' };
        }
      } else if(appleTrackMatch && appleTrackMatch[2]){
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
        if(trackData.spotifyUrl) document.getElementById('f-spotify').value=trackData.spotifyUrl;
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
  const playlistUrl = q.match(/(open\.spotify\.com\/playlist|music\.apple\.com\/.*\/playlist|tidal\.com\/.*\/playlist|music\.youtube\.com\/playlist|youtube\.com\/playlist)/);
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
    unsubscribeNotifications();
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


