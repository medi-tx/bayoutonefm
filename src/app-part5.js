
/* =========================================================
   DISCOVER + ADD FRIENDS (pending request / accept flow)
   ========================================================= */
let allProfilesCache = [];
let myFriendIds = new Set();
let outgoingRequestIds = new Set();
let incomingRequests = []; // [{ id, requester_id }]

async function fetchFriendsCount(){
  const { count, error } = await sb
    .from('friends')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
  if(error){ console.error('Error loading friends count:', error); return 0; }
  return count || 0;
}
async function fetchAllProfiles(){
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, username, bio, photo')
    .neq('user_id', currentUserId)
    .limit(100);
  if(error){ console.error('Error loading people:', error); return []; }
  return (data || []).filter(p=>p.username);
}
async function fetchMyFriendRows(){
  const { data, error } = await sb
    .from('friends')
    .select('id, requester_id, addressee_id, status')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`);
  if(error){ console.error('Error loading friends:', error); return []; }
  return data || [];
}
function processFriendRows(rows){
  myFriendIds = new Set();
  outgoingRequestIds = new Set();
  incomingRequests = [];
  rows.forEach(r=>{
    if(r.status === 'accepted'){
      const other = r.requester_id === currentUserId ? r.addressee_id : r.requester_id;
      myFriendIds.add(other);
    } else if(r.status === 'pending'){
      if(r.requester_id === currentUserId){
        outgoingRequestIds.add(r.addressee_id);
      } else {
        incomingRequests.push({ id: r.id, requester_id: r.requester_id });
      }
    }
  });
}
async function sendFriendRequest(addresseeId){
  const { error } = await sb.from('friends').upsert(
    { requester_id: currentUserId, addressee_id: addresseeId, status: 'pending' },
    { onConflict: 'requester_id,addressee_id' }
  );
  if(error){ console.error('Error sending friend request:', error); return false; }
  outgoingRequestIds.add(addresseeId);
  const me = myProfile && myProfile.username ? '@' + myProfile.username : 'Someone';
  sendNotif(addresseeId, 'friend_request', me + ' wants to be friends with you');
  return true;
}
async function acceptFriendRequest(rowId, requesterId){
  const { error } = await sb.from('friends').update({ status: 'accepted' }).eq('id', rowId);
  if(error){ console.error('Error accepting friend request:', error); return false; }
  myFriendIds.add(requesterId);
  incomingRequests = incomingRequests.filter(r=>r.id!==rowId);
  const me = myProfile && myProfile.username ? '@' + myProfile.username : 'Someone';
  sendNotif(requesterId, 'friend_accept', me + ' accepted your friend request');
  return true;
}
async function declineFriendRequest(rowId){
  const { error } = await sb.from('friends').delete().eq('id', rowId);
  if(error){ console.error('Error declining friend request:', error); return false; }
  incomingRequests = incomingRequests.filter(r=>r.id!==rowId);
  return true;
}
function renderFriendRequests(){
  const wrap = document.getElementById('friendRequestsWrap');
  const list = document.getElementById('friendRequestsList');
  if(incomingRequests.length === 0){ wrap.style.display = 'none'; list.innerHTML = ''; return; }
  wrap.style.display = '';
  list.innerHTML = incomingRequests.map(r=>{
    const p = allProfilesCache.find(x=>x.user_id === r.requester_id);
    const username = p ? p.username : 'unknown';
    const initial = username.charAt(0).toUpperCase();
    return `
      <div class="discover-row">
        ${p && p.photo ? `<img loading="lazy" decoding="async" src="${escapeHtml(p.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp"></span>`}
        <span style="flex:1;">
          <span class="drow-name">@${escapeHtml(username)}</span><br>
          <span class="drow-bio">wants to be friends</span>
        </span>
        <span class="row-btn-group">
          <button type="button" class="modal-action-btn accent" data-accept-request="${r.id}" data-requester="${r.requester_id}">Accept</button>
          <button type="button" class="modal-action-btn" data-decline-request="${r.id}">Decline</button>
        </span>
      </div>
    `;
  }).join('');
}
function renderDiscoverList(filter){
  const wrap = document.getElementById('discoverList');
  const q = (filter||'').trim().toLowerCase();
  const list = allProfilesCache.filter(p=> !q || p.username.toLowerCase().includes(q) || (p.bio||'').toLowerCase().includes(q));
  if(list.length === 0){
    wrap.innerHTML = `<p class="profile-empty-note">${q ? 'No one matched "'+escapeHtml(filter)+'".' : 'No other users yet.'}</p>`;
    return;
  }
  wrap.innerHTML = list.map(p=>{
    const isFriend = myFriendIds.has(p.user_id);
    const isRequested = outgoingRequestIds.has(p.user_id);
    const initial = p.username.charAt(0).toUpperCase();
    let btnLabel = '+ Add friend';
    let btnDisabled = isFriend || isRequested;
    if(isFriend) btnLabel = 'Friends ✓';
    else if(isRequested) btnLabel = 'Requested';
    return `
      <div class="discover-row" data-user-id="${p.user_id}">
        ${p.photo ? `<img loading="lazy" decoding="async" src="${escapeAttr(p.photo)}" loading="lazy" alt="Profile photo">` : `<span class="drow-fallback is-pfp"></span>`}
        <span style="flex:1;">
          <span class="drow-name">@${escapeHtml(p.username)}</span>${p.bio ? `<br><span class="drow-bio">${escapeHtml(p.bio)}</span>` : ''}
        </span>
        <button type="button" class="modal-action-btn" data-add-friend="${p.user_id}" ${btnDisabled ? 'disabled' : ''}>${btnLabel}</button>
      </div>
    `;
  }).join('');
}
document.getElementById('discoverBtn').addEventListener('click', async ()=>{
  trackEvent('open_friends');
  document.getElementById('discoverOverlay').classList.add('open');
  document.getElementById('friend-username-search').value = '';
  document.getElementById('discoverList').innerHTML = '<p class="profile-empty-note">Loading…</p>';
  document.getElementById('friendRequestsWrap').style.display = 'none';
  const [profiles, rows] = await Promise.all([fetchAllProfiles(), fetchMyFriendRows()]);
  allProfilesCache = profiles;
  processFriendRows(rows);
  renderFriendRequests();
  renderDiscoverList('');
});
document.getElementById('friendNotFoundDiscoverBtn').addEventListener('click', ()=>{
  const db = document.getElementById('discoverBtn');
  if(db) db.click();
});
document.getElementById('friend-username-search').addEventListener('input', e=>{
  renderDiscoverList(e.target.value);
});
document.getElementById('discoverList').addEventListener('click', async e=>{
  const btn = e.target.closest('[data-add-friend]');
  if(btn){
    if(btn.disabled) return;
    trackEvent('add_friend');
    btn.disabled = true;
    btn.textContent = '…';
    const ok = await sendFriendRequest(btn.dataset.addFriend);
    btn.textContent = ok ? 'Requested' : '+ Add friend';
    if(!ok) btn.disabled = false;
    return;
  }
  const row = e.target.closest('[data-user-id]');
  if(row){
    const p = allProfilesCache.find(x=>x.user_id === row.dataset.userId);
    if(p && p.username){
      document.getElementById('discoverOverlay').classList.remove('open');
      goToFriendCataloguex(p.username);
    }
  }
});
function openOtherProfile(userId){
  trackEvent('view_profile');
  const p = allProfilesCache.find(x=>x.user_id === userId);
  if(!p) return;
  const photoEl = document.getElementById('otherProfilePhoto');
  const fallbackEl = document.getElementById('otherProfileFallback');
  if(p.photo){
    photoEl.src = p.photo; photoEl.style.display = 'block'; fallbackEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; fallbackEl.style.display = 'flex';
    fallbackEl.textContent = '';
  }
  document.getElementById('otherProfileUsername').textContent = '@' + p.username;
  const bioEl = document.getElementById('otherProfileBio');
  bioEl.textContent = p.bio || 'No bio yet.';
  bioEl.classList.toggle('empty', !p.bio);
  updateOtherProfileFriendBtn(userId);
  document.getElementById('otherProfileOverlay').classList.add('open');
  loadOtherProfileSotdCount(userId);
}
async function loadOtherProfileSotdCount(userId){
  const sotdEl = document.getElementById('otherProfileSotdCount');
  if(!sotdEl) return;
  const stats = await loadSotdReactionStats(userId);
  if(!stats || stats.count === 0){ sotdEl.style.display = 'none'; return; }
  sotdEl.textContent = '🎵 Reacted to ' + stats.count + (stats.count === 1 ? ' song' : ' songs') + ' of the day · 🔥 ' + stats.current + '-day streak' + (stats.best > stats.current ? ' (best ' + stats.best + ')' : '');
  sotdEl.style.display = '';
}
function updateOtherProfileFriendBtn(userId){
  const btn = document.getElementById('otherProfileFriendBtn');
  btn.dataset.userId = userId;
  const isFriend = myFriendIds.has(userId);
  const isRequested = outgoingRequestIds.has(userId);
  const p = allProfilesCache.find(x=>x.user_id === userId);
  let btnLabel = '+ Add friend';
  let btnDisabled = isFriend || isRequested;
  if(isFriend) btnLabel = 'Friends';
  else if(isRequested) btnLabel = 'Requested';
  btn.disabled = btnDisabled;
  btn.textContent = btnLabel;
  const catBtn = document.getElementById('otherProfileCataloguexBtn');
  if(isFriend && p && p.username){
    catBtn.style.display = '';
    catBtn.dataset.username = p.username;
  } else {
    catBtn.style.display = 'none';
  }
}
document.getElementById('otherProfileCataloguexBtn').addEventListener('click', ()=>{
  trackEvent('view_friend_cataloguex');
  const username = document.getElementById('otherProfileCataloguexBtn').dataset.username;
  if(!username) return;
  document.getElementById('otherProfileOverlay').classList.remove('open');
  document.getElementById('discoverOverlay').classList.remove('open');
  goToFriendCataloguex(username);
});
document.getElementById('otherProfileFriendBtn').addEventListener('click', async ()=>{
  trackEvent('add_friend_from_profile');
  const btn = document.getElementById('otherProfileFriendBtn');
  if(btn.disabled) return;
  const userId = btn.dataset.userId;
  btn.disabled = true;
  btn.textContent = '…';
  const ok = await sendFriendRequest(userId);
  updateOtherProfileFriendBtn(userId);
  renderDiscoverList(document.getElementById('friend-username-search').value);
  if(!ok) return;
});
document.getElementById('otherProfileCloseBtn').addEventListener('click', ()=>{
  document.getElementById('otherProfileOverlay').classList.remove('open');
});
document.getElementById('friendRequestsList').addEventListener('click', async e=>{
  trackEvent('friend_request_respond');
  const acceptBtn = e.target.closest('[data-accept-request]');
  const declineBtn = e.target.closest('[data-decline-request]');
  if(acceptBtn){
    acceptBtn.disabled = true;
    const ok = await acceptFriendRequest(acceptBtn.dataset.acceptRequest, acceptBtn.dataset.requester);
    if(ok){
      myFriendsCount++;
      render();
      renderFriendRequests();
      renderDiscoverList(document.getElementById('friend-username-search').value);
    }
    else { acceptBtn.disabled = false; }
  } else if(declineBtn){
    declineBtn.disabled = true;
    const ok = await declineFriendRequest(declineBtn.dataset.declineRequest);
    if(ok){ renderFriendRequests(); }
    else { declineBtn.disabled = false; }
  }
});
document.getElementById('discoverCloseBtn').addEventListener('click', ()=>{
  document.getElementById('discoverOverlay').classList.remove('open');
});
/* =========================================================
   FRIEND CATALOGUEX PAGE  (routed at #/u/username)
   ========================================================= */
function usernameFromRoute(){
  const m = location.hash.match(/^#\/u\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function goToFriendCataloguex(username){
  location.hash = '/u/' + encodeURIComponent(username);
}
function closeFriendCataloguex(){
  document.getElementById('friendWrap').style.display = 'none';
  document.getElementById('appWrap').style.display = '';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = '';
  applyTheme(loadTheme());
}
document.getElementById('friendBackBtn').addEventListener('click', ()=>{
  if(!currentUserId){
    history.pushState('', document.title, location.pathname + location.search);
    document.getElementById('friendWrap').style.display = 'none';
    showAuthScreen();
    applyTheme(DEFAULT_THEME);
    return;
  }
  history.pushState('', document.title, location.pathname + location.search);
  closeFriendCataloguex();
});

async function fetchProfileByUsername(username){
  const { data, error } = await sb
    .from('profiles')
    .select('user_id, username, bio, photo, theme')
    .ilike('username', username)
    .maybeSingle();
  if(error){
    console.error('Error loading that profile (retrying without theme column):', error);
    const retry = await sb
      .from('profiles')
      .select('user_id, username, bio, photo')
      .ilike('username', username)
      .maybeSingle();
    if(retry.error){ console.error('Error loading that profile:', retry.error); return null; }
    return retry.data;
  }
  return data;
}
async function fetchReadOnlySongs(userId){
  const { data, error } = await sb
    .from('user_data')
    .select('songs')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){ console.error('Error loading that cataloguex:', error); return null; }
  return (data && data.songs) || [];
}

async function fetchReadOnlyPeopleAndSongs(userId){
  const { data, error } = await sb
    .from('user_data')
    .select('songs, people')
    .eq('user_id', userId)
    .maybeSingle();
  if(error){ console.error('Error loading that cataloguex:', error); return null; }
  return data;
}

/* ---- SONGS LINKED TO ME ----
   For each of my friends, check whether they've added a "person" linked to my
   account (people.userId === me). If so, surface any of their songs whose
   remindsOf references that person — i.e. songs they said reminded them of me. */
function linkedToMeCardHtml(entry){
  const s = entry.song;
  const p = entry.profile;
  const who = entry.who;
  const initial = (who || '?').charAt(0).toUpperCase();
  const avatar = (p && p.photo)
    ? `<span class="feed-card-avatar"><img loading="lazy" decoding="async" src="${escapeAttr(p.photo)}" alt="Profile photo"></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const cover = s.coverArt
    ? `<img loading="lazy" decoding="async" class="feed-card-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">`
    : `<div class="feed-card-cover-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
  const tierBadge = s.tier ? renderTierBadge(s.tier) : '';
  const why = s.quickThought ? `<div class="feed-card-why">"${escapeHtml(s.quickThought)}"</div>` : '';
  const when = s.createdAt ? `<div class="feed-card-when">${new Date(s.createdAt).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>` : '';
  return `
    <div class="feed-card">
      <div class="feed-card-head">
        ${avatar}
        <span class="feed-card-who"><b>@${escapeHtml(who)}</b> said this reminds them of you</span>
      </div>
      <div class="feed-card-body">
        ${cover}
        <div class="feed-card-info">
          <div class="feed-card-title">${escapeHtml(s.title || 'Untitled')}</div>
          <div class="feed-card-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
          <div class="feed-card-tier">${tierBadge}</div>
          ${why}
          ${when}
        </div>
      </div>
    </div>`;
}

async function loadLinkedToMe(){
  const list = document.getElementById('linkedToMeList');
  const countEl = document.getElementById('linkedToMeCount');
  if(!list || !currentUserId) return;
  list.innerHTML = '<div class="feed-empty">Loading…</div>';
  const friendIds = [...myFriendIds];
  const results = await Promise.all(friendIds.map(async id=>{
    try{
      const data = await fetchReadOnlyPeopleAndSongs(id);
      if(!data) return [];
      const linkedPersonIds = (data.people || [])
        .filter(p => p.userId === currentUserId)
        .map(p => p.id);
      if(linkedPersonIds.length === 0) return [];
      const prof = allProfilesCache.find(x => x.user_id === id);
      return (data.songs || [])
        .filter(s => !s.archived && Array.isArray(s.remindsOf) && s.remindsOf.some(pid => linkedPersonIds.includes(pid)))
        .map(s => ({ song: s, who: (prof && prof.username) || 'a friend', profile: prof || null }));
    }catch(e){ return []; }
  }));
  const all = results.flat().sort((a,b)=>(b.song.createdAt||0)-(a.song.createdAt||0));
  if(countEl) countEl.textContent = all.length ? `${all.length} song${all.length===1?'':'s'} linked to you` : '';
  if(all.length === 0){
    list.innerHTML = '<div class="feed-empty">Nothing yet. When a friend adds you under "Songs that remind me of…", it\'ll show up here.</div>';
    return;
  }
  list.innerHTML = all.map(e=>linkedToMeCardHtml(e)).join('');
}

document.getElementById('openLinkedToMeBtn').addEventListener('click', ()=>{
  trackEvent('open_linked_to_me');
  document.getElementById('myProfileOverlay').classList.remove('open');
  document.getElementById('linkedToMeOverlay').classList.add('open');
  loadLinkedToMe();
});
document.getElementById('linkedToMeCloseBtn').addEventListener('click', ()=>{
  document.getElementById('linkedToMeOverlay').classList.remove('open');
});
/* ---- TASTE MATCH (fun social feature #1 + #2) ---- */
function jaccardSets(setA, setB){
  if(setA.size===0 && setB.size===0) return 0;
  let inter=0;
  setA.forEach(x=>{ if(setB.has(x)) inter++; });
  const unionSize = new Set([...setA, ...setB]).size;
  return unionSize ? inter/unionSize : 0;
}
function computeTasteMatch(mySongs, theirSongs){
  const norm = v => (v||'').trim().toLowerCase();
  const artistSet = list => { const s=new Set(); (list||[]).forEach(song=>(song.artists||[]).forEach(a=>{ if(norm(a)) s.add(norm(a)); })); return s; };
  const genreSet = list => { const s=new Set(); (list||[]).forEach(song=>(song.genres||[]).forEach(g=>{ if(norm(g)) s.add(norm(g)); })); return s; };
  const myArtists = artistSet(mySongs), theirArtists = artistSet(theirSongs);
  const myGenres = genreSet(mySongs), theirGenres = genreSet(theirSongs);
  const artistScore = jaccardSets(myArtists, theirArtists);
  const genreScore = jaccardSets(myGenres, theirGenres);
  const percent = Math.round((artistScore*0.65 + genreScore*0.35) * 100);
  const sharedArtists = [...myArtists].filter(a=>theirArtists.has(a));
  const theirTrackKeys = new Map();
  (theirSongs||[]).forEach(s=>{ theirTrackKeys.set(norm(s.title)+'|'+norm((s.artists||[])[0]), s); });
  const sharedTracks = (mySongs||[]).filter(s=> s.title && theirTrackKeys.has(norm(s.title)+'|'+norm((s.artists||[])[0])));
  return { percent, sharedArtists, sharedTracks };
}
function tasteMatchLabel(percent){
  if(percent>=70) return 'Soulmates 🎧';
  if(percent>=45) return 'Kindred Spirits 🌊';
  if(percent>=20) return 'Distant Cousins 🌱';
  if(percent>0) return 'Different Wavelengths 🛸';
  return 'Uncharted Territory 🗺️';
}
function renderTasteMatch(mySongs, theirSongs){
  const panel = document.getElementById('friendTasteMatch');
  const favsWrap = document.getElementById('friendSharedFavs');
  const favsList = document.getElementById('sharedFavsList');
  if(!mySongs.length || !theirSongs.length){
    panel.style.display = 'none';
    favsWrap.style.display = 'none';
    return;
  }
  const { percent, sharedArtists, sharedTracks } = computeTasteMatch(mySongs, theirSongs);
  panel.style.display = 'flex';
  document.getElementById('tmPercent').textContent = percent + '%';
  document.getElementById('tmRing').style.setProperty('--tm-pct', percent);
  document.getElementById('tmLabel').textContent = tasteMatchLabel(percent);
  const bits = [];
  if(sharedArtists.length) bits.push(`${sharedArtists.length} shared artist${sharedArtists.length===1?'':'s'}`);
  if(sharedTracks.length) bits.push(`${sharedTracks.length} identical track${sharedTracks.length===1?'':'s'}`);
  document.getElementById('tmDetail').textContent = bits.length ? bits.join(' · ') : 'Not much overlap yet — go explore each other\u2019s taste!';
  if(sharedTracks.length){
    favsWrap.style.display = 'block';
    favsList.innerHTML = sharedTracks.slice(0,10).map(s=>`
      <div class="shared-fav-chip">
        ${s.coverArt ? `<img loading="lazy" decoding="async" src="${escapeAttr(s.coverArt)}" alt="Album cover">` : ''}
        <span>${escapeHtml(s.title||'Untitled')}<br><small>${escapeHtml(formatArtists(s.artists))}</small></span>
      </div>
    `).join('');
  } else {
    favsWrap.style.display = 'none';
  }
}

/* ---- FRIEND LEADERBOARD (fun social feature #3) ---- */
async function loadFriendLeaderboard(){
  const list = document.getElementById('leaderboardFriendList');
  if(!list) return;
  const friendIds = [...myFriendIds];
  if(friendIds.length < 1){
    list.innerHTML = '<p class="profile-empty-note">Add a few friends and check back — this ranks your friend group!</p>';
    return;
  }
  list.innerHTML = '<p class="profile-empty-note">Crunching the numbers…</p>';
  const friendResults = await Promise.all(friendIds.map(async id=>({ id, songs: (await fetchReadOnlySongs(id)) || [] })));
  const mySongs = songs.filter(s=>!s.archived);
  const allResults = [{ id: currentUserId, songs: mySongs }, ...friendResults];
  let mostProlific=null, pickiest=null, twin=null;
  allResults.forEach(r=>{
    if(!r.songs.length) return;
    if(!mostProlific || r.songs.length > mostProlific.songs.length) mostProlific = r;
    if(r.songs.length >= 3){
      const ratio = r.songs.filter(s=>s.tier==='S').length / r.songs.length;
      if(ratio > 0 && (!pickiest || ratio > pickiest.ratio)) pickiest = { ...r, ratio };
    }
    if(r.id !== currentUserId){
      const { percent } = computeTasteMatch(mySongs, r.songs);
      if(percent > 0 && (!twin || percent > twin.percent)) twin = { ...r, percent };
    }
  });
  const nameFor = id => { if(id === currentUserId) return 'you'; const p = allProfilesCache.find(x=>x.user_id===id); return p ? p.username : 'someone'; };
  const rows = [];
  if(mostProlific) rows.push({ emoji:'🎧', title:'Most Prolific', name:nameFor(mostProlific.id), detail:`${mostProlific.songs.length} tracks cataloguexd` });
  if(pickiest) rows.push({ emoji:'🔥', title:'Pickiest Curator', name:nameFor(pickiest.id), detail:`${Math.round(pickiest.ratio*100)}% S-tier picks` });
  if(twin) rows.push({ emoji:'🧬', title:'Your Taste Twin', name:nameFor(twin.id), detail:`${twin.percent}% match with you` });
  if(!rows.length){ list.innerHTML = '<p class="profile-empty-note">Not enough data yet — add a few tracks and check back!</p>'; return; }
  list.innerHTML = rows.map(r=>`
    <div class="discover-row leaderboard-row" style="cursor:default;">
      <span class="drow-fallback">${r.emoji}</span>
      <span style="flex:1;">
        <span class="drow-name">${escapeHtml(r.title)}: @${escapeHtml(r.name)}</span><br>
        <span class="drow-bio">${escapeHtml(r.detail)}</span>
      </span>
    </div>
  `).join('');
}
async function loadLeaderboard(){
  const list = document.getElementById('leaderboardList');
  if(!list) return;
  list.innerHTML = '<p class="profile-empty-note">Crunching the numbers…</p>';
  const { data, error } = await sb.from('sotd_reactions').select('user_id');
  if(error || !data){
    list.innerHTML = '<p class="profile-empty-note">Could not load the leaderboard.</p>';
    return;
  }
  const counts = {};
  (data || []).forEach(r=>{ if(r && r.user_id) counts[r.user_id] = (counts[r.user_id] || 0) + 1; });
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(top.length === 0){
    list.innerHTML = '<p class="profile-empty-note">No SOTD reactions yet — be the first to react!</p>';
    return;
  }
  const ids = top.map(e=>e[0]);
  const { data: profs } = await sb.from('profiles').select('user_id, username, photo').in('user_id', ids);
  const pmap = {};
  (profs || []).forEach(p=>{ pmap[p.user_id] = p; });
  const medals = ['🥇','🥈','🥉'];
  list.innerHTML = top.map((entry, i)=>{
    const userId = entry[0], n = entry[1];
    const p = pmap[userId];
    const name = (p && p.username) ? p.username : 'someone';
    const isMe = userId === currentUserId;
    const medal = medals[i] || '';
    const rank = i + 1;
    return `
      <div class="discover-row leaderboard-row" data-user-id="${userId}" style="cursor:pointer;">
        ${p && p.photo ? `<img loading="lazy" decoding="async" src="${escapeHtml(p.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp">${escapeHtml(name.charAt(0).toUpperCase())}</span>`}
        <span style="flex:1;">
          <span class="drow-name">${medal ? medal + ' ' : '#'+rank+' '}@${escapeHtml(name)}${isMe ? ' (you)' : ''}</span><br>
          <span class="drow-bio">${n} ${n === 1 ? 'reaction' : 'reactions'} to songs of the day</span>
        </span>
      </div>`;
  }).join('');
}

async function loadCataloguexLeaderboard(){
  const list = document.getElementById('leaderboardCataloguexList');
  if(!list) return;
  list.innerHTML = '<p class="profile-empty-note">Crunching the numbers…</p>';
  try{
    const { data: profiles, error } = await sb.from('profiles').select('user_id, username, photo').limit(200);
    if(error || !profiles){ list.innerHTML = '<p class="profile-empty-note">Could not load.</p>'; return; }
    const results = await Promise.all(profiles.slice(0,50).map(async p=>{
      try{
        const songs = (await fetchReadOnlySongs(p.user_id)) || [];
        return { user_id:p.user_id, username:p.username, photo:p.photo, count: songs.filter(s=>!s.archived).length };
      }catch(e){ return { user_id:p.user_id, username:p.username, photo:p.photo, count:0 }; }
    }));
    const top = results.filter(r=>r.count > 0).sort((a,b)=>b.count-a.count).slice(0,10);
    if(top.length === 0){ list.innerHTML = '<p class="profile-empty-note">No cataloguexes yet.</p>'; return; }
    const medals = ['🥇','🥈','🥉'];
    list.innerHTML = top.map((r, i)=>{
      const isMe = r.user_id === currentUserId;
      const medal = medals[i] || '';
      const rank = i + 1;
      return `
        <div class="discover-row leaderboard-row" data-user-id="${r.user_id}" style="cursor:pointer;">
          ${r.photo ? `<img loading="lazy" decoding="async" src="${escapeHtml(r.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp">${escapeHtml((r.username||'?').charAt(0).toUpperCase())}</span>`}
          <span style="flex:1;">
            <span class="drow-name">${medal ? medal + ' ' : '#'+rank+' '}@${escapeHtml(r.username||'someone')}${isMe ? ' (you)' : ''}</span><br>
            <span class="drow-bio">${r.count} song${r.count===1?'':'s'} in their cataloguex</span>
          </span>
        </div>`;
    }).join('');
  }catch(e){ list.innerHTML = '<p class="profile-empty-note">Could not load.</p>'; }
}
document.getElementById('leaderboardBtn').addEventListener('click', ()=>{
  trackEvent('open_leaderboard');
  document.getElementById('leaderboardOverlay').classList.add('open');
  loadLeaderboard();
  loadCataloguexLeaderboard();
  loadFriendLeaderboard();
});
document.getElementById('leaderboardCloseBtn').addEventListener('click', ()=>{
  document.getElementById('leaderboardOverlay').classList.remove('open');
});
document.getElementById('leaderboardList').addEventListener('click', e=>{
  const row = e.target.closest('[data-user-id]');
  if(row){
    const p = allProfilesCache.find(x=>x.user_id === row.dataset.userId);
    if(p && p.username){
      document.getElementById('leaderboardOverlay').classList.remove('open');
      goToFriendCataloguex(p.username);
    }
  }
});
document.getElementById('leaderboardCataloguexList').addEventListener('click', e=>{
  const row = e.target.closest('[data-user-id]');
  if(row){
    const p = allProfilesCache.find(x=>x.user_id === row.dataset.userId);
    if(!p){
      const uname = row.querySelector('.drow-name')?.textContent?.replace(/^.*@/,'')?.replace(/\s*\(you\).*$/,'').trim();
      if(uname){ document.getElementById('leaderboardOverlay').classList.remove('open'); goToFriendCataloguex(uname); return; }
    }
    if(p && p.username){
      document.getElementById('leaderboardOverlay').classList.remove('open');
      goToFriendCataloguex(p.username);
    }
  }
});
function renderFriendGrid(list){
  const grid = document.getElementById('friendGrid');
  const empty = document.getElementById('friendEmptyState');
  const active = (list || []).filter(s=>!s.archived);
  if(active.length === 0){
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = active.map(s=>`
    <div class="card" data-song-id="${escapeAttr(s.id)}">
      <div class="card-front">
        <div class="card-top">
          ${s.coverArt ? `<img loading="lazy" decoding="async" class="cover-thumb" src="${escapeAttr(s.coverArt)}" alt="Album cover">` : ''}
          <div class="title-stack">
            <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}</p>
            <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}${trackNoDisplay(s)}</p>
          </div>
        </div>
        <div class="meta-row">
          ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
          ${(s.genres&&s.genres.length) ? `<span class="meta-genres">· ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
        </div>
        <div class="tier-row">${renderTierBadge(s.tier)}</div>
        <div class="preview-row">
          ${s.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
          <button type="button" class="preview-btn" data-preview="${escapeAttr(s.id)}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</button>
          <span class="preview-hint">30-sec preview</span>
        </div>
        ${s.quickThought ? `<p class="why">${escapeHtml(s.quickThought)}</p>` : ''}
        ${s.credit ? `<p class="credit-note"><b>Borrowed from / Where I Heard It:</b> ${escapeHtml(s.credit)}</p>` : ''}
        ${geniusLyricsUrl(s.title, s.artists) ? `<a class="lyrics-link" href="${escapeAttr(geniusLyricsUrl(s.title, s.artists))}" target="_blank" rel="noopener" title="Open lyrics on Genius">LYRICS ↗</a>` : ''}
      </div>
      <button type="button" class="cb-flip-fab" data-action="flip" title="Ratings & vibes">i</button>
      ${cardBackHtml(s)}
    </div>
  `).join('');
}
document.getElementById('friendGrid').addEventListener('click', e=>{
  const btn = e.target.closest('[data-action="flip"]');
  if(!btn) return;
  const cardEl = btn.closest('.card');
  if(cardEl) cardEl.classList.toggle('flipped');
});
let viewingFriendTierBoard = false;
let currentFriendSongs = [];
let currentFriendStickers = [];
function renderFriendTierBoard(list){
  document.getElementById('friendTierBoard').innerHTML = buildTierBoardHtml(list, false);
}
function updateFriendViewUI(){
  const grid = document.getElementById('friendGrid');
  const board = document.getElementById('friendTierBoard');
  const btn = document.getElementById('friendTierBoardBtn');
  btn.textContent = viewingFriendTierBoard ? '← Back to grid' : '🏆 Tier board';
  btn.classList.toggle('active', viewingFriendTierBoard);
  btn.setAttribute('aria-pressed', viewingFriendTierBoard ? 'true' : 'false');
  if(viewingFriendTierBoard){
    grid.style.display = 'none';
    board.style.display = '';
    document.getElementById('friendEmptyState').style.display = 'none';
    renderFriendTierBoard(currentFriendSongs);
  } else {
    board.style.display = 'none';
    grid.style.display = '';
    renderFriendGrid(currentFriendSongs);
  }
}
document.getElementById('friendTierBoardBtn').addEventListener('click', ()=>{
  trackEvent('toggle_friend_tier_board');
  viewingFriendTierBoard = !viewingFriendTierBoard;
  updateFriendViewUI();
});
document.getElementById('friendCompareBtn').addEventListener('click', ()=>{
  trackEvent('open_compare');
  renderCompareView();
  document.getElementById('compareOverlay').classList.add('open');
});
document.getElementById('compareCloseBtn').addEventListener('click', ()=>{
  document.getElementById('compareOverlay').classList.remove('open');
});
document.getElementById('compareTrackCloseBtn').addEventListener('click', ()=>{
  document.getElementById('compareTrackOverlay').classList.remove('open');
});
function renderCompareView(){
  const content = document.getElementById('compareContent');
  const mySongs = songs.filter(s=>!s.archived);
  const theirSongs = (currentFriendSongs||[]).filter(s=>!s.archived);
  if(!theirSongs.length){
    content.innerHTML = '<p class="profile-empty-note">No songs to compare yet.</p>';
    return;
  }
  const match = computeTasteMatch(mySongs, theirSongs);
  const norm = v => (v||'').trim().toLowerCase();
  const myArtists = new Set(); mySongs.forEach(s=>(s.artists||[]).forEach(a=>{ if(norm(a)) myArtists.add(norm(a)); }));
  const theirArtists = new Set(); theirSongs.forEach(s=>(s.artists||[]).forEach(a=>{ if(norm(a)) theirArtists.add(norm(a)); }));
  const sharedArtists = [...myArtists].filter(a=>theirArtists.has(a));
  const myOnlyArtists = [...myArtists].filter(a=>!theirArtists.has(a)).slice(0,12);
  const theirOnlyArtists = [...theirArtists].filter(a=>!myArtists.has(a)).slice(0,12);
  const myGenres = new Set(); mySongs.forEach(s=>(s.genres||[]).forEach(g=>{ if(norm(g)) myGenres.add(norm(g)); }));
  const theirGenres = new Set(); theirSongs.forEach(s=>(s.genres||[]).forEach(g=>{ if(norm(g)) theirGenres.add(norm(g)); }));
  const sharedGenres = [...myGenres].filter(g=>theirGenres.has(g));
  const myTierCounts = { '★':0,S:0,A:0,B:0,C:0 };
  mySongs.forEach(s=>{ if(s.tier && myTierCounts.hasOwnProperty(s.tier)) myTierCounts[s.tier]++; });
  const theirTierCounts = { '★':0,S:0,A:0,B:0,C:0 };
  theirSongs.forEach(s=>{ if(s.tier && theirTierCounts.hasOwnProperty(s.tier)) theirTierCounts[s.tier]++; });
  const myName = (myProfile && myProfile.username) || 'You';
  const theirName = (allProfilesCache.find(x=>x.user_id === (currentFriendSongs && currentFriendSongs.__ownerId)) || {}).username || 'Friend';
  const myPhoto = (myProfile && myProfile.photo) || null;
  const theirProfile = allProfilesCache.find(x=>x.user_id === currentFriendSongs?.__ownerId);
  const theirPhoto = (theirProfile && theirProfile.photo) || null;
  const theirInitial = theirName.charAt(0).toUpperCase();
  const myInitial = myName.charAt(0).toUpperCase();

  const theirTrackMap = new Map();
  theirSongs.forEach(s=>{ theirTrackMap.set(norm(s.title)+'|'+norm((s.artists||[])[0]), s); });
  const sharedPairs = [];
  mySongs.forEach(s=>{
    const key = norm(s.title)+'|'+norm((s.artists||[])[0]);
    if(s.title && theirTrackMap.has(key)){
      sharedPairs.push({ mine: s, theirs: theirTrackMap.get(key) });
    }
  });

  const tierPfpHtml = (tier, photo, initial) => `
    <div class="cmp-tier-pick">
      ${photo ? `<img loading="lazy" decoding="async" class="cmp-tier-pick-pfp" src="${escapeAttr(photo)}" alt="Image">` : `<div class="cmp-tier-pick-fallback">♪</div>`}
      <span class="tier-badge tier-${tier||'none'}">${tier||'—'}</span>
    </div>`;

  const readOnlyCardHtml = (s) => `
    <div class="cmp-detail-card">
      <div class="card-top">
        ${s.coverArt ? `<img loading="lazy" decoding="async" class="cover-thumb" src="${escapeAttr(s.coverArt)}" alt="Album cover">` : ''}
        <div class="title-stack">
          <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}</p>
          <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}${trackNoDisplay(s)}</p>
        </div>
      </div>
      <div class="meta-row">
        ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
        ${(s.genres&&s.genres.length) ? `<span> · ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
      </div>
      <div class="tier-row">${renderTierBadge(s.tier)}</div>
      ${s.quickThought ? `<p class="why">${escapeHtml(s.quickThought)}</p>` : ''}
    </div>`;

  const detailHeaderHtml = (photo, name, initial) => `
    <div class="cmp-detail-header">
      ${photo ? `<img loading="lazy" decoding="async" src="${escapeAttr(photo)}" alt="Image">` : `<div class="cmp-detail-header-fb">♪</div>`}
      <span class="cmp-detail-header-name">@${escapeHtml(name)}</span>
    </div>`;

  content.innerHTML = `
    <div class="cmp-header">
      <div class="cmp-side">
        ${myPhoto ? `<img loading="lazy" decoding="async" class="cmp-side-avatar" src="${escapeAttr(myPhoto)}" alt="Profile photo">` : `<div class="cmp-side-fallback">♪</div>`}
        <div class="cmp-side-name">@${escapeHtml(myName)}</div>
        <div class="cmp-side-stats">${mySongs.length} songs</div>
      </div>
      <div class="cmp-vs">vs</div>
      <div class="cmp-side">
        ${theirPhoto ? `<img loading="lazy" decoding="async" class="cmp-side-avatar" src="${escapeAttr(theirPhoto)}" alt="Profile photo">` : `<div class="cmp-side-fallback">♪</div>`}
        <div class="cmp-side-name">@${escapeHtml(theirName)}</div>
        <div class="cmp-side-stats">${theirSongs.length} songs</div>
      </div>
    </div>
    <div class="cmp-section">
      <div class="cmp-section-label">Overall match: ${match.percent}% — ${tasteMatchLabel(match.percent)}</div>
    </div>
    <div class="cmp-section">
      <div class="cmp-section-label">Artist overlap (${sharedArtists.length} shared)</div>
      <div class="cmp-chips">
        ${sharedArtists.slice(0,16).map(a=>`<span class="cmp-chip shared">${escapeHtml(a)}</span>`).join('') || '<span class="cmp-chip">No shared artists yet</span>'}
      </div>
    </div>
    ${sharedGenres.length ? `<div class="cmp-section">
      <div class="cmp-section-label">Shared genres (${sharedGenres.length})</div>
      <div class="cmp-chips">
        ${sharedGenres.map(g=>`<span class="cmp-chip shared">${escapeHtml(g)}</span>`).join('')}
      </div>
    </div>` : ''}
    ${sharedPairs.length ? `<div class="cmp-section">
      <div class="cmp-section-label">You both have (${sharedPairs.length}) — click to compare cards</div>
      <div class="cmp-shared-list">
        ${sharedPairs.map((p,i)=>`
          <div class="cmp-shared-track" data-cmp-idx="${i}">
            ${p.mine.coverArt ? `<img loading="lazy" decoding="async" class="cmp-shared-cover" src="${escapeAttr(p.mine.coverArt)}" alt="Album cover">` : ''}
            <div class="cmp-shared-info">
              <div class="cmp-shared-title">${escapeHtml(p.mine.title||'Untitled')}</div>
              <div class="cmp-shared-artist">${escapeHtml(formatArtists(p.mine.artists))}</div>
            </div>
            <div class="cmp-shared-tiers">
              ${tierPfpHtml(p.mine.tier, myPhoto, myInitial)}
              ${tierPfpHtml(p.theirs.tier, theirPhoto, theirInitial)}
            </div>
          </div>`).join('')}
      </div>
    </div>` : ''}
    <div class="cmp-section">
      <div class="cmp-section-label">Tier distribution</div>
      <div class="cmp-tiers">
        <div class="cmp-tier-col">
          <h4>@${escapeHtml(myName)}</h4>
          ${Object.entries(myTierCounts).map(([tier,n])=>`<div class="cmp-tier-row"><span class="tier-badge tier-${tier}">${tier}</span><span class="cmp-tier-count">${n}</span></div>`).join('')}
        </div>
        <div class="cmp-tier-col">
          <h4>@${escapeHtml(theirName)}</h4>
          ${Object.entries(theirTierCounts).map(([tier,n])=>`<div class="cmp-tier-row"><span class="tier-badge tier-${tier}">${tier}</span><span class="cmp-tier-count">${n}</span></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="cmp-section">
      <div class="cmp-section-label">Only @${escapeHtml(myName)} listens to</div>
      <div class="cmp-chips">
        ${myOnlyArtists.map(a=>`<span class="cmp-chip">${escapeHtml(a)}</span>`).join('') || '<span class="cmp-chip">—</span>'}
      </div>
    </div>
    <div class="cmp-section">
      <div class="cmp-section-label">Only @${escapeHtml(theirName)} listens to</div>
      <div class="cmp-chips">
        ${theirOnlyArtists.map(a=>`<span class="cmp-chip">${escapeHtml(a)}</span>`).join('') || '<span class="cmp-chip">—</span>'}
      </div>
    </div>`;

  content.querySelectorAll('.cmp-shared-track').forEach(el=>{
    el.addEventListener('click', ()=>{
      const idx = parseInt(el.dataset.cmpIdx);
      const pair = sharedPairs[idx];
      if(!pair) return;
      trackEvent('compare_track_detail');
      document.getElementById('compareTrackTitle').textContent = pair.mine.title || 'Untitled';
      document.getElementById('compareTrackContent').innerHTML = `
        <div class="cmp-detail-cards">
          <div class="cmp-detail-side">
            ${detailHeaderHtml(myPhoto, myName, myInitial)}
            ${readOnlyCardHtml(pair.mine)}
          </div>
          <div class="cmp-detail-side">
            ${detailHeaderHtml(theirPhoto, theirName, theirInitial)}
            ${readOnlyCardHtml(pair.theirs)}
          </div>
        </div>`;
      document.getElementById('compareTrackOverlay').classList.add('open');
    });
  });
}
function updateFriendBanner(p){
  document.getElementById('friendName').textContent = '@' + p.username;
  const bioEl = document.getElementById('friendBio');
  bioEl.textContent = p.bio || '';
  bioEl.classList.toggle('empty', !p.bio);
  const photoEl = document.getElementById('friendAvatarImg');
  const fallbackEl = document.getElementById('friendAvatarFallback');
  if(p.photo){
    photoEl.src = p.photo; photoEl.style.display = ''; fallbackEl.style.display = 'none';
  } else {
    photoEl.style.display = 'none'; fallbackEl.style.display = 'flex';
    fallbackEl.textContent = '';
  }
}
function updateFriendAddBtn(userId, p){
  const btn = document.getElementById('friendAddBtn');
  if(userId === currentUserId){ btn.style.display = 'none'; return; }
  btn.style.display = '';
  const isFriend = myFriendIds.has(userId);
  const isRequested = outgoingRequestIds.has(userId);
  btn.disabled = isFriend || isRequested;
  btn.textContent = isFriend ? 'Friends' : (isRequested ? 'Requested' : '+ Add friend');
  btn.onclick = async ()=>{
    if(btn.disabled) return;
    btn.disabled = true;
    btn.textContent = '…';
    const ok = await sendFriendRequest(userId);
    updateFriendAddBtn(userId, p);
    if(!ok) return;
  };
}
async function openFriendCataloguex(username){
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('friendWrap').style.display = '';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = 'none';
  document.getElementById('friendGrid').innerHTML = '';
  document.getElementById('friendEmptyState').style.display = 'none';
  document.getElementById('friendLockedState').style.display = 'none';
  document.getElementById('friendNotFoundState').style.display = 'none';
  document.getElementById('friendName').textContent = '@' + username;
  document.getElementById('friendBio').textContent = '';
  document.getElementById('friendAddBtn').style.display = 'none';
  document.getElementById('friendShareBtn').style.display = 'none';
  document.getElementById('friendTierBoardBtn').style.display = 'none';
  viewingFriendTierBoard = false;
  document.getElementById('friendTierBoard').style.display = 'none';
  document.getElementById('friendGrid').style.display = '';
  document.getElementById('friendTasteMatch').style.display = 'none';
  document.getElementById('friendSharedFavs').style.display = 'none';

  const p = await fetchProfileByUsername(username);
  if(!p){
    document.getElementById('friendNotFoundState').style.display = 'block';
    return;
  }
  updateFriendBanner(p);
  updateFriendAddBtn(p.user_id, p);

  const isSelf = p.user_id === currentUserId;
  const isFriend = myFriendIds.has(p.user_id);

  // show this listener's own theme while browsing their cataloguex; restore ours on the way out
  applyTheme(isSelf ? loadTheme() : (p.theme || DEFAULT_THEME));

  document.getElementById('friendTierBoardBtn').style.display = '';
  document.getElementById('friendShareBtn').style.display = '';
  const pd = isSelf ? { songs, people } : await fetchReadOnlyPeopleAndSongs(p.user_id);
  const friendSongs = (pd && Array.isArray(pd.songs)) ? pd.songs : [];
  _friendPeopleCache = (pd && Array.isArray(pd.people)) ? pd.people : null;
  currentFriendStickers = isSelf ? stickers : await fetchReadOnlyStickers(p.user_id);
  currentFriendSongs = friendSongs;
  currentFriendSongs.__ownerId = p.user_id;
  updateFriendViewUI();
  renderFriendStickerLayer();
  renderFriendBadges();
  renderFriendObsessed();
  if(!isSelf) renderTasteMatch(songs, friendSongs);
}

async function openPublicCataloguex(username){
  document.getElementById('appWrap').style.display = 'none';
  document.getElementById('friendWrap').style.display = '';
  var sl = document.getElementById('stickerLayer');
  if(sl) sl.style.display = 'none';
  document.getElementById('friendGrid').innerHTML = '';
  document.getElementById('friendEmptyState').style.display = 'none';
  document.getElementById('friendLockedState').style.display = 'none';
  document.getElementById('friendNotFoundState').style.display = 'none';
  document.getElementById('friendName').textContent = '@' + username;
  document.getElementById('friendBio').textContent = '';
  document.getElementById('friendAddBtn').style.display = 'none';
  document.getElementById('friendShareBtn').style.display = 'none';
  document.getElementById('friendShareTierBoardBtn').style.display = 'none';
  document.getElementById('friendTierBoardBtn').style.display = '';
  viewingFriendTierBoard = false;
  document.getElementById('friendTierBoard').style.display = 'none';
  document.getElementById('friendGrid').style.display = '';
  document.getElementById('friendTasteMatch').style.display = 'none';
  document.getElementById('friendSharedFavs').style.display = 'none';
  document.getElementById('friendBackBtn').textContent = '← Sign in';

  const p = await fetchProfileByUsername(username);
  if(!p){
    document.getElementById('friendNotFoundState').style.display = 'block';
    return;
  }
  updateFriendBanner(p);
  applyTheme(p.theme || DEFAULT_THEME);

  const pd = await fetchReadOnlyPeopleAndSongs(p.user_id);
  const friendSongs = (pd && Array.isArray(pd.songs)) ? pd.songs : [];
  _friendPeopleCache = (pd && Array.isArray(pd.people)) ? pd.people : null;
  currentFriendStickers = await fetchReadOnlyStickers(p.user_id);
  currentFriendSongs = friendSongs;
  updateFriendViewUI();
  renderFriendStickerLayer();
  renderFriendBadges();
  renderFriendObsessed();
}
function renderFriendObsessed(){
  const panel = document.getElementById('friendObsessedPanel');
  const strip = document.getElementById('friendObsessedStrip');
  if(!panel || !strip) return;
  const pinned = pinnedSongs(currentFriendSongs);
  if(pinned.length === 0){ panel.style.display = 'none'; strip.innerHTML = ''; return; }
  panel.style.display = '';
  strip.innerHTML = pinned.map(s=>obsessedChipHtml(s)).join('');
}
function renderFriendBadges(){
  const row = document.getElementById('friendBadgeRow');
  if(!row) return;
  row.innerHTML = badgeChipsHtml(currentFriendSongs);
}
document.getElementById('friendObsessedStrip').addEventListener('click', e=>{
  trackEvent('friend_obsessed_click');
  const chip = e.target.closest('[data-obsessed]');
  if(!chip) return;
  if(viewingFriendTierBoard){
    viewingFriendTierBoard = false;
    updateFriendViewUI();
  }
  const card = document.getElementById('friendGrid').querySelector('[data-song-id="' + CSS.escape(chip.dataset.obsessed) + '"]');
  if(card){
    card.scrollIntoView({ behavior:'smooth', block:'center' });
    card.classList.add('obsessed-flash');
    setTimeout(()=>card.classList.remove('obsessed-flash'), 2600);
  }
});
function checkRoute(){
  const username = usernameFromRoute();
  if(username && currentUserId){
    openFriendCataloguex(username);
  } else if(username && !currentUserId){
    openPublicCataloguex(username);
  } else if(!username && document.getElementById('friendWrap').style.display !== 'none'){
    closeFriendCataloguex();
  }
}
window.addEventListener('hashchange', checkRoute);

document.getElementById('addTitleBox').addEventListener('click', ()=>addTitleBoxRow(true));
document.getElementById('multiCancelBtn').addEventListener('click', closeMultiModal);
document.getElementById('multiSaveBtn').addEventListener('click', handleMultiSave);
document.getElementById('clearClusterFilter').addEventListener('click', ()=>{ trackEvent('clear_cluster_filter'); clusterFilterId = null; render(); });
document.getElementById('clearRemindsFilter').addEventListener('click', ()=>{ trackEvent('clear_reminds_filter'); remindsFilterId = null; render(); });
let searchDebounceTimer = null;
document.getElementById('search').addEventListener('input', ()=>{
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 200);
});
document.getElementById('filterGenre').addEventListener('change', ()=>{ trackEvent('filter_genre'); localStorage.setItem('bayoutonefm-filter-genre', document.getElementById('filterGenre').value); render(); });
document.getElementById('filterMood').addEventListener('change', ()=>{ trackEvent('filter_mood'); localStorage.setItem('bayoutonefm-filter-mood', document.getElementById('filterMood').value); render(); });
document.getElementById('sortBy').addEventListener('change', ()=>{ trackEvent('sort_changed'); localStorage.setItem('bayoutonefm-sort', document.getElementById('sortBy').value); render(); });
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeModal(); });
bindCoverInput('f-cover-file', 'f-cover', v=>currentCoverArt=v);

