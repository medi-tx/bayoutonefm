
/* =========================================================
   PROFILE: view / edit / onboarding / change password
   ========================================================= */
let currentEditProfilePhoto = null;
let currentOnboardingPhoto = null;

bindCoverInput('ep-photo-file', 'ep-photo', v=>currentEditProfilePhoto=v);
bindCoverInput('ob-photo-file', 'ob-photo', v=>currentOnboardingPhoto=v);

function renderMyProfileView(){
  const photo = myProfile && myProfile.photo;
  const username = (myProfile && myProfile.username) || '';
  const bio = (myProfile && myProfile.bio) || '';
  document.getElementById('myProfileViewPhoto').style.display = photo ? 'block' : 'none';
  if(photo) document.getElementById('myProfileViewPhoto').src = photo;
  document.getElementById('myProfileViewFallback').style.display = photo ? 'none' : 'flex';
  document.getElementById('myProfileViewFallback').textContent = '';
  document.getElementById('myProfileViewUsername').textContent = username ? '@'+username : '(no username set)';
  const bioEl = document.getElementById('myProfileViewBio');
  bioEl.textContent = bio || 'No bio yet.';
  bioEl.classList.toggle('empty', !bio);
  const linkedToMeBtn = document.getElementById('openLinkedToMeBtn');
  if(linkedToMeBtn) linkedToMeBtn.style.display = (username === 'samannleblanc') ? '' : 'none';
  renderMyBadges();
  renderMyObsessed();
  loadMyProfileSotdCount();
}
function pinnedSongs(list){
  return (list || []).filter(s=>s.favorited && !s.archived);
}
function obsessedChipHtml(s){
  const cover = s.coverArt
    ? `<img src="${escapeAttr(s.coverArt)}" alt="Album cover">`
    : `<span class="oc-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</span>`;
  return `<button type="button" class="obsessed-chip" data-obsessed="${escapeAttr(s.id)}" title="Open ${escapeAttr(s.title||'Untitled')}">
      ${cover}
      <span class="oc-meta">
        <span class="oc-title">${escapeHtml(s.title||'Untitled')}</span>
        <small>${escapeHtml(formatArtists(s.artists))}</small>
      </span>
    </button>`;
}
function renderMyObsessed(){
  const panel = document.getElementById('myObsessedPanel');
  const strip = document.getElementById('myObsessedStrip');
  if(!panel || !strip) return;
  const pinned = pinnedSongs(songs);
  if(pinned.length === 0){ panel.style.display = 'none'; strip.innerHTML = ''; return; }
  panel.style.display = '';
  strip.innerHTML = pinned.map(s=>obsessedChipHtml(s)).join('');
}
function renderMyBadges(){
  const row = document.getElementById('myBadgeRow');
  if(!row) return;
  row.innerHTML = badgeChipsHtml(songs);
}
document.getElementById('myObsessedStrip').addEventListener('click', e=>{
  trackEvent('obsessed_strip_click');
  const chip = e.target.closest('[data-obsessed]');
  if(!chip) return;
  document.getElementById('myProfileOverlay').classList.remove('open');
  viewingWishlist = false;
  viewingTierBoard = false;
  showArchived = false;
  clusterFilterId = null;
  remindsFilterId = null;
  const target = songs.find(s=>s.id === chip.dataset.obsessed);
  document.getElementById('search').value = target ? (target.title || '') : '';
  render();
  const card = document.getElementById('grid').querySelector('[data-id="' + CSS.escape(chip.dataset.obsessed) + '"]');
  if(card){
    card.scrollIntoView({ behavior:'smooth', block:'center' });
    card.classList.add('obsessed-flash');
    setTimeout(()=>card.classList.remove('obsessed-flash'), 2600);
  }
});
function cataloguexBadgeStats(list){
  const all = list || [];
  return {
    total: all.length,
    sCount: all.filter(s=>s.tier==='S').length,
    aCount: all.filter(s=>s.tier==='A').length,
    pinnedCount: all.filter(s=>s.favorited).length,
    tiersFilled: TIERS.filter(t=>all.some(s=>s.tier===t)).length
  };
}
function badgeDefs(){
  return [
    { id:'first-song',    icon:'🎧', label:'First song logged',      check:c=>c.total>=1 },
    { id:'songs-10',      icon:'🔟', label:'10 songs logged',        check:c=>c.total>=10 },
    { id:'songs-25',      icon:'📀', label:'25 songs logged',        check:c=>c.total>=25 },
    { id:'songs-50',      icon:'🎶', label:'50 songs logged',        check:c=>c.total>=50 },
    { id:'songs-100',     icon:'💿', label:'100 songs logged',       check:c=>c.total>=100 },
    { id:'songs-250',     icon:'🥉', label:'250 songs logged',       check:c=>c.total>=250 },
    { id:'songs-500',     icon:'🥈', label:'500 songs logged',       check:c=>c.total>=500 },
    { id:'songs-1000',    icon:'🏆', label:'1000 songs logged',      check:c=>c.total>=1000 },
    { id:'first-s-tier',  icon:'⭐', label:'First S-tier',            check:c=>c.sCount>=1 },
    { id:'first-a-tier',  icon:'✨', label:'First A-tier',            check:c=>c.aCount>=1 },
    { id:'first-favorite',icon:'💖', label:'First favorite',          check:c=>c.pinnedCount>=1 },
    { id:'all-tiers',     icon:'🌈', label:'Filled every tier',       check:c=>c.tiersFilled===5 }
  ];
}
function badgeChipsHtml(list){
  const c = cataloguexBadgeStats(list);
  return badgeDefs().map(b=>{
    const earned = b.check(c);
    return `<span class="badge-chip${earned ? '' : ' locked'}" title="${escapeAttr(b.label)}${earned ? '' : ' — not yet earned'}">${b.icon} ${escapeHtml(b.label)}</span>`;
  }).join('');
}
function todayDateStr(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
async function loadSotdReactionStats(userId){
  if(!sb || !userId) return null;
  const { data, error } = await sb.from('sotd_reactions').select('song_date').eq('user_id', userId);
  if(error || !data) return null;
  const dates = data.map(r=>String(r.song_date || '').slice(0,10)).filter(Boolean);
  const s = sotdStreakFromDates(new Set(dates), todayDateStr());
  return { count: dates.length, current: s.current, best: s.best };
}
async function loadMyProfileSotdCount(){
  const el = document.getElementById('myProfileSotdCount');
  if(!el || !sb || !currentUserId) return;
  const stats = await loadSotdReactionStats(currentUserId);
  if(!stats || stats.count === 0){ el.style.display = 'none'; return; }
  el.textContent = '🎵 Reacted to ' + stats.count + (stats.count === 1 ? ' song' : ' songs') + ' of the day · 🔥 ' + stats.current + '-day streak' + (stats.best > stats.current ? ' (best ' + stats.best + ')' : '');
  el.style.display = '';
}

document.getElementById('myProfileBtn').addEventListener('click', ()=>{
  trackEvent('open_my_profile');
  renderMyProfileView();
  document.getElementById('myProfileOverlay').classList.add('open');
});
document.getElementById('myProfileCloseBtn').addEventListener('click', ()=>{
  document.getElementById('myProfileOverlay').classList.remove('open');
});
document.getElementById('myProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='myProfileOverlay') document.getElementById('myProfileOverlay').classList.remove('open');
});
document.getElementById('shareProfileBtn').addEventListener('click', ()=>{
  trackEvent('share_profile_link');
  if(!myProfile || !myProfile.username) return;
  const url = location.origin + location.pathname + '#/u/' + encodeURIComponent(myProfile.username);
  navigator.clipboard.writeText(url).then(()=>{
    const wrap = document.getElementById('toastWrap');
    if(wrap){
      const el = document.createElement('div');
      el.className = 'toast';
      el.innerHTML = '<span class="toast-icon">🔗</span><div class="toast-body"><b>Profile link copied to clipboard!</b></div>';
      wrap.appendChild(el);
      setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity 0.3s'; setTimeout(()=>el.remove(), 300); }, 3000);
    }
  }).catch(()=>{
    prompt('Copy this link to share your profile:', url);
  });
});