bindCoverInput('p-photo-file', 'p-photo', v=>currentPersonPhoto=v);

document.getElementById('peopleRow').addEventListener('click', e=>{
  const removeBtn = e.target.closest('[data-remove-person]');
  if(removeBtn){
    e.stopPropagation();
    const id = removeBtn.dataset.removePerson;
    const person = people.find(p=>p.id===id);
    if(person && confirm(`Remove "${person.name}" from your people list? (Songs keep their other tags.)`)){
      people = people.filter(p=>p.id!==id);
      savePeople();
      songs.forEach(s=>{ if(s.remindsOf) s.remindsOf = s.remindsOf.filter(pid=>pid!==id); });
      save();
      if(remindsFilterId === id) remindsFilterId = null;
      renderPeople();
      render();
    }
    return;
  }
  const editBtn = e.target.closest('[data-edit-person]');
  if(editBtn){
    e.stopPropagation();
    const id = editBtn.dataset.editPerson;
    const person = people.find(p=>p.id===id);
    if(person) openPersonModal(person);
    return;
  }
  const card = e.target.closest('.person-card');
  if(card){
    trackEvent('filter_by_person');
    const id = card.dataset.person;
    remindsFilterId = (remindsFilterId === id) ? null : id;
    clusterFilterId = null;
    renderPeople();
    render();
  }
});