function openEditProfile(){
  document.getElementById('myProfileOverlay').classList.remove('open');
  currentEditProfilePhoto = (myProfile && myProfile.photo) || null;
  document.getElementById('ep-username').value = (myProfile && myProfile.username) || '';
  document.getElementById('ep-bio').value = (myProfile && myProfile.bio) || '';
  setImagePreview('ep-photo', currentEditProfilePhoto);
  document.getElementById('ep-error').style.display = 'none';
  document.getElementById('editProfileOverlay').classList.add('open');
}
document.getElementById('openEditProfileBtn').addEventListener('click', ()=>{ trackEvent('open_edit_profile'); openEditProfile(); });
document.getElementById('editProfileCancelBtn').addEventListener('click', ()=>{
  document.getElementById('editProfileOverlay').classList.remove('open');
});
document.getElementById('editProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='editProfileOverlay') document.getElementById('editProfileOverlay').classList.remove('open');
});

/* ---- DATA EXPORT (GDPR Art. 20) ---- */
function mergeById(current, incoming, tsFn){
  const map = new Map();
  (current || []).forEach(x => { if(x && x.id) map.set(x.id, x); });
  (incoming || []).forEach(x => {
    if(!x || !x.id) return;
    const existing = map.get(x.id);
    if(!existing){ map.set(x.id, x); return; }
    const tExisting = tsFn(existing) || 0;
    const tIncoming = tsFn(x) || 0;
    if(tIncoming >= tExisting) map.set(x.id, x);
  });
  return Array.from(map.values());
}