let pFriendSelectedUserId = null;
let editingPersonId = null;
function openPersonModal(person){
  editingPersonId = person ? person.id : null;
  document.getElementById('personTitle').textContent = person ? 'Edit person' : 'Add a person';
  document.getElementById('personSaveBtn').textContent = person ? 'Save changes' : 'Save person';
  currentPersonPhoto = person ? (person.photo || null) : null;
  document.getElementById('p-name').value = person ? (person.name || '') : '';
  document.getElementById('p-friend-search').value = '';
  pFriendSelectedUserId = person ? (person.userId || null) : null;
  setImagePreview('p-photo', currentPersonPhoto);
  document.getElementById('personOverlay').classList.add('open');
  document.getElementById('p-name').focus();
  loadPFriendProfiles().then(renderPFriendList);
}
async function loadPFriendProfiles(){
  if(!myFriendIds || myFriendIds.size === 0) return;
  const missing = [...myFriendIds].filter(uid=>!allProfilesCache.some(p=>p.user_id === uid));
  if(missing.length === 0) return;
  try{
    const { data, error } = await sb.from('profiles').select('user_id, username, bio, photo').in('user_id', missing);
    if(!error && data){
      const known = allProfilesCache.slice();
      data.forEach(p=>{ if(!known.some(x=>x.user_id === p.user_id)) known.push(p); });
      allProfilesCache = known;
    }
  }catch(e){}
}
function renderPFriendList(){
  const q = (document.getElementById('p-friend-search').value || '').trim().toLowerCase();
  const list = allProfilesCache.filter(p=>myFriendIds.has(p.user_id) && (!q || (p.username || '').toLowerCase().includes(q)));
  const wrap = document.getElementById('p-friend-list');
  if(list.length === 0){
    wrap.innerHTML = q ? '<p class="profile-empty-note">No friends match that search.</p>' : '<p class="profile-empty-note">No friends yet — add some in Discover to link people to them.</p>';
    return;
  }
  wrap.innerHTML = list.map(f=>{
    const sel = f.user_id === pFriendSelectedUserId;
    const initial = (f.username || '?').charAt(0).toUpperCase();
    return `<button type="button" class="discover-row${sel ? ' sel' : ''}" data-p-friend="${escapeAttr(f.user_id)}">
      ${f.photo ? `<img loading="lazy" decoding="async" src="${escapeAttr(f.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp"></span>`}
      <span>
        <span class="drow-name">@${escapeHtml(f.username)}</span><br>
        <span class="drow-bio">${sel ? 'Linked ✓' : 'Tap to link'}</span>
      </span>
    </button>`;
  }).join('');
}
document.getElementById('addPersonBtn').addEventListener('click', ()=>{
  trackEvent('add_person');
  openPersonModal(null);
});
document.getElementById('p-friend-search').addEventListener('input', ()=>{ renderPFriendList(); });
document.getElementById('p-friend-list').addEventListener('click', e=>{
  const row = e.target.closest('[data-p-friend]');
  if(!row) return;
  pFriendSelectedUserId = (pFriendSelectedUserId === row.dataset.pFriend) ? null : row.dataset.pFriend;
  renderPFriendList();
});
document.getElementById('personCancelBtn').addEventListener('click', ()=>{
  document.getElementById('personOverlay').classList.remove('open');
});
document.getElementById('personSaveBtn').addEventListener('click', ()=>{
  trackEvent('save_person');
  const name = document.getElementById('p-name').value.trim();
  if(!name){ document.getElementById('p-name').focus(); return; }
  const userId = pFriendSelectedUserId || null;
  const photo = currentPersonPhoto;
  if(editingPersonId){
    const existing = people.find(p=>p.id===editingPersonId);
    if(existing){ existing.name = name; existing.photo = photo; existing.userId = userId; }
  } else {
    people.push({ id: uid(), name, photo, userId });
  }
  editingPersonId = null;
  savePeople();
  document.getElementById('personOverlay').classList.remove('open');
  renderPeople();
});