document.getElementById('importDataBtn').addEventListener('click', ()=>{
  document.getElementById('importDataFile').click();
});
document.getElementById('importDataFile').addEventListener('change', async (e)=>{
  const file = e.target.files && e.target.files[0];
  if(!file){ return; }
  if(!confirm('Importing a backup will MERGE it with your current cataloguex (matched by id, keeping the newer version of each song/person). Nothing is deleted. Continue?')){
    e.target.value = ''; return;
  }
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const incomingSongs = data.cataloguex || data.songs || [];
    const incomingPeople = data.people || [];
    const incomingWish = data.wishlist || [];
    if(!Array.isArray(incomingSongs)) throw new Error('No songs found in this backup file.');
    const before = songs.length;
    songs = mergeById(songs, incomingSongs, s => s.updatedAt || s.createdAt || s.addedAt || 0);
    people = mergeById(people, incomingPeople, p => p.updatedAt || 0);
    wishlist = mergeById(wishlist, incomingWish, w => w.updatedAt || 0);
    save(); savePeople();
    if(typeof saveWishlist === 'function') saveWishlist();
    syncToSupabase();
    if(typeof render === 'function') render();
    alert('Backup imported and merged. ' + songs.length + ' songs now in your cataloguex (' + (songs.length - before) + ' added).');
  }catch(err){
    console.error(err);
    alert('Could not import backup: ' + err.message);
  }
  e.target.value = '';
});

document.getElementById('exportDataBtn').addEventListener('click', async ()=>{
  trackEvent('export_data');
  const exportObj = {
    exportedAt: new Date().toISOString(),
    app: 'Tonic.fm',
    user: { id: window.currentUserId, email: (sb.auth.currentUser && sb.auth.currentUser.email) || '' },
    profile: myProfile || {},
    cataloguex: songs || [],
    people: people || [],
    wishlist: wishlist || [],
    settings: { theme: loadTheme(), customThemes: loadCustomThemes() }
  };
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bayoutonefm-data-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ---- ACCOUNT DELETION ---- */
document.getElementById('deleteAccountBtn').addEventListener('click', async ()=>{
  trackEvent('delete_account_attempt');
  const step1 = confirm('Are you sure you want to delete your account? This will permanently remove all your data and cannot be undone.');
  if(!step1) return;
  const step2 = confirm('This is your final warning. All songs, ratings, notes, people, and profile data will be permanently deleted. Type OK to proceed.');
  if(!step2) return;
  try{
    const uid = window.currentUserId;
    const keys = [
      'song-journal-entries-' + uid,
      'song-journal-people-' + uid,
      'song-journal-wishlist-' + uid,
      'song-journal-analytics',
      'song-journal-theme',
      'song-journal-custom-themes'
    ];
    keys.forEach(k => { try{ localStorage.removeItem(k); }catch(e){} });
    const tables = ['profiles','songs','people','wishlist','stickers','messages','sotd_votes','sotd_nominations','sotd_notifs'];
    for(const t of tables){
      try{ await sb.from(t).delete().eq('user_id', uid); }catch(e){}
    }
    const { error } = await sb.auth.signOut();
    songs = []; people = []; wishlist = [];
    location.reload();
  }catch(e){
    console.error('Account deletion error:', e);
    alert('There was an error deleting your account. Please try again or contact support.');
  }
});
document.getElementById('editProfileSaveBtn').addEventListener('click', async ()=>{
  trackEvent('save_profile');
  const errEl = document.getElementById('ep-error');
  const username = document.getElementById('ep-username').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const bio = document.getElementById('ep-bio').value.trim();
  if(!username){ errEl.textContent = 'Choose a username (letters, numbers, _ and . only).'; errEl.style.display=''; return; }
  const error = await upsertMyProfile({ username, bio, photo: currentEditProfilePhoto });
  if(error){
    errEl.textContent = (error.code === '23505') ? 'That username is taken — try another.' : error.message;
    errEl.style.display = '';
    return;
  }
  myProfile = { user_id: currentUserId, username, bio, photo: currentEditProfilePhoto };
  renderMyAvatar();
  document.getElementById('editProfileOverlay').classList.remove('open');
});

function openOnboarding(){
  currentOnboardingPhoto = null;
  document.getElementById('ob-username').value = '';
  document.getElementById('ob-bio').value = '';
  setImagePreview('ob-photo', null);
  document.getElementById('ob-error').style.display = 'none';
  document.getElementById('onboardingOverlay').classList.add('open');
}
document.getElementById('onboardingSaveBtn').addEventListener('click', async ()=>{
  trackEvent('complete_onboarding');
  const errEl = document.getElementById('ob-error');
  const username = document.getElementById('ob-username').value.trim().toLowerCase().replace(/[^a-z0-9_.]/g,'');
  const bio = document.getElementById('ob-bio').value.trim();
  if(!username){ errEl.textContent = 'Choose a username (letters, numbers, _ and . only).'; errEl.style.display=''; return; }
  const error = await upsertMyProfile({ username, bio, photo: currentOnboardingPhoto });
  if(error){
    errEl.textContent = (error.code === '23505') ? 'That username is taken — try another.' : error.message;
    errEl.style.display = '';
    return;
  }
  myProfile = { user_id: currentUserId, username, bio, photo: currentOnboardingPhoto };
  showAnalyticsExport();
  renderMyAvatar();
  document.getElementById('onboardingOverlay').classList.remove('open');
  if(!myFriendsCount){
    setTimeout(()=>{ showToast("You're all set. Add a friend (🔎 Friends) to see what they're loving, or dive into 📰 Feed to discover new music.", 7000); }, 400);
  }
});

document.getElementById('openChangePasswordBtn').addEventListener('click', ()=>{
  trackEvent('open_change_password');
  document.getElementById('myProfileOverlay').classList.remove('open');
  document.getElementById('cp-password').value = '';
  document.getElementById('cp-password-2').value = '';
  document.getElementById('cp-error').style.display = 'none';
  document.getElementById('cp-message').style.display = 'none';
  document.getElementById('passwordOverlay').classList.add('open');
});
document.getElementById('passwordCancelBtn').addEventListener('click', ()=>{
  document.getElementById('passwordOverlay').classList.remove('open');
});
document.getElementById('passwordOverlay').addEventListener('click', e=>{
  if(e.target.id==='passwordOverlay') document.getElementById('passwordOverlay').classList.remove('open');
});
document.getElementById('passwordSaveBtn').addEventListener('click', async ()=>{
  trackEvent('change_password');
  const errEl = document.getElementById('cp-error');
  const msgEl = document.getElementById('cp-message');
  errEl.style.display = 'none'; msgEl.style.display = 'none';
  const pw1 = document.getElementById('cp-password').value;
  const pw2 = document.getElementById('cp-password-2').value;
  if(!pw1 || pw1.length < 6){ errEl.textContent = 'Password must be at least 6 characters.'; errEl.style.display=''; return; }
  if(pw1 !== pw2){ errEl.textContent = 'Passwords do not match.'; errEl.style.display=''; return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if(error){ errEl.textContent = error.message; errEl.style.display=''; return; }
  msgEl.textContent = 'Password updated.';
  msgEl.style.display = '';
  document.getElementById('cp-password').value = '';
  document.getElementById('cp-password-2').value = '';
});