/* ---- STICKER PACKS (decorate your page) ---- */
const MAX_STICKERS = 12;
const DEFAULT_STICKERS = [];
let stickerSyncTimer = null;

function stickerDefaultPos(i){
  const offs = [[0,0],[-14,12],[14,-12],[-22,-20],[22,18],[-8,-26],[8,26],[-28,28],[28,-28],[-18,30],[18,-30],[0,-34]];
  const o = offs[i % offs.length];
  return { x: 50 + o[0], y: 50 + o[1] };
}
function clampNum(v, a, b){
  v = Number(v);
  if(isNaN(v)) return a;
  return Math.max(a, Math.min(b, v));
}

async function loadStickers(){
  try{
    const raw = localStorage.getItem(STICKERS_KEY);
    let local = raw ? JSON.parse(raw) : [];
    if(!Array.isArray(local)) local = [];
    let account = null;
    if(currentUserId && sb && sb.from){
      try{
        const { data } = await sb.from('user_data').select('stickers').eq('user_id', currentUserId).maybeSingle();
        if(data && Array.isArray(data.stickers)) account = data.stickers;
      }catch(e){}
    }
    const source = (account !== null) ? account : local;
    stickers = source.filter(s=> s && typeof s === 'object' && s.url).map((s,i)=>{
      const p = stickerDefaultPos(i);
      return { url:s.url, song:s.song||null, x:s.x!=null?s.x:p.x, y:s.y!=null?s.y:p.y, r:s.r||0 };
    });
    if(account !== null && JSON.stringify(account) !== JSON.stringify(local)){
      localStorage.setItem(STICKERS_KEY, JSON.stringify(stickers));
    }
  }catch(e){ stickers = []; }
}
function flushStickerSync(){
  clearTimeout(stickerSyncTimer);
  if(!currentUserId || !sb) return;
  sb.from('user_data').upsert({ user_id: currentUserId, stickers, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    .then(({ error })=>{ if(error) console.error('Error saving stickers:', error); });
}
window.addEventListener('pagehide', flushStickerSync);
function saveStickers(){
  localStorage.setItem(STICKERS_KEY, JSON.stringify(stickers));
  clearTimeout(stickerSyncTimer);
  stickerSyncTimer = setTimeout(async ()=>{
    const { error } = await sb.from('user_data').upsert({ user_id: currentUserId, stickers, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if(error) console.error('Error saving stickers:', error);
  }, 400);
}
async function fetchReadOnlyStickers(userId){
  const { data, error } = await sb.from('user_data').select('stickers').eq('user_id', userId).maybeSingle();
  if(error){ console.error('Error loading stickers:', error); return []; }
  return (data && Array.isArray(data.stickers)) ? data.stickers.filter(s=>s&&s.url) : [];
}

function stickerShelfHtml(list){
  return (list || []).filter(s=>s&&s.url).map((s,i)=>`<span class="sticker" data-i="${i}"><img loading="lazy" decoding="async" class="sticker-img" src="${escapeAttr(s.url)}" alt="sticker"></span>`).join('');
}

function renderStickerSections(){
  renderStickerLayer();
  renderFriendStickerLayer();
}
function stickerSpanHtml(s, i, friend, isCard){
  return `<span class="sticker-drag${friend?' friend':''}"${isCard?' data-song-sticker="1"':''} data-i="${i}" style="left:${clampNum(s.x,0,100)}%;top:${clampNum(s.y,0,100)}%;transform:translate(-50%,-50%) rotate(${clampNum(s.r||0,-45,45)}deg);">${friend?'':`<button type="button" class="sticker-remove" data-rm="${i}" aria-label="Remove sticker">✕</button>`}<img loading="lazy" decoding="async" class="sticker-img" src="${escapeAttr(s.url)}" alt="sticker"></span>`;
}
function splitStickersBySong(list){
  const free = [], byCard = {};
  (list||[]).forEach((s,i)=>{
    if(!s || !s.url) return;
    if(s.song){ (byCard[s.song] = byCard[s.song] || []).push({ s, i }); }
    else free.push({ s, i });
  });
  return { free, byCard };
}
function renderStickerLayer(){
  const layer = document.getElementById('stickerLayer');
  const grid = document.getElementById('grid');
  if(grid) grid.querySelectorAll('.sticker-drag[data-song-sticker]').forEach(n=>n.remove());
  const { free, byCard } = splitStickersBySong(stickers);
  if(layer){
    layer.innerHTML = free.map(({s,i})=>stickerSpanHtml(s,i,false)).join('');
    [...layer.querySelectorAll('.sticker-drag')].forEach(attachStickerDrag);
    layer.querySelectorAll('.sticker-remove').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.stopPropagation();
        const idx = Number(btn.dataset.rm);
        if(idx >= 0 && stickers[idx]){
          stickers.splice(idx, 1);
          saveStickers();
          renderStickerLayer();
          renderStickerPicker();
        }
      });
    });
  }
  if(grid && Object.keys(byCard).length){
    Object.keys(byCard).forEach(sid=>{
      const card = grid.querySelector('.card[data-id="'+CSS.escape(sid)+'"]');
      if(card) byCard[sid].forEach(({s,i})=>card.insertAdjacentHTML('beforeend', stickerSpanHtml(s,i,false,true)));
    });
    grid.querySelectorAll('.sticker-drag[data-song-sticker]').forEach(el=>{
      attachStickerDrag(el);
      const rm = el.querySelector('.sticker-remove');
      if(rm) rm.addEventListener('click', e=>{
        e.stopPropagation();
        const idx = Number(rm.dataset.rm);
        if(idx >= 0 && stickers[idx]){
          stickers.splice(idx, 1);
          saveStickers();
          renderStickerLayer();
          renderStickerPicker();
        }
      });
    });
  }
}
function renderFriendStickerLayer(){
  const layer = document.getElementById('friendStickerLayer');
  const grid = document.getElementById('friendGrid');
  if(grid) grid.querySelectorAll('.sticker-drag[data-song-sticker]').forEach(n=>n.remove());
  if(layer) layer.innerHTML = '';
  const { free, byCard } = splitStickersBySong(currentFriendStickers);
  if(layer) layer.innerHTML = free.map(({s,i})=>stickerSpanHtml(s,i,true)).join('');
  if(grid && Object.keys(byCard).length){
    Object.keys(byCard).forEach(sid=>{
      const card = grid.querySelector('.card[data-song-id="'+CSS.escape(sid)+'"]');
      if(card) byCard[sid].forEach(({s,i})=>card.insertAdjacentHTML('beforeend', stickerSpanHtml(s,i,true,true)));
    });
  }
}

function attachStickerDrag(el){
  let dragging = false, startX = 0, startY = 0, origX = 0, origY = 0, idx = -1;
  el.addEventListener('pointerdown', e=>{
    if(e.target.closest('.sticker-remove')) return;
    if(e.button && e.button !== 0) return;
    dragging = true;
    idx = Number(el.dataset.i);
    const rect = el.parentElement.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    origX = (r.left - rect.left) / rect.width * 100;
    origY = (r.top - rect.top) / rect.height * 100;
    if(el.hasAttribute('data-song-sticker')){
      const layerEl = document.getElementById('stickerLayer');
      if(layerEl){
        const lr = layerEl.getBoundingClientRect();
        const cx = r.left + r.width/2;
        const cy = r.top + r.height/2;
        layerEl.appendChild(el);
        el.removeAttribute('data-song-sticker');
        el.style.left = ((cx - lr.left) / lr.width * 100) + '%';
        el.style.top = ((cy - lr.top) / lr.height * 100) + '%';
      }
    }
    el.classList.add('dragging');
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
  });
  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const rect = el.parentElement.getBoundingClientRect();
    el.style.left = clampNum(origX + (e.clientX - startX) / rect.width * 100, 0, 100) + '%';
    el.style.top = clampNum(origY + (e.clientY - startY) / rect.height * 100, 0, 100) + '%';
  });
  const end = (e)=>{
    if(!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    const idx2 = Number(el.dataset.i);
    if(!stickers[idx2]) return;
    if(e && e.type === 'pointercancel'){ saveStickers(); renderStickerSections(); return; }
    let target = null;
    if(e && typeof e.clientX === 'number'){
      el.style.display = 'none';
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      el.style.display = '';
      target = hit ? hit.closest('.card') : null;
      if(target && !target.dataset.id && !target.dataset.songId) target = null;
    }
    if(target && e){
      const tr = target.getBoundingClientRect();
      stickers[idx2].song = target.dataset.id || target.dataset.songId;
      stickers[idx2].x = Math.round(clampNum((e.clientX - tr.left) / tr.width * 100, -20, 120));
      stickers[idx2].y = Math.round(clampNum((e.clientY - tr.top) / tr.height * 100, -20, 120));
    } else {
      const lr = document.getElementById('stickerLayer').getBoundingClientRect();
      stickers[idx2].song = null;
      stickers[idx2].x = Math.round(clampNum((e.clientX - lr.left) / lr.width * 100, 0, 100));
      stickers[idx2].y = Math.round(clampNum((e.clientY - lr.top) / lr.height * 100, 0, 100));
    }
    saveStickers();
    renderStickerSections();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function migratePageStickersToCards(){
  if(!stickers.some(s=>s && s.url && !s.song)) return;
  const layer = document.getElementById('stickerLayer');
  const grid = document.getElementById('grid');
  if(!layer || !grid) return;
  const lr = layer.getBoundingClientRect();
  if(lr.width < 10) return;
  const cards = [...grid.querySelectorAll('.card[data-id]')];
  if(!cards.length) return;
  let changed = false;
  stickers.forEach(s=>{
    if(!s || !s.url || s.song) return;
    const px = lr.left + (s.x/100)*lr.width;
    const py = lr.top + (s.y/100)*lr.height;
    for(const card of cards){
      const r = card.getBoundingClientRect();
      if(px >= r.left - 20 && px <= r.right + 20 && py >= r.top - 20 && py <= r.bottom + 20){
        s.song = card.dataset.id;
        s.x = Math.round(clampNum((px - r.left)/r.width*100, -15, 115));
        s.y = Math.round(clampNum((py - r.top)/r.height*100, -15, 115));
        changed = true;
        break;
      }
    }
  });
  if(changed){ saveStickers(); renderStickerSections(); }
}

/* ---- sticker upload + crop ---- */
let _cropImg = null;
let _cropRect = null;
let _cropDragging = false;
let _cropStartX = 0;
let _cropStartY = 0;
let _cropFile = null;
let _cropQueue = [];
let _cropFromUrl = null;

function renderStickerPicker(){
  const shelfEl = document.getElementById('stickerPickerShelf');
  if(!shelfEl) return;
  document.getElementById('stickerCount').textContent = '(' + stickers.length + '/' + MAX_STICKERS + ')';
  const imgStickers = stickers.filter(s=>s&&s.url);
  shelfEl.innerHTML = stickerShelfHtml(imgStickers) || '<span class="sticker-empty">No stickers yet - crop one from the library above or upload your own!</span>';
}

document.getElementById('stickerWipOkBtn').addEventListener('click', ()=>{
  trackEvent('sticker_wip_dismiss');
  if(document.getElementById('stickerWipDismiss').checked){
    localStorage.setItem('bayoutonefm-sticker-wip-dismissed', '1');
  }
  document.getElementById('stickerWipOverlay').classList.remove('open');
});
let _attachSongId = null;
function setStickerModalMode(){
  const t = document.getElementById('stickerTitle');
  const hint = document.getElementById('stickerHint');
  if(_attachSongId){
    const song = songs.find(s=>s.id===_attachSongId);
    if(t) t.textContent = 'Put a sticker on "' + ((song && song.title) || 'this song') + '"';
    if(hint) hint.textContent = 'Tap a sticker below to stamp it onto this song card - or drag any existing sticker onto a card on your page.';
  } else {
    if(t) t.textContent = 'Stickers';
    if(hint) hint.textContent = 'Upload sticker images, then drag them anywhere on your page. Drop one onto a song card to pin it to that song.';
  }
}
function openStickerPickerForSong(song){
  if(!song) return;
  _attachSongId = song.id;
  renderStickerPicker();
  setStickerModalMode();
  document.getElementById('stickerOverlay').classList.add('open');
}
document.getElementById('editStickersBtn')?.addEventListener('click', ()=>{
  trackEvent('open_stickers');
  _attachSongId = null;
  if(!localStorage.getItem('bayoutonefm-sticker-wip-dismissed')){
    document.getElementById('stickerWipOverlay').classList.add('open');
  } else {
    renderStickerPicker();
    setStickerModalMode();
    document.getElementById('stickerOverlay').classList.add('open');
  }
});
function closeStickerOverlay(){
  _attachSongId = null;
  setStickerModalMode();
  document.getElementById('stickerOverlay').classList.remove('open');
}
document.getElementById('stickerDoneBtn').addEventListener('click', ()=>{
  closeStickerOverlay();
});
document.getElementById('stickerClearBtn').addEventListener('click', ()=>{
  trackEvent('sticker_clear_all');
  if(stickers.length && confirm('Remove all stickers from your page?')){
    stickers = [];
    saveStickers();
    renderStickerPicker();
    renderStickerSections();
  }
});

document.getElementById('stickerPickerShelf').addEventListener('click', e=>{
  const st = e.target.closest('.sticker');
  if(!st) return;
  const idx = Number(st.dataset.i);
  const imgStickers = stickers.filter(s=>s&&s.url);
  if(idx < 0 || !imgStickers[idx]) return;
  if(_attachSongId){
    trackEvent('stamp_sticker_on_song');
    if(stickers.length >= MAX_STICKERS){
      alert('Sticker limit reached (' + MAX_STICKERS + '). Remove one first.');
      return;
    }
    const src = imgStickers[idx];
    const n = stickers.filter(x=>x && x.song === _attachSongId).length;
    const offs = [[50,36],[64,28],[34,30],[58,60],[32,62],[50,76]];
    const o = offs[n % offs.length];
    stickers.push({ url: src.url, song: _attachSongId, x:o[0], y:o[1], r:0 });
    saveStickers();
    renderStickerPicker();
    renderStickerSections();
    return;
  }
  trackEvent('remove_sticker');
  const realIdx = stickers.indexOf(imgStickers[idx]);
  if(realIdx >= 0){
    stickers.splice(realIdx, 1);
    saveStickers();
    renderStickerPicker();
    renderStickerSections();
  }
});

document.getElementById('stickerUploadBtn').addEventListener('click', ()=>{
  trackEvent('sticker_upload');
  document.getElementById('stickerFileInput').click();
});
document.getElementById('stickerFileInput').addEventListener('change', e=>{
  const files = Array.from(e.target.files || []);
  if(!files.length) return;
  _cropQueue = files;
  _cropFile = _cropQueue.shift();
  openCropModal(_cropFile);
  e.target.value = '';
});



function openCropFromUrl(url){
  const overlay = document.getElementById('stickerCropOverlay');
  const canvas = document.getElementById('stickerCropCanvas');
  const ctx = canvas.getContext('2d');
  const previewBox = document.getElementById('stickerCropPreviewBox');
  _cropRect = null;
  previewBox.innerHTML = '';

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = ()=>{
    const maxW = Math.min(480, window.innerWidth - 80);
    const maxH = window.innerHeight * 0.55;
    let w = img.naturalWidth, h = img.naturalHeight;
    if(w > maxW){ h = h * maxW / w; w = maxW; }
    if(h > maxH){ w = w * maxH / h; h = maxH; }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    _cropImg = { img, canvasW: canvas.width, canvasH: canvas.height, natW: img.naturalWidth, natH: img.naturalHeight };
    _cropFromUrl = url;
    overlay.classList.add('open');
  };
  img.src = url;
}

function openCropModal(file){
  const overlay = document.getElementById('stickerCropOverlay');
  const canvas = document.getElementById('stickerCropCanvas');
  const ctx = canvas.getContext('2d');
  const previewBox = document.getElementById('stickerCropPreviewBox');
  _cropRect = null;
  previewBox.innerHTML = '';

  const img = new Image();
  img.onload = ()=>{
    const maxW = Math.min(480, window.innerWidth - 80);
    const maxH = window.innerHeight * 0.55;
    let w = img.naturalWidth, h = img.naturalHeight;
    if(w > maxW){ h = h * maxW / w; w = maxW; }
    if(h > maxH){ w = w * maxH / h; h = maxH; }
    canvas.width = Math.round(w);
    canvas.height = Math.round(h);
    canvas.style.width = Math.round(w) + 'px';
    canvas.style.height = Math.round(h) + 'px';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    _cropImg = { img, canvasW: canvas.width, canvasH: canvas.height, natW: img.naturalWidth, natH: img.naturalHeight };
    overlay.classList.add('open');
  };
  img.src = URL.createObjectURL(file);
}

function _cropGetPos(e){
  const canvas = document.getElementById('stickerCropCanvas');
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) / r.width * canvas.width)),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) / r.height * canvas.height))
  };
}
function _cropDrawOverlay(){
  const canvas = document.getElementById('stickerCropCanvas');
  const ctx = canvas.getContext('2d');
  if(!_cropImg) return;
  ctx.drawImage(_cropImg.img, 0, 0, canvas.width, canvas.height);
  if(!_cropRect) return;
  const c = _cropRect;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, c.y);
  ctx.fillRect(0, c.y, c.x, c.h);
  ctx.fillRect(c.x + c.w, c.y, canvas.width - c.x - c.w, c.h);
  ctx.fillRect(0, c.y + c.h, canvas.width, canvas.height - c.y - c.h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.setLineDash([6,3]);
  ctx.strokeRect(c.x, c.y, c.w, c.h);
  ctx.setLineDash([]);
}
function _cropUpdatePreview(){
  const previewBox = document.getElementById('stickerCropPreviewBox');
  if(!_cropRect || !_cropImg){ previewBox.innerHTML = ''; return; }
  const c = _cropRect;
  const scaleX = _cropImg.natW / _cropImg.canvasW;
  const scaleY = _cropImg.natH / _cropImg.canvasH;
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = Math.round(c.w * scaleX);
  tmpCanvas.height = Math.round(c.h * scaleY);
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(_cropImg.img, c.x * scaleX, c.y * scaleY, c.w * scaleX, c.h * scaleY, 0, 0, tmpCanvas.width, tmpCanvas.height);
  previewBox.innerHTML = '';
  const prevImg = document.createElement('img');
  prevImg.src = tmpCanvas.toDataURL('image/png');
  previewBox.appendChild(prevImg);
}

document.getElementById('stickerCropCanvas').addEventListener('pointerdown', e=>{
  if(!_cropImg) return;
  _cropDragging = true;
  const p = _cropGetPos(e);
  _cropStartX = p.x;
  _cropStartY = p.y;
  _cropRect = { x: p.x, y: p.y, w: 0, h: 0 };
  const canvas = document.getElementById('stickerCropCanvas');
  try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
});
document.getElementById('stickerCropCanvas').addEventListener('pointermove', e=>{
  if(!_cropDragging || !_cropImg) return;
  const p = _cropGetPos(e);
  const x = Math.min(_cropStartX, p.x);
  const y = Math.min(_cropStartY, p.y);
  const w = Math.abs(p.x - _cropStartX);
  const h = Math.abs(p.y - _cropStartY);
  _cropRect = { x, y, w, h };
  _cropDrawOverlay();
  _cropUpdatePreview();
});
document.getElementById('stickerCropCanvas').addEventListener('pointerup', e=>{
  _cropDragging = false;
  if(_cropRect && _cropRect.w < 5 && _cropRect.h < 5) _cropRect = null;
  _cropDrawOverlay();
  _cropUpdatePreview();
});

document.getElementById('stickerCropSaveBtn').addEventListener('click', async ()=>{
  trackEvent('sticker_crop_save');
  if(!_cropRect || !_cropImg) return;
  const c = _cropRect;
  const scaleX = _cropImg.natW / _cropImg.canvasW;
  const scaleY = _cropImg.natH / _cropImg.canvasH;
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = Math.round(c.w * scaleX);
  tmpCanvas.height = Math.round(c.h * scaleY);
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(_cropImg.img, c.x * scaleX, c.y * scaleY, c.w * scaleX, c.h * scaleY, 0, 0, tmpCanvas.width, tmpCanvas.height);
  tmpCanvas.toBlob(async (blob)=>{
    if(!blob) return;
    let url = await uploadStickerBlob(blob);
    if(!url){
      url = tmpCanvas.toDataURL('image/png');
    }
    if(url){
      if(_attachSongId){
        const n = stickers.filter(x=>x && x.song === _attachSongId).length;
        const offs = [[50,36],[64,28],[34,30],[58,60],[32,62],[50,76]];
        const o = offs[n % offs.length];
        stickers.push({ url, song:_attachSongId, x:o[0], y:o[1], r:0 });
      } else {
        const p = stickerDefaultPos(stickers.length);
        stickers.push({ url, x:p.x, y:p.y, r:0 });
      }
      saveStickers();
      renderStickerPicker();
      renderStickerSections();
    }
    if(_cropQueue.length){
      _cropFile = _cropQueue.shift();
      openCropModal(_cropFile);
    } else {
      _cropFromUrl = null;
      document.getElementById('stickerCropOverlay').classList.remove('open');
    }
  }, 'image/png');
});

document.getElementById('stickerCropCancelBtn').addEventListener('click', ()=>{
  _cropQueue = [];
  document.getElementById('stickerCropOverlay').classList.remove('open');
});
async function uploadStickerBlob(blob){
  if(!currentUserId || !sb || !sb.storage) return null;
  try{
    const ext = 'png';
    const path = currentUserId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
    const { error } = await sb.storage.from('stickers').upload(path, blob, { contentType:'image/png' });
    if(error){ console.error('Sticker upload error:', error); return null; }
    const { data } = sb.storage.from('stickers').getPublicUrl(path);
    return data && data.publicUrl ? data.publicUrl : null;
  }catch(e){ console.error('Sticker upload failed:', e); return null; }
}
function openWishModal(item){
  editingWishId = item ? item.id : null;
  document.getElementById('wishModalTitle').textContent = item ? 'Edit song' : 'Add a song you wish you wrote';
  document.getElementById('w-title').value = item?.title || '';
  document.getElementById('w-artist').value = (item?.artists||[]).join(', ');
  document.getElementById('w-album').value = item?.album || '';
  document.getElementById('w-year').value = item?.year || '';
  document.getElementById('w-lyric').value = item?.lyricSnippet || '';
  document.getElementById('w-why').value = item?.why || '';
  currentWishCoverArt = item?.coverArt || null;
  setImagePreview('w-cover', currentWishCoverArt);
  document.getElementById('wishSearchField').style.display = item ? 'none' : '';
  document.getElementById('w-search').value = '';
  document.getElementById('wishSearchResults').style.display = 'none';
  document.getElementById('wishSearchResults').innerHTML = '';
  document.getElementById('wishOverlay').classList.add('open');
  if(item){
    document.getElementById('w-title').focus();
  } else {
    renderWishSearchResults('');
    document.getElementById('w-search').focus();
  }
}
function closeWishModal(){
  document.getElementById('wishOverlay').classList.remove('open');
  editingWishId = null;
}
function renderWishSearchResults(query){
  const wrap = document.getElementById('wishSearchResults');
  const q = query.trim().toLowerCase();
  let source = songs;
  if(q){
    source = songs.filter(s=>{
      const title = (s.title||'').toLowerCase();
      const artists = (s.artists||[]).join(' ').toLowerCase();
      return title.includes(q) || artists.includes(q);
    });
  }
  if(!source.length){
    wrap.style.display = 'block';
    wrap.innerHTML = `<p class="profile-empty-note">${q ? 'No matching songs in your cataloguex.' : 'Your cataloguex is empty. Add songs to your library first, or use the form below to add manually.'}</p>`;
    return;
  }
  const cap = 200;
  const shown = source.slice(0, cap);
  let html = shown.map(s=>{
    const already = wishlist.some(w=>songKey(w)===songKey(s));
    return `
      <button type="button" class="discover-row" data-song-id="${s.id}" data-added="${already?'1':'0'}" style="${already ? 'opacity:0.55; cursor:default;' : ''}">
        ${s.coverArt ? `<img loading="lazy" decoding="async" src="${escapeAttr(s.coverArt)}" alt="Album cover">` : `<span class="drow-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</span>`}
        <span>
          <span class="drow-name">${escapeHtml(s.title||'Untitled')}</span><br>
          <span class="drow-bio">${escapeHtml((s.artists||[]).join(', ') || 'Unknown artist')}</span>
        </span>
        <span data-wish-tag style="font-family:'IBM Plex Mono',monospace; font-size:10px; color:${already ? 'var(--teal)' : 'var(--rose)'}; flex-shrink:0;">${already ? '✓ In list' : '+ Add'}</span>
      </button>`;
  }).join('');
  if(source.length > cap){
    html += `<p class="profile-empty-note" style="text-align:center;padding:8px;">Showing first ${cap} of ${source.length} songs. Type to search for a specific one.</p>`;
  }
  wrap.style.display = 'block';
  wrap.innerHTML = html;
}
document.getElementById('w-search').addEventListener('input', e=>renderWishSearchResults(e.target.value));
document.getElementById('wishSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-song-id]');
  if(!row) return;
  if(row.dataset.added === '1') return;
  const s = songs.find(x=>x.id===row.dataset.songId);
  if(!s) return;
  const key = songKey(s);
  if(wishlist.some(w=>songKey(w)===key)){
    row.dataset.added = '1';
    row.style.opacity = '0.55';
    row.style.cursor = 'default';
    const tag = row.querySelector('[data-wish-tag]');
    if(tag){ tag.textContent = '✓ In list'; tag.style.color = 'var(--teal)'; }
    showToast('Already in your wishlist');
    return;
  }
  wishlist.unshift({ id: uid(), createdAt: Date.now(), title: s.title||'Untitled', artists: s.artists||[], album: s.album||'', year: s.year||'', lyricSnippet: s.lyricSnippet || '', why: s.why || '', coverArt: s.coverArt || null });
  saveWishlist();
  renderWishlistGrid();
  renderWishSearchResults(document.getElementById('w-search').value);
  showToast(`Added "${s.title}" to songs you wish you wrote`, 4000);
});
document.getElementById('openWish').addEventListener('click', ()=>{ trackEvent('open_wishlist_add'); openWishModal(null); });
document.getElementById('wishCancelBtn').addEventListener('click', closeWishModal);
document.getElementById('wishSaveBtn').addEventListener('click', ()=>{
  trackEvent('save_wishlist');
  const title = document.getElementById('w-title').value.trim();
  if(!title){ document.getElementById('w-title').focus(); return; }
  const data = {
    title,
    artists: document.getElementById('w-artist').value.split(',').map(a=>a.trim()).filter(Boolean),
    album: document.getElementById('w-album').value.trim(),
    year: document.getElementById('w-year').value.trim(),
    lyricSnippet: document.getElementById('w-lyric').value.trim(),
    why: document.getElementById('w-why').value.trim(),
    coverArt: currentWishCoverArt
  };
  if(editingWishId){
    const idx = wishlist.findIndex(w=>w.id===editingWishId);
    if(idx>-1) wishlist[idx] = {...wishlist[idx], ...data};
  } else {
    wishlist.unshift({ id: uid(), createdAt: Date.now(), ...data });
  }
  saveWishlist();
  closeWishModal();
  renderWishlistGrid();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ closeWishModal(); document.getElementById('personOverlay').classList.remove('open'); } });

// the "examples removed" flag is per-account, so it stays consistent
// across devices instead of leaking between accounts on the same browser
function examplesRemovedKey(){
  return 'bayoutonefmExamplesRemoved-' + (currentUserId || 'guest');
}
function examplesRemoved(){
  return localStorage.getItem(examplesRemovedKey()) === '1';
}
function setExamplesRemoved(v){
  if(v){ localStorage.setItem(examplesRemovedKey(), '1'); }
  else { localStorage.removeItem(examplesRemovedKey()); }
}

// seed with a couple of example people on first run, so the "reminds me of" feature has real names to show
function seedPeopleIfEmpty(){
  if(examplesRemoved()) return;
  if(people.length === 0){
    people = [
      { id:"ex-alli", name:"Alli", photo:null },
      { id:"ex-jamie", name:"CW Jamie", photo:null }
    ];
    savePeople();
  }
}

// seed with a couple of example entries on first run
function seedIfEmpty(){
  // examples removed
}

function hasExampleContent(){
  return false;
}
