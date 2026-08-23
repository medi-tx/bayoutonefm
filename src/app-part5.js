
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
        ${p && p.photo ? `<img src="${escapeHtml(p.photo)}">` : `<span class="drow-fallback is-pfp"></span>`}
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
        ${p.photo ? `<img src="${escapeAttr(p.photo)}" loading="lazy">` : `<span class="drow-fallback is-pfp"></span>`}
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
  if(row) openOtherProfile(row.dataset.userId);
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
  const catBtn = document.getElementById('otherProfileCatalogueBtn');
  if(isFriend && p && p.username){
    catBtn.style.display = '';
    catBtn.dataset.username = p.username;
  } else {
    catBtn.style.display = 'none';
  }
}
document.getElementById('otherProfileCatalogueBtn').addEventListener('click', ()=>{
  trackEvent('view_friend_catalogue');
  const username = document.getElementById('otherProfileCatalogueBtn').dataset.username;
  if(!username) return;
  document.getElementById('otherProfileOverlay').classList.remove('open');
  document.getElementById('discoverOverlay').classList.remove('open');
  goToFriendCatalogue(username);
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
document.getElementById('otherProfileOverlay').addEventListener('click', e=>{
  if(e.target.id==='otherProfileOverlay') document.getElementById('otherProfileOverlay').classList.remove('open');
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
document.getElementById('discoverOverlay').addEventListener('click', e=>{
  if(e.target.id==='discoverOverlay') document.getElementById('discoverOverlay').classList.remove('open');
});

/* =========================================================
   FRIEND CATALOGUEX PAGE  (routed at #/u/username)
   ========================================================= */
function usernameFromRoute(){
  const m = location.hash.match(/^#\/u\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
function goToFriendCatalogue(username){
  location.hash = '/u/' + encodeURIComponent(username);
}
function closeFriendCatalogue(){
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
  closeFriendCatalogue();
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
    ? `<span class="feed-card-avatar"><img src="${escapeAttr(p.photo)}" alt=""></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const cover = s.coverArt
    ? `<img class="feed-card-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="">`
    : `<div class="feed-card-cover-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
  const tierBadge = s.tier ? renderTierBadge(s.tier) : '';
  const why = s.why ? `<div class="feed-card-why">"${escapeHtml(s.why)}"</div>` : '';
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
document.getElementById('linkedToMeOverlay').addEventListener('click', e=>{
  if(e.target.id === 'linkedToMeOverlay') document.getElementById('linkedToMeOverlay').classList.remove('open');
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
        ${s.coverArt ? `<img src="${escapeAttr(s.coverArt)}">` : ''}
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
  if(mostProlific) rows.push({ emoji:'🎧', title:'Most Prolific', name:nameFor(mostProlific.id), detail:`${mostProlific.songs.length} tracks catalogued` });
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
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,1);
  if(top.length === 0){
    list.innerHTML = '<p class="profile-empty-note">No SOTD reactions yet — be the first to react!</p>';
    return;
  }
  const ids = top.map(e=>e[0]);
  const { data: profs } = await sb.from('profiles').select('user_id, username, photo').in('user_id', ids);
  const pmap = {};
  (profs || []).forEach(p=>{ pmap[p.user_id] = p; });
  const medals = ['🥇'];
  list.innerHTML = top.map((entry, i)=>{
    const userId = entry[0], n = entry[1];
    const p = pmap[userId];
    const name = (p && p.username) ? p.username : 'someone';
    const initial = name.charAt(0).toUpperCase();
    const isMe = userId === currentUserId;
    const medal = medals[i] || '';
    return `
      <div class="discover-row leaderboard-row" data-user-id="${userId}" style="cursor:pointer;">
        ${p && p.photo ? `<img src="${escapeHtml(p.photo)}">` : `<span class="drow-fallback is-pfp"></span>`}
        <span style="flex:1;">
          <span class="drow-name">${medal} @${escapeHtml(name)}${isMe ? ' (you)' : ''}</span><br>
          <span class="drow-bio">${n} ${n === 1 ? 'reaction' : 'reactions'} to songs of the day</span>
        </span>
      </div>`;
  }).join('');
}
document.getElementById('leaderboardBtn').addEventListener('click', ()=>{
  trackEvent('open_leaderboard');
  document.getElementById('leaderboardOverlay').classList.add('open');
  loadLeaderboard();
  loadFriendLeaderboard();
});
document.getElementById('leaderboardCloseBtn').addEventListener('click', ()=>{
  document.getElementById('leaderboardOverlay').classList.remove('open');
});
document.getElementById('leaderboardOverlay').addEventListener('click', e=>{
  if(e.target.id === 'leaderboardOverlay') document.getElementById('leaderboardOverlay').classList.remove('open');
});
document.getElementById('leaderboardList').addEventListener('click', e=>{
  const row = e.target.closest('[data-user-id]');
  if(row) openOtherProfile(row.dataset.userId);
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
      <div class="card-top">
        ${s.coverArt ? `<img class="cover-thumb" src="${escapeAttr(s.coverArt)}">` : ''}
        <div class="title-stack">
          <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}</p>
          <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
        </div>
      </div>
      <div class="meta-row">
        ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
        ${(s.genres&&s.genres.length) ? `<span class="meta-genres">· ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
      </div>
      <div class="tier-row">${renderTierBadge(s.tier)}</div>
      <div class="preview-row">
        ${s.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
        <button type="button" class="preview-btn" data-preview="${escapeAttr(s.id)}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶</button>
        <span class="preview-hint">30-sec preview</span>
      </div>
      ${(s.tags&&s.tags.length) ? `<div class="tags">${s.tags.map(t=>`<span class="tag"${s.tier?` style="color:${tierColor(s.tier)};border-color:${tierColor(s.tier)}"`:''}>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${s.why ? `<p class="why">${escapeHtml(s.why)}</p>` : ''}
      ${s.credit ? `<p class="credit-note"><b>Borrowed from / Where I Heard It:</b> ${escapeHtml(s.credit)}</p>` : ''}
      ${geniusLyricsUrl(s.title, s.artists) ? `<a class="lyrics-link" href="${escapeAttr(geniusLyricsUrl(s.title, s.artists))}" target="_blank" rel="noopener" title="Open lyrics on Genius">LYRICS ↗</a>` : ''}
    </div>
  `).join('');
}
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
document.getElementById('compareOverlay').addEventListener('click', e=>{
  if(e.target.id === 'compareOverlay') document.getElementById('compareOverlay').classList.remove('open');
});
document.getElementById('compareTrackCloseBtn').addEventListener('click', ()=>{
  document.getElementById('compareTrackOverlay').classList.remove('open');
});
document.getElementById('compareTrackOverlay').addEventListener('click', e=>{
  if(e.target.id === 'compareTrackOverlay') document.getElementById('compareTrackOverlay').classList.remove('open');
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
      ${photo ? `<img class="cmp-tier-pick-pfp" src="${escapeAttr(photo)}">` : `<div class="cmp-tier-pick-fallback">♪</div>`}
      <span class="tier-badge tier-${tier||'none'}">${tier||'—'}</span>
    </div>`;

  const readOnlyCardHtml = (s) => `
    <div class="cmp-detail-card">
      <div class="card-top">
        ${s.coverArt ? `<img class="cover-thumb" src="${escapeAttr(s.coverArt)}">` : ''}
        <div class="title-stack">
          <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}</p>
          <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
        </div>
      </div>
      <div class="meta-row">
        ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
        ${(s.genres&&s.genres.length) ? `<span> · ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
      </div>
      <div class="tier-row">${renderTierBadge(s.tier)}</div>
      ${(s.tags&&s.tags.length) ? `<div class="tags">${s.tags.map(t=>`<span class="tag"${s.tier?` style="color:${tierColor(s.tier)};border-color:${tierColor(s.tier)}"`:''}>${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${s.why ? `<p class="why">${escapeHtml(s.why)}</p>` : ''}
    </div>`;

  const detailHeaderHtml = (photo, name, initial) => `
    <div class="cmp-detail-header">
      ${photo ? `<img src="${escapeAttr(photo)}">` : `<div class="cmp-detail-header-fb">♪</div>`}
      <span class="cmp-detail-header-name">@${escapeHtml(name)}</span>
    </div>`;

  content.innerHTML = `
    <div class="cmp-header">
      <div class="cmp-side">
        ${myPhoto ? `<img class="cmp-side-avatar" src="${escapeAttr(myPhoto)}">` : `<div class="cmp-side-fallback">♪</div>`}
        <div class="cmp-side-name">@${escapeHtml(myName)}</div>
        <div class="cmp-side-stats">${mySongs.length} songs</div>
      </div>
      <div class="cmp-vs">vs</div>
      <div class="cmp-side">
        ${theirPhoto ? `<img class="cmp-side-avatar" src="${escapeAttr(theirPhoto)}">` : `<div class="cmp-side-fallback">♪</div>`}
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
            ${p.mine.coverArt ? `<img class="cmp-shared-cover" src="${escapeAttr(p.mine.coverArt)}">` : ''}
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
async function openFriendCatalogue(username){
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

  if(!isSelf && !isFriend){
    document.getElementById('friendLockedState').style.display = 'block';
    return;
  }
  document.getElementById('friendTierBoardBtn').style.display = '';
  document.getElementById('friendShareBtn').style.display = '';
  const friendSongs = isSelf ? songs : await fetchReadOnlySongs(p.user_id);
  currentFriendStickers = isSelf ? stickers : await fetchReadOnlyStickers(p.user_id);
  currentFriendSongs = friendSongs;
  currentFriendSongs.__ownerId = p.user_id;
  updateFriendViewUI();
  renderFriendStickerLayer();
  renderFriendBadges();
  renderFriendObsessed();
  if(!isSelf) renderTasteMatch(songs, friendSongs);
}

async function openPublicCatalogue(username){
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

  const friendSongs = await fetchReadOnlySongs(p.user_id);
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
    openFriendCatalogue(username);
  } else if(username && !currentUserId){
    openPublicCatalogue(username);
  } else if(!username && document.getElementById('friendWrap').style.display !== 'none'){
    closeFriendCatalogue();
  }
}
window.addEventListener('hashchange', checkRoute);

document.getElementById('addTitleBox').addEventListener('click', ()=>addTitleBoxRow(true));
document.getElementById('multiCancelBtn').addEventListener('click', closeMultiModal);
document.getElementById('multiSaveBtn').addEventListener('click', handleMultiSave);
document.getElementById('multiOverlay').addEventListener('click', e=>{ if(e.target.id==='multiOverlay') closeMultiModal(); });
document.getElementById('clearClusterFilter').addEventListener('click', ()=>{ trackEvent('clear_cluster_filter'); clusterFilterId = null; render(); });
document.getElementById('clearRemindsFilter').addEventListener('click', ()=>{ trackEvent('clear_reminds_filter'); remindsFilterId = null; render(); });
let searchDebounceTimer = null;
document.getElementById('search').addEventListener('input', ()=>{
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(render, 200);
});
document.getElementById('filterGenre').addEventListener('change', ()=>{ trackEvent('filter_genre'); render(); });
document.getElementById('filterMood').addEventListener('change', ()=>{ trackEvent('filter_mood'); render(); });
document.getElementById('sortBy').addEventListener('change', ()=>{ trackEvent('sort_changed'); render(); });
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
      ${f.photo ? `<img src="${escapeAttr(f.photo)}">` : `<span class="drow-fallback is-pfp"></span>`}
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
document.getElementById('personOverlay').addEventListener('click', e=>{
  if(e.target.id==='personOverlay') document.getElementById('personOverlay').classList.remove('open');
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
const STICKER_BASE = 'https://aaqlnjdooeydtaihhdia.supabase.co/storage/v1/object/public/stickers/defaults/';
const DEFAULT_STICKERS = [
  { name:'Doodles', file:'pencilparker-doodle-7326514_1920.jpg' },
  { name:'Clouds', file:'springbreeze-cloud-8454873_1920.png' },
  { name:'Bird', file:'satheeshsankaran-bird-6790305_1920.png' },
  { name:'Cute Cartoon', file:'satheeshsankaran-cute-cartoon-7111833_1920.png' },
  { name:'Love', file:'satheeshsankaran-love-7111836_1920.png' },
  { name:'Halloween', file:'cindynhiart-halloween-5625737_1920.png' },
  { name:'Line Art', file:'anhl202-line-art-7082056_1920.png' },
  { name:'Clover', file:'pastelila_id-clover-7876940_1920.png' },
  { name:'Stickers', file:'forza1903-sticker-8170760_1920.png' },
];
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
      return { url:s.url, x:s.x!=null?s.x:p.x, y:s.y!=null?s.y:p.y, r:s.r||0 };
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
  return (list || []).filter(s=>s&&s.url).map((s,i)=>`<span class="sticker" data-i="${i}"><img class="sticker-img" src="${escapeAttr(s.url)}" alt="sticker"></span>`).join('');
}

function renderStickerSections(){
  renderStickerLayer();
  renderFriendStickerLayer();
}
function renderStickerLayer(){
  const layer = document.getElementById('stickerLayer');
  if(!layer) return;
  layer.innerHTML = stickers.filter(s=>s&&s.url).map((s,i)=>`<span class="sticker-drag" data-i="${i}" style="left:${clampNum(s.x,0,100)}%;top:${clampNum(s.y,0,100)}%;transform:translate(-50%,-50%) rotate(${clampNum(s.r||0,-45,45)}deg);"><button type="button" class="sticker-remove" data-rm="${i}" aria-label="Remove sticker">✕</button><img class="sticker-img" src="${escapeAttr(s.url)}" alt="sticker"></span>`).join('');
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
function renderFriendStickerLayer(){
  const layer = document.getElementById('friendStickerLayer');
  if(!layer) return;
  const list = (currentFriendStickers || []).filter(s=>s&&s.url);
  layer.innerHTML = list.map((s,i)=>`<span class="sticker-drag friend" data-i="${i}" style="left:${clampNum(s.x,0,100)}%;top:${clampNum(s.y,0,100)}%;transform:translate(-50%,-50%) rotate(${clampNum(s.r||0,-45,45)}deg);"><img class="sticker-img" src="${escapeAttr(s.url)}" alt="sticker"></span>`).join('');
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
    el.classList.add('dragging');
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
  });
  el.addEventListener('pointermove', e=>{
    if(!dragging) return;
    const rect = el.parentElement.getBoundingClientRect();
    el.style.left = clampNum(origX + (e.clientX - startX) / rect.width * 100, 0, 100) + '%';
    el.style.top = clampNum(origY + (e.clientY - startY) / rect.height * 100, 0, 100) + '%';
  });
  const end = ()=>{
    if(!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    const x = Math.round(clampNum(parseFloat(el.style.left)||0, 0, 100));
    const y = Math.round(clampNum(parseFloat(el.style.top)||0, 0, 100));
    if(stickers[idx]){ stickers[idx].x = x; stickers[idx].y = y; }
    saveStickers();
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
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
  const gridEl = document.getElementById('stickerDefaultsGrid');
  if(!shelfEl) return;
  document.getElementById('stickerCount').textContent = '(' + stickers.length + '/' + MAX_STICKERS + ')';
  const imgStickers = stickers.filter(s=>s&&s.url);
  shelfEl.innerHTML = stickerShelfHtml(imgStickers) || '<span class="sticker-empty">No stickers yet - crop one from the library above or upload your own!</span>';
  if(gridEl){
    gridEl.innerHTML = DEFAULT_STICKERS.map(d=>`<div class="sticker-default-thumb" data-default-file="${d.file}" title="${d.name}"><img src="${escapeAttr(STICKER_BASE + d.file)}" alt="${escapeAttr(d.name)}"><span class="sticker-default-label">${escapeAttr(d.name)}</span></div>`).join('');
  }
}

document.getElementById('stickerWipOkBtn').addEventListener('click', ()=>{
  trackEvent('sticker_wip_dismiss');
  if(document.getElementById('stickerWipDismiss').checked){
    localStorage.setItem('bayoutonefm-sticker-wip-dismissed', '1');
  }
  document.getElementById('stickerWipOverlay').classList.remove('open');
});
document.getElementById('stickerWipOverlay').addEventListener('click', e=>{
  if(e.target.id === 'stickerWipOverlay') document.getElementById('stickerWipOverlay').classList.remove('open');
});
document.getElementById('editStickersBtn')?.addEventListener('click', ()=>{
  trackEvent('open_stickers');
  if(!localStorage.getItem('bayoutonefm-sticker-wip-dismissed')){
    document.getElementById('stickerWipOverlay').classList.add('open');
  } else {
    renderStickerPicker();
    document.getElementById('stickerOverlay').classList.add('open');
  }
});
document.getElementById('stickerOverlay').addEventListener('click', e=>{
  if(e.target.id==='stickerOverlay') document.getElementById('stickerOverlay').classList.remove('open');
});
document.getElementById('stickerDoneBtn').addEventListener('click', ()=>{
  document.getElementById('stickerOverlay').classList.remove('open');
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
  trackEvent('remove_sticker');
  const st = e.target.closest('.sticker');
  if(!st) return;
  const idx = Number(st.dataset.i);
  const imgStickers = stickers.filter(s=>s&&s.url);
  if(idx >= 0 && imgStickers[idx]){
    const realIdx = stickers.indexOf(imgStickers[idx]);
    if(realIdx >= 0){
      stickers.splice(realIdx, 1);
      saveStickers();
      renderStickerPicker();
      renderStickerSections();
    }
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

document.getElementById('stickerDefaultsGrid').addEventListener('click', e=>{
  const thumb = e.target.closest('.sticker-default-thumb');
  if(!thumb) return;
  const file = thumb.dataset.defaultFile;
  if(!file) return;
  openCropFromUrl(STICKER_BASE + file);
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
      const p = stickerDefaultPos(stickers.length);
      stickers.push({ url, x:p.x, y:p.y, r:0 });
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
document.getElementById('stickerCropOverlay').addEventListener('click', e=>{
  if(e.target.id==='stickerCropOverlay'){
    _cropQueue = [];
    document.getElementById('stickerCropOverlay').classList.remove('open');
  }
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
  document.getElementById('w-title').focus();
}
function closeWishModal(){
  document.getElementById('wishOverlay').classList.remove('open');
  editingWishId = null;
}
function renderWishSearchResults(query){
  const wrap = document.getElementById('wishSearchResults');
  const q = query.trim().toLowerCase();
  if(!q){ wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
  const matches = songs.filter(s=>{
    const title = (s.title||'').toLowerCase();
    const artists = (s.artists||[]).join(' ').toLowerCase();
    return title.includes(q) || artists.includes(q);
  }).slice(0, 8);
  wrap.style.display = 'block';
  if(matches.length === 0){
    wrap.innerHTML = '<p class="profile-empty-note">No matching songs in your cataloguex.</p>';
    return;
  }
  wrap.innerHTML = matches.map(s=>`
    <button type="button" class="discover-row" data-song-id="${s.id}">
      ${s.coverArt ? `<img src="${escapeAttr(s.coverArt)}">` : `<span class="drow-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</span>`}
      <span>
        <span class="drow-name">${escapeHtml(s.title||'Untitled')}</span><br>
        <span class="drow-bio">${escapeHtml((s.artists||[]).join(', ') || 'Unknown artist')}</span>
      </span>
    </button>
  `).join('');
}
document.getElementById('w-search').addEventListener('input', e=>renderWishSearchResults(e.target.value));
document.getElementById('wishSearchResults').addEventListener('click', e=>{
  const row = e.target.closest('[data-song-id]');
  if(!row) return;
  const s = songs.find(x=>x.id===row.dataset.songId);
  if(!s) return;
  document.getElementById('w-title').value = s.title || '';
  document.getElementById('w-artist').value = (s.artists||[]).join(', ');
  document.getElementById('w-album').value = s.album || '';
  document.getElementById('w-year').value = s.year || '';
  currentWishCoverArt = s.coverArt || null;
  setImagePreview('w-cover', currentWishCoverArt);
  document.getElementById('w-search').value = '';
  document.getElementById('wishSearchResults').style.display = 'none';
  document.getElementById('wishSearchResults').innerHTML = '';
});
document.getElementById('openWish').addEventListener('click', ()=>{ trackEvent('open_wishlist_add'); openWishModal(null); });
document.getElementById('wishCancelBtn').addEventListener('click', closeWishModal);
document.getElementById('wishOverlay').addEventListener('click', e=>{ if(e.target.id==='wishOverlay') closeWishModal(); });
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
  if(examplesRemoved()) return;
  if(songs.length === 0){
    songs = [
      {
        id: uid(), pinned:false, title:"Babydoll", artists:["Jamie Miller"], album:"Babydoll",
        year:"2026", genres:["pop","contemporary-pop"],
        tags:["off-campus","intense-relationship","world-shattering"],
        heard:"TikTok",
        why:"CANNOT wait for this to be in off campus hehe", tier:"★",
        credit:"his tiktok",
        coverArt:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASMAAAEkCAYAAABkJVeVAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAAP+lSURBVHhe7P3ZkyZJkh8G/tTM3b87rryPuu/qa7pnuntmOBhgQADECACCFILclb0f+MS3FeE+UqT+C+4/wl2RBUGQC8xyBkD3zHRXVdddlZmVZ0TGHd/h7ma2D6pqbu6fR2RWdw0Gi4WmWMbndqiZqampqald9Mf/t/97AAAggAIhyD/2kr8AQgggEAK8Rpc/TdyL0vO3xk/8488AgBhjN51C4P8i/pa/pk48EmjKvx6m0KTvKTvQjRFBcT4b/zcI74nWn3sD/yH81win9Oc3aJ8e0HBKkbagpwTUxO0JbQGBWuVtgD1j+k4cLQ8R9eKnWIYWMRLgD0OmXX9J18Iv6SINIh5aL383/d//b/97FiGB43kErlSQv0DSMbkoFIVKO56ma8fjdPqH40l4kt7rNwAKSbiUx0v51tKvxU/zOSd+X7nT9M+CTn6/+d9vG99/+Pub/eVOu+7/a/5NBM5FsJYOQCDuqheVz9B6fufFh8gDFZnd+LEcrXwlXCKk3xqOTjkbIUvteJ38NB+AQH/83/73yWAccGtjiFtTg1keYDTgAiAiGGPgnQMA+BCAEGDJwBgT4+jfKAQ84w4hoA4ViAysNeLPaUMIcN6DEhxcBf0NEF1cxnO1LAHvPbz3yPIcwXsQUau8EBzOuxYuI/VLGa2bV5cJ028SDnLOoaorIAA2szBk4LyDIcZtjIH3nukm9EvB99TPSB2qugIA5FmOEMJa3DZdgUABAUHy8/AUQAQQcTuG4OGcAzwhz3LOo6pi2foghAATtJwBITBuYwystSAyoMDMnDRr/CayAAjBs0aeGdtLhz7QtvTewwfPA662LRBp221H56We6Kd58I32bjPL/FE7EBHzUQhwruaO1qFLCJxW+U7xGIlnjAGIYCRLTe+e0RdjGQU/Sf8JIcBa240u/OBFqEj7EuCDj3lretLZkICRwT5qQdpPOHsYGATPuK21cM5FOhsYGDLw5OEDMA85Hq8MHp1WMEpYHzzeuTzCu9vAZu6fSxBBKyUZgyh2BEgjpk6Jr4KoD4xlxqjqCrUIODIGWZ6BDMF5rti3AUQEYy1slsHaRngyPQJqV3M5au5wAOCdh6sdd6aMO8Y3hRAC45H6ZTZDnudAYGbIbMadKARUdY2gTPqc4FWIS1s479cEEYR5fPBw3sF5h7quUbs6MmkfpB3ceWmfX4MGzwMhBNTOMZ2krdS/rz7fCHqEhHMOtXPw3okQPr9exhoYa1BXNbzzPJBYE4VtW7KuA8lAY4zhPmMMSATRtw19/dA5x3zhPbx3cE7aXvpo7KvfhM4ypsT2EmGPhH9TfME7jLHCa6MVXt00MACPiLc3hrg9+QYZJ6CFhwgOQ6bVFEE6R5coz4Lz2uUiJvkmwOXgxvDOx07rxT+I4AyiCVljIwMFPG8d1kfHPlBcca79THZeByODgYI1Ftasj4qUaE9rAed/cukSJvPOgwytuT5Yy2sN1mlpjEGeZbCWtY+6rqMAtKLNnOdU22kcd/rUQdvHsBbmhRfY3ySug9/IX6GHOshgFUIAmWRgTqBbRmNMFLLduL8WkAi2JO8QArwIdXXKb9p30/75awmiCO18g2jNqTBK8TrHg+DVfAkTggd8wM0Jq8LqvgmEwFMzRGJ3Y/Qxdg+EpjEzm8EmKnld1Qg+RL8udAmgfiQahheidNNq5w9JJ2Un0yRrkNksMrdqUgRqqetd3L3f0lE1TBuIy9doMuloYo0BEmGf4tO8u0IojdOtbwpcXxay1ljkNo901/prPP1LklcMe0YeCg2mTvwOvys+njowLYL3sMYgy7hs3wS0M6jwCp0sA3TaFVk4tk2bF9qaqXesVTQaUdO5Ec4R9h0gmaoqb3VBtb8+oaB8Hvk9BO67SZru79SvC+u5nw9B7Ldp26dYjUwRVag16ZTOTVlSvhajDjDJ2qp8WrFngRasKYD4dztjwsBIiKwNrUKDNRORqpLeh2jaipDiZ5tAW32PjB19Ov7irLHcMVXg6F8SLS/Jp9vx03qlTGWsWdMS+ujJ+TdaV1quNE76O+aj9JQRVtN1y6gQO1dn5FToUpgCYEGgwHYCA4IFd0xjDbKMhVhGluNp2ZN6p9+GeNQ20gGZHpqnpiEYY2FE+9A2MGjsKOh0NvS0aTeOajNpeiQaoiFCZrk+RCQ9jmllrRVh1ggdRsq8m+ar0zdjLE+7OvmlYIjYbpb4peVXLU37g0K37ucBEfM+8Ufbv8elQNLe7TkORBu0qehgCDKLEBNMF2+IGpKkEPsd2w1ZdpggETMjI7Uwuap6zwUSHx2idwkWwHG7/gpMZJ5z145VclUfI1GTuM55OM9TQP7NjacQp449nTNt0G49G8L106BLZIUQeMhQ43QXYkMZtg+k+af5kNpkxKZkRNh0weiI3w0QaNWxExbLn9iNvHdxespgItN1gQ34/VoKUXe61tDFJtMXIqYTtw9rQqKrCKKkjj2dp69tUojhxLRQ7Rg9bay/VUiqbTIVBKm2o8KtTS+wIO1oUV1o6i6awTl1McbAh4aHFbSsLf6VGUBalqgVJHnGupIIKq2PfFsRQH3lgcSz1oIMzwy0fyrERY5kcE7LqTS2tpmC8zTRwQCs4mmk8xj/POgvdHt1RRnBq8GM2BKvLoWWzYSoEejxRwDgAQog8iBZ+ifSKUdDACdz4ZTJImN16quGcwWN223EFFI/jd/Ky7PtgETQZ1kGkpVHV9dtxumBFHcKSk9t3G5ZTSJESRiv26YxXDpZlnH5WGuxIJKVLlKBpMKCaX0eLVT7IiKQ4TZifpB2S6S0lhWyWACxcxkR1vy3Tf/zXBdimGHbTvDMJ0yLdrup4K/qClVdg0AyXeWypZ0pLkSfky9aNUzo3EMv7RPoCLoQAjwBZC2c90DP9D5tT53qpbTvAsXWS/wknvILGXCbdVwK3IqiQ5NqSsIUYM+0HjGd/PbwcGCbVYuuRDA6HSNddk+Il7qmOuya/xsfQ8R7fsSW0s1MqaGdKUjluIlFJY/TlcZmwvZFjc2gHUydNTaqfE2Zz1dntXxRQIqtKi23xktB6dN4tD+VGjGdFFsZXu1xTRkbSPPWemm7qNM0Xdp2caV+zV/hGQKv+BCYRuA2847thxTpKwJJGMwYaXGpmuYYxN4Vjb9J5yISrVkz10T6W9o5yzIY0h1XMQjP2LnxbBAbBZefO7CRlVAkvMjTe4mT0Dyi6bRLA1rSNoQgRqhEq48DbdKeQU0RPbyQtm3avqp5DIdDFEWBuq7j1hpN2+otkfaxxZpwbdCkaVhBSOvV/Pbeo05WeJkWDT148OAceFVWtoukv71H5WrU3vFWAiN2Wc3Iy1JwOrVpEUHUGILM30E8VgYmMiW/DXF4qwGFGFxR9m86mI7AkqeQiijIjm8lXYvELUgbS4ENsW3/bryUKTS8L04XuvRRHD4ROKl/97ubX5qn/k7DWk6mOpDpRwoxrWhjpELEBBn5wFqKaCpk2nYTA4Ilg8zkyEwWV6GsOGJOgxEU5LnTWGNhAu9NM8SDuba5R2hcQNSMQbKcbdm+kgpg5afnhS6NWv5GzA7pKlgiQFSjMDLlpWfwQWrQbvJsNEeJDYTAU54ABMf75XKxPxkQMjLIrGWuFtyBmD6at814m0daFqNTSVkZS8O0h/gg9CZCiE7wSz48u+CGJAqNVhUMgsw5uEXbvzUjHwjJ3CSWIChOERD6DdJZDPOuh+cw0b5MQOBRUokhf6PGkBik+0AbEjLPBpCsPHQSBrH4Iyl7u70jEJFoK90QJCTvDQQ6zKmdv8tc3Xjd79SvF87xjgJC2yhpKxUS2ukiUCJA0pFXGJOkU0HKYzOeTiHJj2SJmrTDderSVy/F2zgjU7RkJBXBooKJpYTWkTVaLo9uZESrjdQO6B2PhDFvzU/I0xJGHdqnful31z+GJ7Ro8Pbv5TGimWXJylY33/PKo2VXv2aQYcN7CI1WwFoSwdoMeZaxNtjlA8EnlGvaRfPVbQ0AyrJEXddcDqkXx0r7Rjr4nUevVi2Sz3P6mGiw6aAK4d+IJgEV9EwLrpPNePajOAIPZJwhGQPnXNzToSN8s9TfU6gUxGajlaCEmbUQXjffSViA/FYUxP+RUZuPg11blWqYvNUpzoEuM10EXUbrQgtXJzgNO89BRlVrLYwYAZv0smokWmTamTQvI/ubmGyN4GqWh5sOp8wC8DjTlKPpbI0Dj4xxEYNXcnj6pQVkJuKyynfavsnelCDtQ/AwYBxEqpVpfcVozYpWbPe1sqlf0ilb3+K0A7XTK++025WkQJTUl795pY86RleFND0Pwm3B1cRnDYB52MMYi0ExAMmOdd5UKURJ8mmVzyjRmn6kaZwM6FmyBysN73aJZiMmYvunkGZDoiVRotmkdeQ81lf4NCzSU+ofgkwBhXcCPGtEKhyT9EaZO8i2cZ17xtFZMlcGk7mYBEkGIcRORsR7t0NUZ9vz7zTzlIiMiw2NCGyUI9LjIZIwdQptul4ISqy03O2GbOqUpkkbI4LQrNvwF4LkAdUmk6ksSWdQrlDhwg3G6Uyy1SBOh3Xp2fKUVFVtigMDQ5MPGGdfnSLwAkHwDiG4eORGY1MIsu+H8/TewdfM7D6IrQQBJPaQTOJq59G21rpxPdbLk9aTcQUuf0+xVfsxIlBUsCu7U0IbbjTpZDogiOasCyAKIbE3dcuXAoconYg1QALyPIe1Jg7CZNgUUsvGQ9LBJwo4nibbhEfbXbaBvvKkPL0O2nfFPqylTrQT5emmdRre8TIlNyIbNJe0H6R5E7HBJQoE6V8hsH2SkjgBWD/1wYkbadi4ZmRj1xCi9Ttm0J4WaSW0IrGgUgHdJxSg+4wSTUAZM3HaPiQd63mAhBnOK5cxbS2sN7/kN1QgJfEvAopqabNdQbWallQL3HIxf0Nx6sudrRHySLSSWFbNTwyy3dUjdFVsgRBC1IgAz6uVwQPBI8DBhxq1K+G9azalgvejUNwVzXzCAzv7E3FYo8FpGblevC8nmZpqKPERAR5sWbihU0cFFdQibQFov5MypH6dDkTQNlWtrg1NG3Dq7t+un9EFlZbNMhVqTCejNEkWXkxic1VTS5cy7bbs8F2PIFLcgG7wbGyaEDyMSyiltAkBwTX4OB4HU0dwh9AsXKUkpBS/avSdNtRwow1Awtz6V3JskJ7DBCmkzK0ZRIIBjK+nEOkUjrPm/InQSNVvCWJ5ZL+EMkNkEmVMLaaUmajxX6MDJfPl1KUChZqAIAdkQY0w4nJF82CTjrEkGg+PVz4EVBUfhA2qkSSgq6QsjFjLbFesASLRygBhVFbRjQGMJRjjYcijrpawFDAscgyLAkWWI7cZ8iwXLcnAEtjYbdjg3afxoCEP/+6hEQnTKu3ZlpXiacdVSHkqiMDXcPZnO2Q6XVWeTFdVW1PADm8jwdmUGy3apnlyi3FbxjjC58rvLfyCUwVZt20vAuaii+I3/J8O9EhoF0Rz8TIdVHoaQ3HKx/VWwZrQ6Jysz6NfCgadQuhKECNeH23X4vc4L43Of9cZI3VRNZVRJIbJXP+cujGcX/cIaV5Ac+JaNQxW6ZM66oiuLhIuxdPEb8XtcTpip/YFIulcetxB6ZwKL2HbNI0C09lHQcY7oZvxM82D2yG1Fxhu9rjJi+NaOYxcFBmy3CDLAGsNMmtQ5Ba5DRgNMmzNpiKIMgyLHOPhEKPBALm1cQuGNUDW2uAoXVAaK9Yr0rFxTX1Vg07rJHVUPLHDNrRRvxYvJZ06eB7kjGoprTJwhtZa1vysBcmUJgqpDt41J+XQvpCWKx2IdQC+6OC3CuAurj5I8+6Hpo5cj85uckh/Ehp574HE1uh7bjdQDX8NT9Kkmn4NxLSlaQlo7zNC084sxwMv90HnkCKgOFKILiA0mxg7hdSO48ENTYkKmpnEaKsudmC+OgIBvARMlrcWkG7Kk5E+Ycw+10cQ9ef0TTljzTsMnlKFwxtCt6JFaDOm5p1GNWIf0olBPIbQUxcFbTzVZK0esNT9MQIERNVfE1IgUDAwyJCZArkdwJoclni6lWcZhoMcw2GOIidklpppmq/gqgWsLxHqJVy1iFqSCqPJaIgrO5vY2ZhiOhyisBZZZlDkGay0EwFRALap0RHERNGImrYfGeYN5SlKaAX5bVNeSqd+qaYV25j9FUeaLqV7F84L65Yn+mse8bvZ7mJ0tSltb+2giXak330Q08V8OC+jeYoi0OrLEJ7wvJeAQjM9o7i7XjBRY69jR9zvg0cIfNVKWg6KtNQjMTFHAAQ2A7O/bgsg4oNGIKJoXLRGdr9qAwdR+WWJn+e0aAkjqBBKd2eqmCKe9JOskIUo0MSAlgiD9lYCJakyTzONIqh6mKja5wA3ktBBhIDG547dlD1JFQexgKC8kQxs2vj6reHcWXij5rodJC1nbBpdLu+E94KUV2nSFvjtGjQMrXRT2olQMjy9KrIMhc0wLDIU1oCCA3wFSw6+WsBVZzg9eorDvUc4OXwCX82RWYfMOgwLwuZsgCuXZpgMDTKqYXyJLAQRRnzGzFix5yRt2oB8J83EdFm37wGQPVPt6YHG6KNHGod6BE0rT8EUEhum4mgJKUnewtPhw2651S/V5EKQs1xBKSO9XUH5M2nbWJ8kXlrfKFBjX4mYo+OO6sE8JLMFzzhZmDcDPteLp+tBFzaC9omk9+jCVqfajTbOgseLsPNepq9JPzZMkObIRDo3N/HyKe5klKiXOvVqCtYP2pCkVvRkCbgbr+tYc2jmzCTqIqdtz+mfBxhnSrCkkeOvxIeUWMpowgjyf1PWZiqmddW/XdcdBfV3zLXzrX7yYw1fX1pKFgfUIMrk9DBwAGoEX8K7JVy9gq9XCHUJQx65BXIbUGQe0zFhudjF7sOvsDo7RG48LJWwKEH+DFV1gOVyFycn93H37gf47NMPcLz/FIPcYnM2xfbWJiaTMa+k2UwE0jpws/S0QA99AD7QmiWaX5cOXdDwlPbdsOgSriASwScu5Z0YP9lyoP5d3Om3akQk/K1tCkHNHZS/9b6hLp4upIKye8CdEu1Kp4Pt/JIyy3QUqe1SuX0t/6T/En828kCN2c3+RaJG8TAkx3OSNgkhwL7y47/7HhDw1pWJGPB4fxERTx301sGYvSKPBWkkuhKhj7GQaiWBNQ4IzkicTsMlH7EBI0FlhYnjnS8NScqlWkpIpqRQ1bVlwEesHSUMakgYhwPidyveM+rRF94HKa6Wf+p68KagbcG7pgPv+aEAMh7WeIAqHOzvYnF2jCwDhoMcGQEh1CA4GHIoyyN89fmv4MoFNmdTTIYFyFeoqwUW82McHjzG7u4D/OrDv8DhwS6sAQbDISbjKZzjBZA8LwAYUc21pZKpVLSnScFJ25ZAsp1B+Sl43o+vGyy7bYkO7brtkvqlafW3+gMqFBLtS8oTcUlDxDzO7bTrkJarSc/+IclDB16llXb083ClKnyLRxJFgBLhpOkR20WmYhDBJnGCbO2IwMcoGJQG2ufXDPJMqBCYH7ScRCYubvjAMyX78u/8vfcA4O3Lo1ZFWbWXhuIcBYkWngtgDC+7pMUlrpGk7SG+YjhnpFRopTFcnra/UPF8WcTAEo/rJ0Y5oL0PSv8i1XgkudbBSAOFkOwPkfA+SHFrnmmd0ngX+evv1L/7O/UDEK/hMEDUiEIokduAQCWePL6Phw/uwGYeG7Mx8tzAGgDeIbgS5fIUT/ce4PDgCS5tbYGcR7U6xdO9hzg9PcTuk4d49PAhPvv0M5wcH+H6tau4fn1HbAgZysrh5OQU48kEAQQnggTgdX9jLKzNYEm1cdkSEEd5pbnYL+T4g/dqb2vqqnTidmGefBbd9a/yfPyO7cv8TRyY0Jf5LsXXOBN7xkWwnq7TdloWx1OpXI7L6KVofWkgeNVmtgbaFzvTVCR1hiwkUSKUAcjmYomjwgYJjdKtIx4ILFHRDJ1JnRlR8xvNbRZyap9LRODGtyIkvEgwKNpEwnq515almmDVRu3QSW1OcYolnT5Vm7tOofkWY6ZWfE0Cr4MSz1oL5/g0NhvUmvDYwFL3loDpa3AtUzegVda237cJz4tPNQ7dpU7GI88CnF/g3t1P8KsPf4azk13ALWCpArkl4CpxNXxdoV6V2NnYApzD4dM9fPH5p/j8s49xcvgUT3cf46MPPsDJwQEubW5jOh7CuSUOD/fwwQe/wBdffIayXOH07Ayr1aqhsx6HUWZVessURutHMph5salETUq3QXR5Tn/LYHIRX2g7NYKvSa/8qUvbXjtxG0OvY95px1QeDdIBjW009D6IefWYYNbK2fGnpG5dXiTT7C7vQuyDYtNxzslSvm5k7g7kTX24gFJSLVIPHVIgsGLjHW+lyLMMBNn02JhFmwqdB0SipVgLk8mGLdmEF4kSK8dE0P08WrE+6fy8ECtJ8vscNJQwd13XfCk9S7BYPjZOi1Yk08hUACkt0vJSouYqQ8T6nsMICt3w8+J1QeNpfYjiSdR4CDKN1+AkEMl+IeMBVDg63MXR4WNc2hrhxtVNjAqgXp6gWp3B1yuQ9xgVOcbFAKNiisloG4uzJU5OjvDk4WMMszEsFXjyaBcUPHa2ZtjZnACuxv27D/H+Lz/Aw4cPMBoPkQ8KLJZLVJWDc2xbpJT5U/U/IQMRq0mUHLINRKDMIsuzeHhU4xK1bYcqkJ7HGdNsuqRUs1A2u6B9uoOp1kaFDzptEtLBrwevxoPSSAbeIDi1jCl+JPml22hSnF3cKWhaQwRjgBD4PnTeeY+mjaKg4YsDWxfRge3OuoUkpclFkNIICHIcJB1mnhO0Iyuh0GkEALFjaw4xXImXXjn5DQXURYIIEOYWR4YFD1FbkpOeE5M7hhrj+Dqa+K2jWydvJT4ZuZq2c+jym9Tt+UBUYSmgnvZunEcgubhLzogt5yd4unsfuamRZw6ZqTAeEIo8YDywQL3C/PgQX372KT768EOgJmzPruLtN76DF26/hDwbYDSa4uGDJ3jyeA+z2QRZFlAUFru7T7C3d4jxaAtvvPkOrly/BTIZvOfT3a0GaRFPGFJrpZ1Hvo1sJuUOwjYNXfGNbZVMm1rQzZLA9DCy016+9doaay3yPEdRFMiznIWSdHBIJ0vPeUHKS0kfiH7dsgiooHxuIHCessgUB/QEh/YrL9fUdA3VF0GIMyCK2qgxxC/1iGBK+ynHk76alKO96tzwfLesKWj/4M27Afal3/477wHAu9dmbQS63JgijKNwMi+W7eqRYNTsI4LOf0UAsWsXFlJ4Y9lQ2ZaWCQjDpX81Xp9LwRo+TJgKPJXeqV8XR4or/Z0aVbv5mcQwq3Nq5tYYpSW8U+jm9TwukGpIvLzqCQgmsCAC39FcWOD06Cke3Psc85PHWC32US2PMRzwqhecw9HhPg6e7qEql3DVCkWW49qVm7i8cw2j4RRbmzu4fuMmqrrCg4f3cXp6jNGwgLVAXdfYPzjBZLaDH/3kP8J44zpsPobJClhbsGoGvY2g0SCIRKMxMv1u7WInvj1AznKHwLd5EuSSunR1SLSi2NFJfkdtqd2OrQUZMdpCNRsSIS/F0DSaXnGxJpFM+aUPaN4sOJs8Fbq/U9ztfLiDs58ci6LGbkucQARkwk8hMRSLX4pTgfEGLjmpSiJakgg9yN1DEBprWQCxySVtqpsMSTaRGBLUKR1bMkUO4gbAe755wL7047/zHgF45+q0XVhBlHZ6/sFeRpFqgsDE6VY8JTipyhnPZDWN4APv+OzeuBhBhdA3gIZ4IoXlHxe1yTuGd8qauhRn+jv9ZmbgshqSToTmXuC+dN18UnwXAnFDpAsbPu71CKDgkJmAjAKWZ/t4eO9TnBw8RKjOMBoYDHJgMixwePAUX9+7h/v37uPgYB+Hh/sYDAeYTDZQVR6npwtMxxuYTqaYz89w994dgDyuXN7C/OQEIXjMZjPMNrfx1nd+gI1L1zEc7wBUxJ28IQoJKazQqFvvddrKni1pG7UzRSGgiyS6sprYleKAwBlxJ9FrLKSDmTi1kq4YmmM06tKVuxbuZMqkGPT/LnTr2K3r+cDxDBFINrjyU0qNluS87MRXfD14VUgFL0vtLQHVnt3wgkGzhcZa28JJxEyn8bl/JbzMFI+g8dZA9ishoY996bf/4/cQAt69NmtHVhyxjvqD/2vtuIbOOeXEfkc6p6AN6eSNpszyVafB86hiZL6uFYuwJoyYAeOXMC/HUWI38WNjJZVP8SlzRadaTSfNeZAycPrdx59xlNE9KmqUp3QEapdR48eR2wSEzh4rEwxMsLCeMLYZxhY42P0Kn330r3F8cB8n+3vIiDCbTODqFQ4PDvB0dw915VCvKuw/3ce9e/fx4OuHOD46QWZzjMdTHBwc4qs7X+LgaB/bO1uYzSZ4uruLspzj2pVr8D7gjXe/i81LV5DlE1Q14D3JiKZ/k70rFOSoCGJ9uK4mtqG2LfMX4IKHB98OoUJOVwwZ5K6szl421i5Em03sLUrbdvOIv0zrIYZzomZfTNomMZWYKzi98OQFGsnzABFzX8xPNg37ZO+RCslML2ATWqXl1HjaP9fttVp2gA9Hc5Ow/YdvZ2it5BNx/0/rl9C0mTM8A6jdN8gEEUYAvnN9A1BBIt1YiRwJogFJbgGBp2RJ45o4ip0DOspQ+7VUQ7y4h06jaZlSfyVK21+/G6bQ6VgXun4Rr4yyDZO3w7t+KeO2GqgTLwXe3Zoyi6ibFwCP8M13iGnkdsUQQIFgEZB7jwwOD+5+jHtfvo/V2T6q5Smq5RwWFr6ucHCwh6OjI1hbgMiiXJWoaofJdIbLO1dxaecK8mKIBw8e4MnuI0ynE1y9ehl5YXFyfATvK+SZwcnxMW7cvIUbt1/E7RdfxvblaxhNNjEcjOIUQg8Fg9kkjp5anRYdxDf6xdc2ZE8SkjudEruRlaMH3CaNRhWFUGIbsdY2Gis1gg9qfkgGQx98FEQqDFJhFv3j+T/qU04iaHz9q35dYJyN1sLn6tgMoivCIQTkOb/sm/ZVdHBqPt2/EprIhOaXPs/FNqMUL1q2IQg+pUUXuv4x70SAiQfsiz8SYXR1przdYhKmrDaYfAckhyx1ztgsgXYJogU67zskWgXphVc9oDKXkiV4JR/j43SKVwVRl0jpd7csjV+DvFVu0VzYJqSjOJdNtb42ngRvovVEP8XfKaPSVoM4OMQzQjBGzm55UHAwwcP6CiZUyFHh669+hS8/+SXq1RIHT/ew++gxlvMz+FBhsThFVa+wtbWJyXiCEAhFPsB0uoHZbBvXrt3AaDTF4eERfHCYTicwlnByeoLDwyNcu3oF3tW4f+8OptMJfud3foxrt16AR4bKEVaLChQMiiJrRlpfw9c17ysiNPUI3OmZprK9QvmMEO1GfC5R272x9YXAb+kZMTaTagBJu7ZcbM/2wCkt3DC/xgs97ajahlxsFnlXy0eNwND4EYcIuosgCg35NkJE9U9XE22nDOjwq0KrnBF3d8GG6cL0lEsWJVhpysj4L59fa/IkEfp6XMuQjXyr/N2UqRFEnBbNNO2tSyMuSKY3EAZkGc8XvecslEFaLSbNauMJcZbizrvINK24nYbVObnX50rkSAVHTuJTo7WkONrCSJmKIUgjUHJvUJr3eb/TESIFLQe0cXWzlj4wqPPrhCniFEyYOuJRnJ0GaqCpI8WO2ghBvnGWbUPG1/D1Aq48w9nxHnIqcXL4CJPRAEWe4+NffYS93T3kRQ6TAePJEBuzGYpigCAXUj95soez+ZLpa3LMppuo6hInp0c4PjnC3u4TPHz4CGenZ8gs4WD/CRbzU1y9ehVb2zt4+vQI9x48QlUxMz7Z3UNZlhgUBeqywmAwZJU/YULVnplP5B5soZnSud2ibXqRCAXtkHztcVsrV744Ly13ODkOlaSLZ8bS9IlQ0XZNBUcrXx0MBa/yn9UlccPbSLSua/UUXo75J2WwyTYZr3v4Ek1DhY5qcSlO+SE+PCCEJB89m6Z0IeIpYkzLFG6hScMMWVhizTPmn8QzqrXaRJ4EABRgX/rR334vIOCHL1wG4r3TXMi6ruER5ByQ7LImdkwsIZAwWFvK8vw+LahC6pcSLc9z5Hkuqx1Jw1MjhNojWUrIhpk0TSqo+oRiGpc/kk2V+p2UocMvHCUNF/Ko4stCHayxJWk1rumO4hDNIBlhja40xW85dCx2O0IF8iuE6gSPvv4UX3z2l3j08CuMBiNsbm7jk08+w/HpCc7mZ8iyHA5slCUCTk9PsVqucHB4iOVyidOzOZ7uH+DunQfY2z3Ao8cP8eVXn+Pp/h5WqxWKfITlssLT/ceYToYgBIxGQzjvceXaTVy+dgPTjW0UgyHKZYkPP3gfJ8dHuHnrOlaLFawxWJVlcseRTHGFztE/EJA8lZTSON2apEDJVCmlqYbpX/2dQghBbJ4Nf7T5uA1koqG0Fc/Y5sURlyytazvG/JW1tD2FN3TqmYalLiTl0vqp0IFM0TTt8wLFMjLP8b6hRKNTfB2czUwrnWYxkCwaBKSaWhoufVdW8IBEGL34o7/9Hgh469KkObxm2XbDjK/zU8HaU1cCEIKXCrVv9NMCp66Vlgh5ngNKbC5pK476kPABpJGVkS7CbWTqlAq98+Jrp3geMKKmq5DjXauKX+nWqO5IhCvABO0tQwckaasuKuQQHKzn3dPHTx/h41/9JVaLE5TlAhvTLUxGY5ydnWKxXGC6MUUxLDCeTAB9PtzmODk+w+HBMULgc2Sr+RwFGWxOp7h0aRubG1MUucXmbIa9R09ArsZ4ACxOj3BpZ4tHZRhsXbmC0XgLJssRYJFnBWazDTx8+BCnZ2e4fOUSrLXIspxXswwLX21uYw3IWBCkQ0gVu/RJhRELINZ8W0I9SZN+p8Ij7djahsojrfSqASUG7K4gCnHbiGpaLK00PvNpc+BbvzWXNF76TdIXefBp4iI5t0bUnhJ200PqmKaFCDCuSiNQ0jQSkf/vsCiFpq7dNCEEBNEoDZlkIwfLCO9lc2Y8jcFpiMDCKAD4zvUpal8z4xsIQ6QZcQKSp2goiBqpRI3aUhvSwnb/QkYUHZW4IkyofsHQbiz5gnZ0DUuBhUZ7D1M6ciq0NCKQjMitKJKvGkabuhITJhJXmSMtU5+AViZpAzMy4oXo7Kt1JsnXOY/VagEbSuzev4s7X3yCo4N9LOZLXL50BfOTYxw83YN3FaazMcrVCpm1/FKvA7y3OD1dIQSD6WSTpyWuxsAQNoc5Xrt9HW++9gquXL6CjckMozzH9nSIIpSYDQtc2drE1sYGXn7lNWxfuQZTTGCLIXzIsCorOBeQZQWmsxm+vPMVTudzXLp8hTur97HdIt9ELYgrbUhWZuQuHQR+FCc+XUVNhzKWmDcNu0g/xZtO+3p4UX8r//F0W4oXNbNk4SGxT/UBt5HgFLy9kPBQ6ByMTYUg5OoeWZRkm1rgRzN4wVJtto3d1pBhEskqdYt/tL76n7Jc0gf4r8T3BEOWHymT5/aIpDwxbyGxtIm2FV8pxP8HsXlqP+bojb3NvvDDv/0eIeB7t7eEGLrbsk3olPBaUHDeAMAqtoQr8c9rrC4kChuniYIooRQClEmDzEdJ5rhIStuXpwoB7gRJw6jKvSb4mkZJodVAHX9KNZ8kbaqmx/hJGc4DxtP1VdQE5yvkhnDw+D5+8fN/hUcP7uDpkyfIRmPkWYadrU08efwIe0938ejhQzY+Hxzg5PgEq8UK5aoEvMd0NEJBwDC3GGQGg4ywszHFq6+8jDffehubO1fxyqtv4o233sbO9hbqqkSWZbh27SZee/MdvPbOd7F95QY2tq8CpsBiVSEEkjU+D7IWNs/w5MkTbG5twmZ5Q18mBLeraOFKy1h5/ZPQS3+T3JXUR0dKhD1fi9FoCGmctW9p25Rngm5B0f1G2sadsqV8n5Y1NS3EsERjCmCtIaZPB8ama0QgYr71ssnS6IVzun/KsEDXsrMwbuqalg+ShTG8ghy17hQSe2fs8D306/fjF1K8boi2PMhrGUieyQYA++KP/kiuEBnDew9rM2RZjhBkKbSDmpG0GYBtce1O16rsOSODxmkaIV2NavJh106jvy9yUQMRtV8FGOlUtKdh2nWTuB0thi4oh2pNJhGUCimzKrP3usRGpE7T8V9eXKjLBe589ivc+eJjnB0dIM8tDo9OcHJ6gis7OyhXK9y/fx+bm5sIzqFclaAQMMwtRoMMNy5vYWsywMB6bAwzjDLCKDOYTae4fvM2ZpeugwYTbF65ge2rNzDdvgQzGGFVA7PtK7h08wUMZtvIRxs4WVU4WawAshiNpyjyAnmRoxgUGA7HyHOenhV5IfJHHvfraUeQdki0GbfH9aVPwyBjNFHS0dLOJaBto9N/CN7IM8zksT9wevbnsAQZmElSm2m3rKlf7B9puaPWwZ8pdNPpCQN90FGFehCtQ/m/i0PxsCDiGQSwbrsSdTP6pQLp2dBe5UuLQdJHvF4FzZkHvs5Bluqc0zMp/Nfp6XxFv1aYbktcDC3py23KPzsMsg6iEcnyI48O3bI0kDZadxd0Gp6Cnj1iDbFhkuav6HGJQFHQxksbOv2twjH1W4NzvAEIEwR+qcNVODs9wOHRHgg1bt66AR8POQZ8+smnuHRpB2+/8w5AhGIwiAJ1UBTYGBUwboVQLbE5LjAb5ZiNMkxHOTY3JpjMplisVnDGgIZDuLzA7Op1vPbd38K7P/pdvPTW9zHcuIKzkrB7cIJlVcPmA+SDgo251iL4gLqqUZcVptMp8jxDuVqA+VlWOeUlEWvZ6UV+DSGUQZSe6XSuvw0VmDVkipw8e6XTtvPSBnnvTHc3Z1kGxOllA1HjIYrTwfN4QP92/ZS3QnoM45xytfhG80y+0wFOhQBJfTVMBQ8l+II+PSVXzSrdUrqHji2tC5TMAhSiMIz1aq4LgfQuzSogwL7woz96DwC+d2MbEG0EyfzRyHM0aTHSDBviJhE6kBKJNYdks1rnWoPmZ6Pe6oik6ibpd/K3Sd/+3ZTvPEZJNBRNGOvPBvk0ja50mR68XeiGtZmlv0xcn7Qe3GRsqyMQAbUrsVyc4OxkD5998j5ODp8izwy2trawc+kKZrNN+LpkQeACxuMJRuMxnPOYLxYYDjJMxE1HBaajIYZ5BguP4B3G4zEmG1tYeWCwsYXJ1iUcL1eoao9PPv0cP//L97F3cIT7T3bx0cef4Jfvv48Pf/URjo6OYAxha2MLmxubyLIMrnYICBgOi7haulotcXZ6AmMIxaCQhwByniYEA0IG7Qj8uq0KICUsX39KBFlmXh9oEOnbCC4wxjWap/FDXBRhzaZvwEkhSKfTr6YdGw0LF/Alg/QFXWzpmhOo0ZDW0qa8ZHRxQwUK215NcjEbl43Rpbh4UOdysx//1QHMiy1N66TaF0JQhu2XE6rZigLCxvAmlpYJRI0w+s71zVblVYI2kr/dCPyZEjgNa8ftdkKNQ9JoWmCFSDSV4BJfBYGWLy1vipd/JHlIZVMBwgVu0ipe3UDXfa1E09ksg0muv03z7gLn01eWbsTUUaQlx+eiWrlhICDA1SVWi2Mc7D/E13c+B/kKt25cR54XqFyAczWCcwggLBYLTCZTXLp8GcvlEs7VMAgYWINcRv3BgF/7CCEgeAcr9x1XLmC6vYNsOMaiqvHl3bv4f/3T/xF/8i/+BF/fv4/d3V2U9QrXr19FVS5x/+u7+OX7v8SHH36AxXyBy5cvAwE4PDpCXfOzSo+fPMann32G+19/jePjYwCB95zIVJ/Ns1as0fzdIhi1tZMmrEVEoV0jSFL6t5yu6iXtqEvd2hHT9PobyepYA93vi4ES4QfJN/r18VbnE516MX9THMBCCCwUxW7Td32J9iPnHL8oLX0+FaTQrDv1RzLFA9iGJY/XN5Dwe5quq0Vaa2Bf+K2/9R4Q8N0bWw2CHlgrHEFGglhG8e9vfAXFo5srQ2g2l6U4lLhp+jRO97ubXyOs+K+VOT+omVOfmz4hVBouP1T/X0/XdRFPQ6fUyUah9XRJ3vyb748xloVguVpgtTzC/tOHWC1OEeoS08kUIIvDo2N8/fV9nBwfI8syDEdjnJ6dIS8KHJ+cwtU1gkw/rLzyOhoOMBgOZGuCR24JRWZg8xyj6SaQDTBflvjFX/wF7nz1Ja5euYpBNsDTvcfILeH6tSvgV2g9xuMBTudn+PSTT/CrDz/C3t4u/s3PfoY7d+/iYP8A73/wPj77/DM8fbqHO3e/wseffIy79+7i6OgQrq5Z+JBs6msNOKE5Zd6Cdbopzbr07sZJ00cmTmw9XYfkpgD0lCT1SRdlFPrwIekTLWGE0LvDmWSFLWooHVyIKVTj4O/WSl1P/kamUl4vlEvqS9KfvNik+iHwggUxDVuuB1RIpmBf+CFrRu9e3xR52oBu3lqH8wnRBzEOcSF4DsuahxaI4zSlT4mf4kgboYVboOuvwqilFSU5keYl6XVU0t+ahpIRC2jm4f2g6br+XejWQYRlp6EoqG0lwLsVlvNDlMsTlMtTzI+PUa1KrBZLlFWN5XKF/YNDLJcrIATMNmZYLpc4OjrGyekpiAhVXcGYgCK3GA4zjMYDDHMDkvuvc0soigHy0QSD6SZW3uDg+AyPHt6HJcI//gf/GD/96e/DOYf33/8ljk+PsHvwBAcH+1iuFtja2sKtm7dwenKCjz76CIPBEEeHR3jw4AEmkwkuXb6Era0ZxqMRYC32j47xxeef4cG9uzg5PUFZ1ZjOpsjzAbcfSGjaZt4WkAp2dbQmjLq9Y4130rZGY8hFErcvTS8E7p6qdXXTQXAxPzW4hfOEJ/U74Y8Lyt/2U5pBKx+1mDQdSbj6pTyv/K7l92tvpzWHk9Ha5HxBOyVBjJ/9audgb4tm9O71zTQJAN0X0zQQ/47io0XkrpDQ391voG3A5vm5+CeV6VuJQI/9KY3Tm1cnnKTBU62Lzkkf03byacLPEUbEc/UEXS+0DJBKT8gdRdHIq/88KNTw1RlODh9jcXaCR/e/xuH+AeanZ1icLfB49ylO53MsFgvUVY2yqnB4eCT7fppFiAAHgsN4VGA2HWE0yGBCBYsa1nAcFwhUjGAGU7z/yZf4y19+iNX8FD949zt46413ceXSNcw2Jnjw6D6+uPMFVnWJ3BqE4FGWJRACLl+5DGsz5HmB3/r+b2E2nWJjcwOzjQkmowEu7Wzh+q0XcO3GbRSWsP/4Pu59fQcmz/DSy69gPJo2fNAVLC2eZCM4ERvAm3hJGyd0TqHb7lCePEfMtNs/4Rf2jN9xqq9bD8RIq2kVfcSnHrrnpjNFZAElA6vyI3E61cA5uey/iv2+yTMtMyV94DzRsVZHja8SJHXKu119R7YvnAdBtDLnnU7TgO/d3O5kzi+VknQKKK2FjlqJlraQNFT6twukxr1OKZt0QuRz8JE2iAi1FuNoGWVFpptWPlqsltY7CrvWVK3Z4qBhYHkjTKh5ahrNTwPa4U1KLVsSXzpSglboERB8iXJ1gr0nD/D555/izp07WM4XWC1KLJcVqqpCVvCqWWYzBPCVu2W5grUZQAarsgTk4GpmiW+vRQD5GnCOHxU0GcjmKM0IXz7cx/sffYbHjx/jO2++ipdvXsf89AQP732Jg6ePYGxAXa9wfHSIQc53GK3KEqtFCecDxpMJTo6O8dprr+Ef/qN/iFdfeRkvvnATr754Ezcub+Hy1ia2tzYwzg1GucH+0SF2rlzFm2+9i/FwyjYkAsikU91mcUNdQ/uUhxsaa9s19I7enTDBkdiS2jgl/zVhET9A8rKOkcUaiIADwLxKwn/a5An+tfykb8U6JnFC5A/eI4TA0yofWDis0UXKp/4KaTdcS9OpdxfUi/8opovETxsC+OVi5xzsCz/4m+8FBPzghctJARoNpStoQM0eEIQgt9txw2k8jdtXeAXFm0K6rT1lhOjXabCEzyKs16Hxb4evOw1vCTpp5KiuJqMQM1aCM2pt3Xy0IzUrh0287m8tqzAhAKLA7535CsvFMe7fv4N7d+/i8OAQ9ariDYyiRtssj1djMIn5/ugAQllVKMsK5WqJcrWCrx3qqgaFgExXTcnw9Cgf4uFxiV9+fh/7Bwe4urOJ6zsbONx7gHtffow7X32Ep08e4o3XXsFPfvu3sVws8fD+Q34ZIvDTRHnGu7GNMajrGm+88TqGeYaNcYGNgcXRk/u4++lHOHzyAJm8sXU8X2JVB9y4+SJm0y3Z9cw0YLfebqlT6PqnNIbYOrsMpPFih9S9RYqbhOeEdTW/NF8JiUKkpRd0ytm0dcPv7N/GF2SlresfQxMZwNq01CyWu513F4sm1zobwwtHQfppX19VSdgEhYhJswRkpa0LWkApOukUUAPIWIQAfulREKhq3yJSWi4SwZR4pdBbiT5IOiBXnr/TKdl5DaUCoeVa4Wtea9DCmSSQcahTBvHTfM/LeA36w7v1ASDL+PxmvbFsL6rrFQCH4B3qqsRoOADJJWM2y6QIBFfXcM5huVyiqiq4EEBk4XyAcwGGMjhPqJxB7XKABqi8weHpEsfzEo5y1FTgYF7h7qM97O4fILcGs1GGJ19/hXtffoKnT+5gebKL7c0CW5MCo8xgezLFpc1t+MpjebZCkQ0wHk1QrVawBigGFsvFCVbzIyyPD/Do7lf48M9/jg/+zZ/i45/9Ge5//ikOnuxiPBzy1bb377MW16VvIhNYK2oOSOMcel4EvbE7/Nbnmqj9YT541K6Ou79JhVyTRYMDzdJ3F1c3PyRCovlu9tHZ5EQ/9yUf+1PEpbOaRBBFXLKfSvt9mn/rbyJIGbiNKLmBQRUCjR9S5Ub6lRGDPJGBiRULPJJ6zwKpT5BopVJtqes4XkKoHjyA7hlqcCBOB3U/TZsA3d+NZ4fQ3eCe8in01aMF8kkkzKIdQb+RfHfTruXd798FblI+/2ctkBkWRsHXsAYoqwUIHq4qgQC+zJyAqq4RZNFBcfOKlEXtPYh4ubysa9QOcCFHWRNWNeFsXmP/8AyLpQdlYxyXhE+/3sPDJ/vICLh1bQfjwuDsaB/V/BSZCRiPBnBVib/4+c/w//gf/gcc7u/jh7/1I/zNP/wjbG1ewv7eAZ483oN3ASE4zKYjGPIY5gYHu4/w/l/8Bb78/Essz+YwzsEv5yiswXQ0wubGBtfFuS55+A4eeDXLtTp4X3t23bnhkfax2Z8PkgSKqxGScvOphMU4awkjtghpv1mbVnXsMCQ7rIlEc9cnxeNUs4nLAortSvF3B9SvGxaCvAISN0AGsYmpkz1hcp+R/o1lE+d9c+Ge9iNjDOytH/zN9wjA925dAolqz4WgaAyMBZNDiWmjA0DQqy+Sm/dS4kfoFKqr+bBrNhqm0I3XNGA3PZeF/7bL0I0X/dT6GTdgKW5JG8vCNOF6qndfObv1Vpr01VfprOkEr9hyTAAbr8XofHiwiwf37+Lhg4dYLle8zNvDOApkDbIsR2ZzYQwCYEFk4Z3HarFEtSqRWYPtzU0MRlM8PJzj7u4xyrrCC1d3cG1nBr9a4ORoHxQCisEQ+XCMp/sn2D8+xbIMePPtd/GDH/4O3v7u92BsjoePHmNVrlCuVjg+OUJdl5hNRtjffYyPfvlLfPLJZ3ggwiq3fIRkMJ7gzDnk4ymms21c2rmC4XDINBEBDaVxkHaWtmgvhDTt298+4kQg9Kdb1xoY2ltR0mk7lF86uKiTr0TgkqXF68mQkn4S2ziWX39r5CZNI6I5TgqUCMi07Cl0/dNvLY/eP9aNq8IOnSppvHj8oyOo7O0f/OF7APDdmzvRKKeV5u9GuBA1HVYRsx9ndqEgQqMNNUTTDW2NMzKio4MvNnqSXsPS9NrhU0NcE6+pR1q2FkO1ityJ1zlv1IXGv8NVIow4LeNpO2YoIsST5/zNO6+JHFbLM9y9+zlOjp9i/+kTPHzwCGVZASmTpllKHY21yPOMT13LGSqCRSA+TuPqCkTAbGOGze1tnCxK3N8/wfGiwmyY47WblzHOLcrlHMvFKduEbIGTeYmD4zlgCrzx1tt46913MJxsYLKxidnGFt546y288/Y7uHnrOmbTCYoig7UBdz77DHuPHuDJ7j4OTxfIbI7MWkymG1i5gK+f7OHgdIHtnau4dfMWhsMhP8stR2+5/OCbH5NBq69z8c/+tmJY55Euf3S/Y0r1NyR5NCtwaVxtGfXp4k7jpGzTFy8FSuJ016tYg9FrOngbYmqPVeHUlLwNffmhhxYyDMYwgGWQ866RCWjsRiyk+NMYVXySLQc//T/9dwEh4H/3kze4YsmdLpxBNzMOS4kc0Jw5IZHkLSBwQ0kdm8q2K02JEOn6Qzpt4tvLbEQy3vXh6PhHoSuqptatgTYOJPiD0IL9mrBeSIRRBGmYhCyMlQCYgMwaeF/h7PQQy/kxvr77GT7/5FdYzo+xmJ9i78kBEGzsAMHztMYhIM8yDIYDVFWNxXIBazMYuW+8qmswr1iQr4B6gfFogJdfeRHj2QwPd/dwfDJHFgiv3djGze0JQrXEYj7H8ckJyqqCyXOsHDDcuILf/f2/getXd5DlBbauvITNy7cwX9WwWQ5DHq5c4snj+/j63ld4eP8OPv3gFzg7OsD+030Yk2FrY4bJZIxbL7+OjSs3sHe6BIoJ3nznu7h+7Raflg9Mm0C86M5HCpq7pCA2GmZ2JmjTwdI2aToPQCxY06AkFX+2uznfeCp7Y2Isob8u5oiWBrG/Nrmt80cQ/JpWNzNS2uE7Uyn93fXTO5Q4X6aFbtBMBaYXvoslS8pwHqT3MGm5GLfcFCCDLOTsKB/Y5Y4Rbc7EMiKEEF+2resaQY6ZEAB76/t/8z0A+P6tHSEuQ1crUuDfHUO2dtLzRhHViPS7dRCygZY2I2dqYrSOMIrl6AB9A2EUw5JpkrBNL24k6bXxUnTtPS6J039pZGpoGF/tRJN1URTwdYX52RG++PxD/Pmf/ys83XuI/ae7mM8XQDAInvEYIn5TjAwg0xbnPJbLJSBlLVclajFuazrAA8FhNBljur2Dg2WJw0UF8h7XNsa4dWkTxpWoF3OQ3uiQ5xiNR7h16zb+zt/7R3jrzbfw6a9+jlFB2Nm+IsIioK5LVPMTLE6OsDg+xiizWJ2e4bOPP8JqucBkPMKNG1dx+eol3HzxRXz/t38HP/zxT/Hmm+/gtZdfw8Z0Gq+lYTqKoBEC8Qnzhp7c7sRn1QLkfb/+NuyFtNkJzPv6VyBt8y4b8TcLhCaMf3AdzukbEgZIHyHWYoxc0dvtZ71A1FtOSD9WbT7oAAhEnkS6beUclxaB8TEB9KK0EIIYp1kYQ+vLP5QMTNJ02ulFa5My00/+j/9doODxv//dN1uV6BKtD7rSdK3DS0fUwjQ4O/G04kl6osZIrCVul0nicoKW71o5zvFrmEuWcXugS4f4HUL72kEpRje+QjqqKHByZV5mZBCv52fWwsDh7HQP//Jf/FP85V/8a/h6iWpZAp5QVR7W5hjmA5ydnaGuPLI8RyCgrEqQ7OUaj8d8kl+MhlVVw3sgLwawFoAvMRqNsLmzg4UPWFUVJgZ4cWuCnaHBgGqgKmEA2MEAlA8w3djGW+9+D29/57fxwft/iV/87H/C66+/hGKwBW+HqG2OQAarxQpnx6fwS4cXX3gRFID/8Z/9UwQLbF26ivHmNnYuXcLrr72K7dkYq8UCZRWwqAGfF6DRGCEbwVMBE/iSL4Dgie9JSmkaomGWO3GIy85pGwmN9at7hWEHlD+av+2wLv+zn2gjonl14yh0/Vv4pCPryyTn5ZX+bjTDBldItCz9Vm1J+4yWuYtf04CHrBg3DfNizGahst4fgPVbIhFY2JKu/Mo9RwBgb/3gb7wHAr5/+1Irsz7o+nc7u363/iZJuhqRroSoT5ouxScSR77TFBI38e2WIY0HdOxWKe26eUbvc/KiPi2onTaFtTqFZHe1FiniCXCuBJHHwf4efvXhL3B6fAhXO+S2QPDAclUil02GZVliOBwhhIDK1TBk2G805OVl7+XOG+EOkvfSMwuyfBYMhjeeharG9rjALAcKVBhaj9w4jIY5tna2cPnyFdy6eQuvvvQKlmen+PT9P4df7QPlCY53H2Hv8V3sP32IJ4/u4HD3IZbHR4CrcHV7B5uzGQ4PD3Hj1m288/0f4uU338at2y+hXq3w/r/5X/GLP/sXuPPZJ/j6zldYLk+xfXkHNJqgpgIGmazOCB2T5kvpqpfFB2mfi+GZEVqQtrWm7fJH85un/pAB+SLeQIc/NK6IwDafJoJL4wbRTLoQaZLkzXF1WwRLbE3bxan2V8SV7rbQJNVykv11LYmNHhK37EVynESC7K0fyDStRxilp5LTiqUES8OJGkMzV6JL4DaOdFrWdWmekgOHdRuup0xdXC0XyycrMWiIq+rjRYJJfTisoVc3bhfW4nTsY7xKx6PFfH6KEPi4xt7eQ9z58jMcH+3zyX2TY7koERwLsxACTJbJsYsMZIxcLev4cQMrq00+wDmPEPhKD2MJZDNkgwHyYoAQgLqsMM4NZgODHCsMbY2B9RjlhNEow2CQI8sNRoMMy7MDPPn6Kxw+uQ+LCqEqgaXDarnE4dkR5ssFloslysphPN3AG2+/g42tHSx9jWCAul6iWp1h99FX+MW/+Zf49KO/wOnxU5wcHePk+AhHh/sYT6eYbF8DsjEIVp4w4g6jHYnbJOmK0n4qiZTk3MbqJCrk+mQZSFLHafv5CdJe63G0LwpfxKlQA8przwNxCpQIghRaPJXagTTMyM5sDU/TJ2nTfq8CKAR9iKPRkC6iR1zK1/oGKIXXBZLk2dpCRATDleVvrbxG7la+C2nhGj++qD7LMuQZX9jGhtskTuvrHLgggqanTt7o+Y4QM23nTlG6MwNfXGOGc/O4AJj4zclpa2y8v8YYPi1dlSVsZgAKWMzPcLC/h4Onu3CuhKtrlKsay/kKq0UN7wLqqkJV16iqCienp3CeL9p3tYvGXSK1TREgtxF7mcaQNbDFCDYfgihHYTNsjIaYFBajPGCQAUUeMBwQBjlgqALqOXYffYWvv/oIx7v3MLQOFAJ84D1N1mbwteMrTIKHh8dkNsVkY4ZiOkKwwNcP7uJX7/8cH/z8X+KX//p/wf07HyOzwLXbt/HKW2/gpVdeAlVL3P3oV6iOT5CFAIJDMA5IbDJEwvqdRtPWaTqXHhBdXwntWzB5Hmj6hz57zXxFItjSOM/Tl9ATX9uu28+eBxeDaFWxvzOvZ+lT2fLunDWWH2mQ7TlMOx4cfXKqX6dUCt57eLmaRLWkdg89BwKawURwGgCyfNzWVLjDaGdp1GNwgsae04Eghavrmg2mnt8G17l0HyjuVh7tGHFKF306cfvTMXCYbzk9XmAMIcsNssy0wowJMGwPTlwAmSCXezVXK3TLr05px3JB825GgrTBjLEo8gLGEKqqRFkuUFVLzBdnmM/PUNcOCITMFhgMBgAIde1QrlYoyxJFwS+slGWJsiz5pVHDT0/Vda2UgHYYmxnYIuPpWSDUPsCAMMpzzMYDbG2MMR3lmI5yTMYFBoVBZviw7jDLkMEgCwGjIocngjcWzhiYzCKzBhkAvjfQYb44wrI8RZZ7lKtTHD59guXpMU6ePsX8+BQb0y1cunobJ0uPe7sHqI3Fle0duOMjmMUKRQiwqAAqEUzgvQ/GICQuTosEdBpikrfArL5Mq48jGNW0dDsFdYRXt32VZwB9ADE0K9fJd7/g6/KHuj5QcdPwULsvKkQcUnaujPTR9DsBvZOaiJBlzY7txvHK63K1AsV9dTyl6paZiLePQDap6p1JTfh6vQHW4kjbyBhuG5wjtanTEC0Qtb+dqWQmGkYkXjIqdeN+Y3jONGv4z0nG0rypZxIS/0o792bd53ceNJ1A5vhyra/3jpdHAz9iWZVLZCagXJ5h7wm/Ars4W2B+ukC5KvmITvK2na68DIdsHwohYHt7OzKYLrWmQJTB5gOQyXh6VlWolwsYX4N8hWFuMRsNMBpmmM0mGI9HKPIc1hBM4E2KBNZ6siID5RaOPGrjEAyQW4vcECx5kK8wPznE0f4THO3v4vhgHxSAqnQALG7eehmeCvzq06/wyRf38elXD/DhZ19ivioxGQwwhMPAr2BQAeRkMJDe1uO6bU+6I1na2SSDbIzb2469nhG4A7FQCzLl8J41N4W+fnUesCBbjx8FkLgur2o6inyPtalhCho3yzJ+LaauUVZlvF6aH8IEirwQ4S2CW2ZO6ewpBS0T0UW5MzBfcjty/bgd7K3v86bHH7xwOUZUAj8PUBRA3A5GdlCvEU3+pmrxGuOof2p3Uq0oqaSGpW7N34j0NRChYqQUjWqY5g2xv5BI8ujbitOf97rTqUSjIzdGPiZUYGRSJ95XZMhjcXaAw6cP8MUnv8LT3V0cH/CeHFc5ZMZiMV/AGAMHDzIWg0GBPM9QVTwiFUXB2wJ0r4lzsomU93UQGeSDEQajDeTFCL6qUc3PYMoFRhkwG2W4PMtxZWOAzckA4+EwDihFMURRFIAhBAMEA5S+gvM1au9AwQHBAbJsi8Avc1RlielkhlVV4ZNPPsP+/iH2Do4wLx32jk7x2Vf3cHy6wGS2id/+nd/D3/2P/xjfe/ddvPzyC7h8ZRuUATTIeaMm1HX4R3fRi2P+kxsJVH7JooECRTukWjt4c2UgWRmKSqy2a8KjSXtHfNEcoe3OeLRYrd9oviHL4qwt8HdXs4p59dhwWuFiO9L00S9ZeUzLrcLHyBm/oFqlaobEtievmlGy6hwFYbJat5YHCUkkPgUgMxau5gPUxvBWDIQAE9CoVWkhzwOi5OyL2IYy2VQXw8/B0RVQF0MSrwdn9xtgIaaClDdekdyW1w+pVR9gLakPr8JFYd8EyMhbbvKmua501XWFs5Nj3L/7JXy1hHEOR/sHcFUN+IDVqsTm5gYGwwJBLrrK8gw+8IraaDSEzSwODg7gnJzIlymDHqDMsgxFUcDaAsvTJar5HEPymA4MLGpk8MjgkJGX+4kAfrpLHlc0hhffMgIyABlgbEBmHIxlGuXGIDcGFgEZCHW5wldffo6j/QOMRwMsV3McnZ3g3uNHuHP/a5SuwtVrV/BP/ov/HP/b//K/wIs3b+Bwfw8f/+p9/C///P+J93/+J6jnx/KO2nobdM0LymeqEVHcryQdRf/14EKb854LSKY7fMc3P3POWlPj1vNSSceOHzGQS/1bg3EbCM3rtXqnuGpoaaxuWv3WeHVdo3YOWSavOCfCB4k9qSVkesqkZhnFrfH6IE2rM6UUv735/T94DyD81otXziVACpyZIm6IpkjPEzh9uPVbw7QRJDTWiYTJ0nRraRMcLFzSW+lIbDxMJ+lTPHLGoxfPdpxf+7uPdVNmYpeMlNEJ/eRX8A7Vco4HX3+FTz75kLdUB2D/4BBVWaEqKwQfsJgvcXx8DE8BgyIHQkBZVSgGAyyWS6xW/Iw07yZnmvkQMBgMAVHPbZbDVRVWi1NkocQ4J8yGFkMDjAYBG0PC1nSAIs95GhmCCCERorLjlju07n7m0RVQg7lB7QNCINQu4OjkBHleYDAa4smTx6hdifGowOVLW3j9tZfxB3/wU1zameGjv/wZ3v+z/zfuffxLPHl4B0+f7uH45Aw7V25itnkJHrk8fd2msa7lpPtalLbrLaQQkutdIDzHl9sRV7Dd3msaSYOZy9GeUbQHNw5v+kzTT7p14djnD+5BrhSJp/NFsPFvBmqVU8ovn0H2JSG5miQtNxpRKXSQWQN7tOIGwUfU3qsXyy0aa1Mv5fpu+YiP+2jWuonpIghBzr04log812QjdR90CfnrQpdYfRAFouVVHf2+CJRoqTsPLgj6jYAAmAD42uHw4ADzszOMx2OcnZ3h8OAQp2dnqCpernfeYTqbYlAUCAionQMBWK1WWMwXqMpKRmJmDFbDect9Zi3vLfIlFie7yMMCQ1NhmFXYnGbYmeWwbglXseHSe4+6dvAyteWyNtNmI5e45YYfOCTS53r4L0/XiaeSmcXdO1/g+HAfly5v4fata3j7rVfw3Xdfx8svXYOr5vjo/V/g849+icP9J1iu5ghkMRjN8Npb72Jr6xJyY6WLCt06++xCCKBkk6A2fZBjEH280Of36zRzCGwzco5ppni5L5/PY13/bvh5oLZA3dAa8xNNUZmVSPYSycu06pdnfCZQjc4XQcSdvDIC0YSyLIsG7CAzkj6aIqmr83xiHx36G4CnKhqgrkuQ84gVPFc0BN49nDZ8WvAUurhUNV0HyasHT296QaEM0I2rvxW6OCPRu+Xr1LkLHK4aQ9pd2sBXLKhjnIb4NQwyBvPFHHt7exiPxxgMh9g72Mfu3h5OT05RewdPAGUWLgQUxQBW1H8fAlztUBQFBoNC8qK4s9bVDqvVClXFK5yL02NsTjJc3R5ia2Iwzj0mmcPmyODapRm2NsYInpfm02qTjryBhWdmDDKZcmYyKrJxnXcOQ7Qy5xyqskJZltjb28XpyREbwKsSdbVEcDUOD56iXC1gRyPUgyHqyRYuvfwO/tZ/+r/BT/7wj/HSm99DMdmAtRmKzKLILDJDsAS51YCdDw7B1YCrQcluaEr4W+tCbKdI+Es79Dl74ExjSE5tgMob3G/aGhGHq1+b/zRcGbfLj2v5R55hbahPCUjL02Bug1EzQQ9Pq59O11rbfZK8tByksxb5rdpaH5wnDyBhhs+TNIzjz4nchZQ4IYRor+mv/m8GDZu0id2FpjzKGP0ET0EJdB6Rng8uzuM8oPgfT3GKosBwNMJkOoXNMhAIWZ7BORcv6YppRQDr6eyLIISA1WoFEFBVJawNuLI1wdWdKW7f2MHtq5uYDQ1GRcDWtMD2xhjTyQTj8Viu8BADptIpoVXKB5wXj7IheWCTQMiMgSWD4BxsMLCeYANgXIBbrLA6PYPzAZPNy3jx7e/jj//L/wP+q//6v8GP//Dv4PKNF2FNju3Nbdy4dgWXtjcxGuYwJiCEWg7SdkBNB3GgbJcTCQ3TOhA1g9o3BU2fmipiR26T7Vx4Xj68aNBD1I54Ct0eqPm35tOlybOA+1USv9N3vim+FGRiKh+JAeubgJEl/F+7FQVS7ULLkroWw/waQAmuLjwPXqLO6HiOJpSWM3X99ZFyGYPpdIrLly+hqliDcM5hOBzynqFO2UgYKgQvT/ycx8Qsyn3NWwgsAdubU1zemWFzkuPq9hRvv/ESvv+dN/HS7avYng0xHg4wHA6Q50XcjgDw1Jy1rX7hR3KKKQDwKb/KJVyZtQguwHgDEyzIZ3AlYKnA1UvXcf3KTbz+9vfwB3/nH+CtH/4Ug40dzJc1gg8woYafnyAszzAbZbiys4HRIEduDQw8TJD9YXFfUWo/ZM5M6Q7hN9USnrV40QVuu/7274f1DstpNd91fkndhcDJe2cYap85Dy7C3e0rZJp+SaKRxwFnjT/7yy1FbftJXDFgB/zWi1fXpGX3ew2EAAHNngFlflVjW9EjE1z8F1ro9LvFRG3/tHYcRrHxY1wxLrTLRDIN0b9daPtzXu3066TtRAGSsnQYl7xgIMB7LOfHePDgKxyf7AEIODg4Ql05ZFmGIP8MsUDMsgzeB9lbBCmrjsqSj6thfIUcDkMbYHyJoQ24uTPDtY0RZkODazubuLw1w2hgMRjkyIsMeZEjzwqAAFfLqgrY5sD420yu9gvejevhXYDzAbVsdvWy+5yZ2AAhyGqQxXA4wGw2w+VLV/DSS6/g9TfeRjEY4vjwCPtPHuPxg3u4+8Un+OLTD3Dn84/x4P4dnJwcoMgIk8kI5bKGD4RADoECyPBOcCJeCYRo7WR0stbwVmQN4aEAaaq19lsHIkpOgZ4zEIh22K/sPCOTzglT3aTY8C8PDoSO4TjBS2B+9b5Ry1r9pbdc65BG0zLoE0VBDNtEKX2TMgQ232jaeM91Alone/N7f0P2GV1pEkjlVBh1vzUee/IfQ20y6F6j6NMj5bvz1u7vRnuQSiZ/idROxMIvCsGk4q28Ek2GR0RmWHZKIO4s6/5Grm1t529kX4qRRYPGyb4VaQdDBiZtBgIAB1AtcSwsEbwv8ejRHTx9eh95nuH4+ASn81OQAWon2g/xbZvWZAiel2Ahe6SasgEZeaBeYiPzuLkzxstXN3Fre4xrW2NsF4SpAYYUMBsOkVsCWQNPgM0zXi6WmyCrquIOHZrrgLv7qLLM8h4dubr4bDFHfFI9ACA+E0cmIMsIxSBHUVjkA4OisJjNJrh18zauXbkKciWWR0/x9MFX+OSXP8MHf/5n+OyTX+Dzj3+Jjz76BR7ev4Ojw10cHDyCIcJouIOqDgjGA0afx+Y2A6SjcMuCwMaupuzaFqplCg9Fx63WnLridmRf4c/AHS62dYzLNikAsjeCMabaUKNZqb8WSCWjJO/YaogkXLTq1iCX2KX0LysL8q1TNK1+0sci7iQtkjohAJaYukHrLPXW+iq9YxqRfdof0jwNEYIROyQB9sZ3f/89BOC3XrwaMyeS6YjcKZQWLI3DP1ioBB39ZIdrF9KKRr+WStkO78bvEomEsF3QhlnLqy99D/T5s1+TX8TRCm/gWd+cUDbEgWAClznPCN4v8eTJfezt7mF//xB17TAYDECym1rBkLz+qX7JQUhLHgOqcWVa4MfffRNv3L6Kl29cwaWtKTamY0yHBYYhoDAEBAdjgCznF2uLgs8nkeyy5wuwPLh9hL4dLVPPx5Uln5XzgYWbNcTHaMACzFpCZjJkWYHCGgwLi2HBZ+JMCFicneLhva/w1Wcf4svPP8be4/s43N/FydE+zk6PcXp6gqf7T3F4sI+9pw/x9OkBrt98FYPxDLCsnSMYEUTcabjMseGiEFK/EHRhvA+6vND9VnTrGDjvjibd1YwvhDSd/JE+oVOjuMu+5wqQFM4L4/J1fS+GlG7Kcz6sG8RivIQ2FGdbshWADL9co/W58d3/6D2AhZFWNsjOXZIRtyuZ07+Ija2N3wiRoPsPLnCMiwVeqgmlv5t4Imk7Brk+p9C1BbRwJdBOR7FM7NfUVeNKrDU8rfCechExg6p2YYKOtLzpclBYPiR7eMjPColjlCTLxw5EcuVHCFH4a6PmwWFmK/z0+29iagOWJ4eAq7BclliVNTJDuLKzgRBqOFfyxf8WsPAYFDkyUcO9581xipdId5JLPaWOrvbxpsng+ZCuIUImAskagiEgNxaFHWBoRhjYHOMiR2ENfFWiWi5wenyAp08f4eBoD/PFKXwIWC5LVHWACwQfDCpPgM3gyOHobIEXX3oL21eu8fm4ILoMGdaSqM2TTMK0zdY7UKudOlOllCeatgSQaKZpXLa1Cc922r8dt59fWumE+ULQ2xXVh+UAo23ahgManuiKI6LGeB+/e8qVhkdQvI2CtZY+/pYV9tSfFQbeCuFZXwSBGs3oBy9eiVpQkM2LvEuY5/itTKgpULoaYWWJL0g8H/gend4KSYNxx18P760csQBgirProOyk6ctzPS/+5rIId62Fs18MTX6vQzetTmH1f01IRKzMBgIhwAeHLLdstM4yvhjN1Tg5PQUCC2G+Xc+DjxXyapExli1K+lyNd7h9aYprWyN89cmH2JxNkFuLs8USu/uHqKoS167sIMstlqsF8iJDltkoSBo2h5ydU2EkO5p1sBAmJ5KDjtRML1gIGVjePAIDgiWCpQy5GcjyPPHVtPUK1WqJ1XKBs8UxnF/Fjlw5j0AGNhvAZDmC4WdTBpMJYHK8+sZ3sHP5OjyxfaZL47VumDSNFrdp9S50fbvfAjGLJrzLe7JlkMM0Qg8obfuEB5IBXn8H2bjY5C1/14RjE875J4FJ1L7+0a4Hg09voJADyJQKUgURRkEWW7SN4tSSGlz2xnd5B/YPX2IDdqys4EvLzP7MkEgJk2gymoYLxRmq7ahVyGjHafy6FWpVThu3698B9evTiPrSNX7nEDONFycAaR2f7RotT+pLiMKPR3KKZ4MMWQyKAfIih7GE5WqJo+Nj1L7muiudwNMoffYlXfonX+O1F67DlQucnZxge2sLm9vbcD7g4OgEtbzpNV+sQPKcUZbx6yFVWaGqagCEPMtYZ3O8G9yIPVHtYnFEk/JEE56RDXEioIjYbkaACF6LIs9AqOFDJe/BcV0gO+Jh+LhM5fism7EWtsgQMoPhdArYIbZ2ruOHP/59BFPAEQst7mypOD1fGEWv89pc2qYJb/NN/CvtyRp7agmXPhLjC65EawsSR8ViqhBwmqb8JLjTMmk5mliMK6UAAKZhwuMtqnSEUYjTqDZdSKaIvB2IyWEM218BWlNaFJdqRiw8m6frQ5DrbOSucLnPiK1QShJO2T6Zr4VSxtLzN0HURlKbhkhLnxwNURyMIHGpVw8zrIOWMHXr8FyoLgAtT1Pn3xBhhG6ZG5qylDMgZCjyCSaTTSwWfPQjy/k8WQhsw0kFP5JG9sHDBw8H4HjlEAYzHJcB+6dzVC5gMBpj5xJfnn/vyQH+4pMv8WD/BAdnFe493MeyMoAZYrGscHR0jLrm831dSG2EcZObMKbN+DqWPLPxb55lyAuDwTBDMbDIc8CYGgEVG7aJ+AyXzZJNoTzlyAuDYmAxGBKKITAYGwzHBa7deAF/84/+PqbTbQRDcHAAeDc6kPBXym8pz61XC92BTqrVTZpET+ImtwJ0B9kYX1b1eNDp5iVpoiG9HzT+2u9zyojOxsWmfIipKKko92dRSgwPAmldVF7E+saFnguAwHwv2SjvaJCWT4crOOdhLRufo4DqguQZhBB5niPLMlBLkicaU1dSdjaYtcLi10XQFURsd0lx9uJ+FrF0xEpcyiwxVievbw5dYZT6g4URWYByjMYbKIYjLJYrzOcLVFXNelS3faRMeZajyAsUeYGsGOLh/inMZAfTKzewdzzHg8e7MNbg6pXLMFmGg7Ml9k9WeHxwiqcnCxycLLF/tEBZGXhvcbB/hIP9I3gnq0/koXcyWcvGc+dkWmdk1DW8A5fPTRHvkLYEm5EIJoO8ALJBgB0EmAKgjKddweYA5eAj+pZ3petIbjxgHMh6mBwYTEb4/vd/Gy+++AZMNpDlfPCKmtw5FIi1LOVvXfZp2k5dAyokorDo4Yu+tu+GNef3Un/E+5BiWUQwUZJnkM75vJD2U5Iyx14vwHVhaHgnqYvWVfyiMA3tXdcsQHTbTiOI1inZQFMmCH4TB03OvxFmshmD553eNZcuaYQIxMgAitcdQCz61rLNQtMFWQZWQq3hEjxpJdbjJPwSadtTLqiQaNzzQFNHZpTon8bpuHWfftf16Xq0Pkkuj5d/noBgDIrBGDdvvIzZbAeuDnB1QPC8XMr3IHnBxcyT53m8PiTPcxyenODp4SFeePFlzGZbOD05xdH+U1g4XNrcxCQvMMosbHDYGA9x4+plDKzF6myJ+ckKxwdz7D55itPTMzlUGRBQwfkVnKu4vU3zkJ8yME+Pm05nCImmxBecZTlgc8O7zA2/4eaI4EzbZsx7lQJWtUPlAkpnYbNLeOOdn+KFV96Gg0Ugtm1asjDx/usGB0O3RZpOoNPlfvcsLOuxla9Ijdfq1gSgDEyyHYSD+warNA2D9qs+hSHmT7winmprOOeUhfbZEFjQ6JabIBqMhnldkNKFrWRQJGoLwBRUVqT9sxlMGzskG7AB/Ojl673CQzPhv1pRnqq1ICFC27vxa/4K43bS6G/Ng5IT9Yp/Pd6v65qRCzpKSLNzdvKdpmnH6Bn92DFzJX6yt2U9vmzSEIwg8NtgBLCJOsNiMceTJ4+wWpaixjoEXwl1xSYnzOODXLzmHUajAqv5CVBXuHZpB8PM8tWtvsaoGGFzvIFxYXHj8gZuX72EjeEAoargK4ez4zMcH5/AO4cs56kXkUOgCgC/u2aIrz7xziPLMgB89IBrkuxjMQRLli8h8OArSsG2Me+BygEuEFxg+4IPTqYqQOUClpXDfOUAO8Rodh2vvv27ePt7v4+smAJgcwDzp2F6hHPatuMaqqd+Hdfp6+vt13brooEh4k7ybgSJmkia1HzLQxOX/ybhnTp1IYAnJZT0MQWtXYOt6fOkQqlzcSKkvFIaEVKysJGWo42Y08lbakEEmShlEVdMD8Be/87vRQN2t3Lxtwqj2GnXiUBJ/Iv/dom8/pd/s2s8pAJS8Ogdy6bfnXKtfYuRs5NGv6gnzXmg6dacbj0Qp/WWGnSxaCQQ9GkwQvD8LHWeAbu7D3A2P0GeWchrWqLQNvXQ3bjWWuRZDiJgJcbvVV2jGI2wub0Da3OQybC1sYlRYbA9HWJaWIRqCbdcINQ16tqhdh6DQY7hsEBRGBAFeMgyfzDxGR5KpujR1tDpmMF7VJVcReycbIjkq0Vq53kHdeA0jJ/ggkdZ15iXNapgkA838fZ3f4p3fvC7MPkUNsv5xgIriyPyL6Uxl6HTOyR8vY1bLSgYpY0pMl8nTRu6OUGxCC/rs299WLQ8ys/9zyhRDFeXKgUtAdJNrnlrPlFocRpd9e47dd+ilfzmQ9RJPxIFJQpV8Q4hIEAHKQC6EbXb/wy1bmRowXpjfTvwG+GlwHaLOO9uNIsutAiVfPf5d8P70nfjXOzOi8tt2bh2WMp/xlgUxQjjyQwbmzNMpgNkfM014G3UihT0gi0SQeAcwYUCKzPAvYNTfHDvMX7x5SM8OFhhXhvUCLykbwLgSqBeAPUCoZ4jzwJmG2NMZxMUeQ4EwLsAX3mUK357ra4rvsCtrlGWZXMcxHvUlUNdO1RljaqsUZZy/Ynj/UgqtPR0PzMsRLPJELyFcwF18AhEMPkIN2+/gdff/AFGk82WiUDZAMru4qG3NbKmqS4hWALr7STOyFELEqHSwyfnQQsHqUBq24zSePr7PEjjMe2aqZP+1jhqWI5xkWwIEiM2RTtVe0qWGuC7ZWvSSB6ypA80bWp0OiPAbaV41sW1lh1QYZRUJC0AtBCqEfXQqpuGpKCQjFJc2gIX5hX92nGaMpCoy+I68RRPCt1v9fum/kj4qL0b59uAdj24sS0GwyEm0xmyjPfsAPJscuBNhummRO89yrLCYrmCDwRvMlTI4LIRTirCx3cf4Wcffo5ffnoH93b3UBPJM9TAILMYj3IMhhaDkcV0OsBwwGG+doAPMJSDr9o3qJ1DVVViyPZx46P3AWVZRYGkmza951cosjwXzU1tisqgLJx4jmpQ10BVBQRTYOfKTbzzvd/BePMKXDCwWS4WNmmXTtvHNuwK/J72bYWvuXS6hzX+T+O2vtvR1uKBW7snv3ZebT+llex21tVuXZXq4FeeYGHDAjWVBRpfBZfu4labURRKso0nBU7Hr/7wNJCFToBO25q82nXTAbRbVtmzJGHnA7eg/uiGtqBNzG6GjWB6NiZt+CTfmLbzr8Mhz/q+CJ4VU0vz7Qsihaa+PNd2GA7GuH7jNibTDQQT+JiFaEF5nmMg9xo573gzJMlzQUEUYrKoPFAGAzuaYYkc9w+O8cFX9/Dg6QHOVhW/DGIthuMRxhtjDEY58pyFn95lzcyXsbCQu63rmh+IrKr6QqdTSmszvtRLbEzaYVgQBb7IzfGtkd4bOG/hMcCN269j5/qLqALXi6fBaiRu2o1IBI54MockVP0GvIAkPlFzadx50M5b0zX5peVoIAnv8u0ajzWCW23u3T6GBA9rN3J3otSBNzGv5xlEaDVKRFNYSumc5KW2KNVqOKxZtEoLr+XUOM3f5vaL4L3eLZWIzA4ChoYQzwJVu9JKpPi7xFO/Pv9vCoqjr/Jdl6a5KO9uulbac8PX/Z7l2hBkGd0hLwq8cPtVXL12CwAzlO6YHg6HGI1GyPIs3kWu2zPYaM6Xh1kPUB1gTA47nqLKC+yXNe7tH+Pp6QKlJzgycNaCBgWyQQErzzflmRzxlTNfIRjUcpthVbFzji9tW3NV85qttbZR64k1KC9TiOD5ArjaVajrEnVdwQfe8zQc7eDy1Rdh8jGC5aeVzqfb80OX/n24lG85XLXx8+MrMAfIb40rHt08u64L3fCuU4HRl6ZrvI57gsQrnHsFSLuv67aNbhmj7JDpGaHRctbKFusfk3P+8aUbapb2NbAl2TShyCIiltY6ZyexT/QKs3jZ2rpW9FcBEX9PwzSVWc+937cNF6deh2fl2Qfr5WZhQmSws30FL734GvJihMrVKAY5soINuGVVNQ/wZRYmIxhL8r5YgA0emYw6dVVhWZZYesLCZdg9XuHBwRyHS4e5MyiDQU0GsMRX1ModRIb0dDobtrxMy1zN00QddXWbh7peP2Nkt7UsGcsO8trVcHWNxWqBs+UCq7JCVQGT6Q52Lt2AyQdwAMKvQdtvAtoH2DUHUJtO/Jx5d9oTfGcAwlrKi/H1h4hP0tm7/KN+cc+UajFyjEvrpeFYE0EMXO9G8J0HKqh7QbRULq9hCRLpChEu0DuwGVrCKAGeC6aqGfuTCKfzQSS0LD03cblZQmgbo5sO2Bj4EPNJliMS//RvCtSR4vqdunRrwbMcIDMULQJRPLrQdd08laWa0XXdQQ54qgtgB/C067VX38DLr7yOQAbeEkzOG/1qV+JscYbKVyBLyIoMxZDvIgqi0ARLKEYFAjy/kVV5BG8xXxnc31/iy70Fnq4Iy5AD4E2s3A7NhjlX1/woQPCoaz5EGwJQVbyDWgVKCIEv/ZeXSKJQEu2I9MKzwHavIDvHnQjW5WqJVVliVZU4nZ/BZgWGowlAfOBW2yEhMrSzpM6gZ4tFygcJilQAaZfs6wc4h49I2ngtrzShCHMV6OkajFGhkFxZEvuCXGeS5s9/BSkjbvWfbqekVEuSMBJ7UbrwoUKpXTe15PRsdWjxeNc+rGUlMU3rX+V13l9kSDRv75slGdI9Buc0AhS5ZO4D38GLOD9NKhLnpWIQ0xWJWFht9I7TFuwQs4EmIM2vH/oRdbNIv89zayCNSuiJ3J/gmU4bjp1MiSAvp5LB5vYl/MEf/BF+8KPfAazhjs9cjCzP5AqPkqdMTvYhsS0YzgB18MgHBQZFDhMAcoSyIjw9rXF39wT3989wPK/ZaOy5HAayUhWAIA8wIIDv55EMVMvh1bLmTuZUG1KeIGpWb9g17RdkyqCXstWBXyMGEQxloMAbc8Vk1YDwZJf4QtU2lXuExDq/c2hTxk6/aGXVfHT5MKZPvnkqk/wTHmqXU/KPJdH+0Qccxlk3/ef8HU+Mn4/e8MAQ/ZPyh4BmkGw0jxjeBU3Lu6r7NKSmdgDbH6285ReCXDBIgAmiMkXp2HO2JmUYLpyosD453a/xoyqWQiNhW74tCdytQBuUcfvK1f5ej9ON9zzQlCvtPL8erm8GTaOFZE+GsRluv/AS/sYf/hHefPNdzDa2WsdxrLVwrsZqtUJZ6qZIYdcQUFYlyPARntyyIdo5j1VZ4/Bkjge7+3i4d4Cj0wWqmi9KUxUkvTRLV3JS4Nsd2Tl5GYNA/J6eHpKWduG6NFM4Y9jWoBBAqJ1D7RxsbkGWL7UjkgHgW2oLSrWFxK+N+9fHr9DFaYzcbqCoe7JRDSWFtL7p367fsyDI9UDeexg5Y8qvewgumZ7q9K1vt3aabwphbfW8DVr/kLxyrFsQSIZgIJ6+lY7XupIAIkiaEUIzZenWjC5EicRXk/9F8IzgLlxQz6RR8M0Rnwtcl78ekBFR7EbBGzhvcPXqTfze7/0BXnrxZQyHI4xGIwwGA0ynUwyHI47bHe2lY61WJUIIGI6GyPR9dO+xLCscHp+xQHp6gPmqFNuMaEYd4AGsObPkEs3IeV4Rc45FqTEZDMmpbhmU+OyaaE3gaX8Q+1EQjTsEjyyXi94u6ADfBqT4tR90B+TfBLRjq9Mrmb9JnbhPrfm2eP25cMV8VclVuxg3dJBT9Y2S0ac9Mmj5VSbwuVbZOyauC0G2D3TLSnTOYZ408zhnVAOYCBptMBDXI6YRdTQaxVJBpU5OL7f8iBm1cSmDpI1GzdwzsMDjME3fxdlmhIsc4lKl5NPCu+6ahv3NXUMjyNyfWLCAp2lkMhgUyMwIL9x6FTdu3IIhg7Is4T3bbVhTkgEiYYjgGZ92eEOE8XCE0XCMLBvAk8XSAfPKY156lK65msTJWcU2MJ5abnhcLlZYrkrUtePNirXsuK7YtgRYhGBk+ien+w0bxhUIwjuGX0rNsgzOeQwHA77ru6rhXTNid+nXuKSNxP4S7TBoeI/5OGn/Z9xQ2uuUjyMvJ7yRaIIK2mlTvN0w9VqvJ9uDjKySdtNDziiqJopzym5IrmMxFtCjGslhWCtTOEDGwmhw7uMDzkOiNmth1NxQkOadpml/c5ljyZUYXSnIKwo+viwq8igKoF7pJ38pJUgnzvNCT/25oQWjBjfx2gl6k39L8G3i7mtooaAIXguiDNYMUOQTvPDCK9jc2oKrHay1rFob3stj9IiEdjwBYwzIAM7XIOJL8W2Rw2QFPGVwJkNtMqwqh+VqJZ2jj5l0GVc0Gefgat5hrVqRbsisKzZqh8ACjg3fykTSQayRZ74NikEBawycnHkbyEVzVg7a/ibQS2HSTiPf3QjPC52Evc2pcI6msTb/lQPsNtHWTO9lZqppiFsTVG1g0ifx0zDpq8YYVHUVBXWTcB3S/m2IH/bkKbg4EYJWpqjOMc92y2ggAgeKtBOBiEexzMpeFl0h6RlFACZ00BvdpACKsZH+/bapZwGXD3ydBXmQWV85+E2AEhqkIygPEZxn23UxfJsQAHi+JTGAhW+woJCDKMOLL76I73znO5jMprB5DhcCgrz5buSvMrK1Bt47CTOo6xqrqoSrKyAALgSUlcOqClhVHqfzJRaLJUgZi/ixRC6W2AmlXUmYy3mP2vNfdbV3bIz2jndNBVk583wYlunaGDSt5buP9G36QV5Eu5PVRxS+CdF1RTFxMShp48j3HW0p8kJPv/i2IMWrWpXWvxVmmocjOW4j8NRPFQbW2mPSc6EbJc1zsVggsxmcvPgS48iWnbXydeWGthQzCZDcGJDnOWp5XiuVI+dIlAZYK2oYzMtBuq4GpdBoS+3pTkivIPgrathvDxIirzXZv2WIZCZ2AQAMsmyIn/70D/DO29/DeDyFtbmsZgQ5Zd/uRDwasdZUViXmizkWyyXKskS5qjBflDhdVDhdOMyXNZZl3XqRhGSZH1CDtkxt5XiKdwHOAbVnm4/zvpnqKc+AD8byGbWUP3T1jR+uLDKL8XCAIreAnJly3sA7xD1u//8CUat0Lhqez+t/7Md3qevU5zzQ/tjV0kIIcN7DWCsvz/RJLXa6cqo8FqLA4QGHb5GQM4vJ9FTPwAHtRybstXd+7z0E4LdfuxlHhkb6MqMwAyRTtBjWjhv9jZRW0qdhPKJyQXS4aubY4i+O06bptUKp7UbLwb+jDeCcEa773ee46JoXz+O7cX4dx/N9rVPbcZX7wsXWkfgZYi1pa/MSbFbAyHTm9OQIxycH8u5ZhtWqQpbnLAycj+fqMjlgmuc5N0Pg54ayrODp1XKBzckAlzZnyDNefg2Bz14HQN535xGzrB3qKqD2hLrmb5BMF4nTxrZUW4jlqz+cDyirGrULfM+1zTCwOTIyMLlFMZrixu03cfPFtwA7RO0Nv6stq4wAP51jhDBEDZ8F4UGmnbouzzSO0wlSAe2mTcfnCH2CAJJvdJGH2/j1N9LhWv1aaJvOS3I9TAoqbNaL0uAnJXoSp5u/limtE8k0Lci9ZLzipfXQO6x51VMHpJhWvvk4kxfJ0YAK0lhlVVDMc2hGXAjZtJauuHVbrgdUynrvec6fZ+dK9X834d/NchIRimKEsiK89c738J/943+CP/zDv4Vbt1/E1atXeSQiYLYxw3KxhHceRVHEYyPFYIDReIRMpkY8FbIIsKi9Qe0JHgaeDE8UiaepJI9O6tJs7QJ8HUTB5vhBnwoyBiSCjuMmj0ESyTgkfBSnbAGuLuGqCtYQBoMCWW6QG34nzpgMFH4zu9FfFzxHd7kQtM+lriscVdA+D3RXRBXSvp0KmqgVyzUhKqj6oF3GdaBE+GkcIpJ9RlEK88iRQp92cV5mRIlWlGT0LOgbsYxpVtHYaewQz20Bbm20+c2AuBzJ6MKgeXbdX72wChTgjWeBIDm6EABDmC8XmC9LBLL43nd/gN///f8Ik9llbG5fQVl7kDUohgOQNXwIdjTGeDzGeDRGnudw8PC+hrGssXrPjzbqHhBIJ1Jq6IjoozG6iaeQ2mY8sauD2o48hxHbQHQDZErFLmVJH7tEDRMc29Gel+ySv7rOonELmIeE18SW1OX9bxOop18ZKyfmLd/YwPdPr/eNBgc6fUTDv/3yKrAASqda/cC88s0UF8b27Lhr2kz3uw9IVgOMXGnranlTS04PK8H/A3xzWCz4iSGbGdQeOFuW+MFv/QR//4//IQajGYIHlqsSs61NZHmO4+Pj6M5OT1E7BycHWtmm4+FcczcRwBKhr5VZu63hfA0rK3fdUTYAchaFHds69BiJTMeJmRZQWxh4b1GRwwfCqixR1yt4vwDcCsGXMM/Bd/8BGmhPU9vTsRY8hwxQiBqRaL4Q4fosoaOzopimtWVHZuDQZ2h6XApdZFCErZWnRup3QTNWaa+rPc+qBENT8BBY1efNmf3QJU6sU3fvSWp/SuqSNuCv67q07IZfFLfriPiy5CCjvC1ywGQgU/A90PkI+WgDb3/nh/h7/8k/xO3btwHvMT85xWQywXA4BMlbZmQIq+USToyhAK/AhMCPNpIYlJflCsvlMh77UbqOh3zPNoFQVSy8QnBRU+KXTAir2qGs+QkhHwi153utOU9VVXiUXS5XWK1KlHWN2vPVtNZmWCxPUVZnIKpgIFsSqKedOt/a1nK1P2xs72e59uyguwMZCW9d6FJeMg3eLv5nQYODV9OQ9KMYZ+0b0l/08GQaJuXr8v5z0MbEp4rYzqP4IDambjkUNG1XdvDKe/Od7EJ5NnQL8E1AKwTwPchJQPP7Akij/Tr5/3sDUvXWkjUM8sEIx6cLLGvgez/4Ef7zf/Jf4fU33kAxKLBYLOK+jsVyifl8DojWmuU5jLGoqgpVxcdIxuMJRqMRSAV/uqlVBJclgyITm1PGhdKNkKtVKUu3zKSSSjbYtTu3sRZ5zg8J2Cznd9wyC8oyUEYw5GCpQpEFFIXFv209+q+K04hkNUK/W6HfDJ7VHXRnO8mpCWPatzECz4EkgdiCoemLUdtRPESMMq0jNVt6dOCrHTvvHOzVd376HkLAT16/HROloEJEJV/LgN2x17B/s69Iw7p/mcFZu0nTrmsPTf4s6WP0RltQNT/BwzRIIqdl6DZ7Gq/H/tT9TqHJvx+6aS9A9UwIRHxEQx1Uo+Hwsq5hbAZjCgTvcHl7hjfefA3OOSzmCwTnYOONfsBwNEYIsjwr6nYIHqNBgReubuHmzgy58TDBsV0CUgHDeXsf4EGAvJfuA8XtH0oWQ4ZfqtV2kWNH6sdL/57vR3Kez6R5h8o51IFANsdoMsL1GzeRFWOEkLE9SQzgSKhPRmxP2lN6aX1xe7WBhXDKj8yD6fevB5EXk1sRGr8GdysP5U1Sg387PtuOJGJSzlT74PSAnnlsQ7PtpqW9dIBDmvm7xl8TRgpS7rAmsJh/TfIS9fPriwJrmf06IATRJeOLoGmY6CN+jZ1Bvr4RqwEtpP8/Aa3SrhVdz3h5eE8gFNiYXcI/+Af/Gf4v/+f/Gj/4rd/B5s4VjKdbGI4nGI7GsFmGqnZwHrA5bxEYjUeYjEd8N3bwqD14egUw8wQ2IBsy/Dij3NoIAF5up6zrmu/M1lchOCnzsA8IntMHIF5fW5YVyrpC5WqUMlrCe1TlEsvFMXy5AHwZeUY1rNjpvnVoT2++begrco/XOfD8MUH8eozuyo9HhJ7R7/ogpmhpyuIl381iWEI/qawKrRD4mSubZcjyHFY2Utsr7/zuewTgd167pfyCoMgiLvmdzP3UP42nqyMKGh6dYQHSaFc6B+ZceTsD/6VES4nCJxFEOtfVc3DdvJoydfwFFV+0vm4f6kLqp3WI8Q3FN6/6XOvSGjlPdBF069B2ghdyxw1xe0BG78wYuR+GkBFAnuCDgUGO8WSGV197C4PRGKencyyXpdwCYrBclnxtR83Xx84mQ7xx6zKuTPhpIxf4xhBLBhkCMuLVVw+KrqprsPlaWNFYwJCUlcTIHWCg9xrxapFzfIYtgOI1uYEIzgWQzbCxtQmbESaTMWbjTRAK1DCo5T6c2GaRPeW37KdiEnXp2G7nbqdSiHGS4K4+cR7Oc8MTnk4FivppvLT/xfSB7TwGRn4Lhk7ePlaeeY61IFqzU4XOUZ8WHYg1qlbZE/tZ4FGvIbIIJ65jwvOyBcAHJxzDV+aSpuH/hMYEe+2d330PAH7cmaalFUx/t/xaxG0Ip6D2AvUjEsNZx9ilP9N4fX8TFot5Mc4GumVdx3GxPwMx6/WlSby6eT8Luvh+I0iKQoYNtEwZEQuBQHqQGAZZUeDmzVu4cf0mYAzKukaeD1DXHsvFioUBEXJL2J4NMCoCvOOzSTmAAh45AjJiwVGD+dEF1m4CM4PwlghJYV5j+V4cQyyY9IwZ79IN8CLwPMUDMHxfdp6hritc2tnB1uZVgApgMEHI8niotUvTEP/rA+Wf5wVBpMlSIfAbgHINF30d27nFV0gq2d2u0Je24VKKfa0fuHZGjvp0BXXUfuRkvvTmVhwi3uiqj0Z4OcFBaC5ZDLKrXrVb1Zbslbd/+h4QLhRGSKzlrf0FFwij7m/GsX44jsP1bzt++29HAKX5KKKecndxneffxt2UKQWiv35hFOseBybpIBG3MFAQJuQ5lZTdYra5iRdefBFXr1xDlhdYrkpkWYHpbBPD0QhbWzu4cfMaqmqJ5fwUAwsM4TGARy584IgfXfRgIVI7EdyGHxIIYPsRyehp9FqTANjMosj5ylwPwLmAVVnzTmxZRTM2A1nLtih4TKYbmE0vYTDaQrGxjWBz2XjJvBhp8lcgjFK+6PLgudk8C2IRUj5ugp+JVyrJbdrwr6Zrl1k1mSY5Uk2m8Wql0SASXkMURu3D8SkO/m6y4r2CvAoY5YcIp9REozjYgA3gJ6/fjk1FnUwi8WUHbWQAJNpRYuxL06SZnbcU36r4uX8bfN2wlBzRv1OPJq3gSq6RaIefD0R//cLoPGhwN8IIBPBslBDIiI5sMCgGuHb9Bq5dv4lr127ipZdfxeuvv4nX33gHP/rtH+Pd730P8+USTx4/BjmHUW5hgmfbtbVwhuBEBXcBqGoX9W9egrYN40rZghy2zLKMN1w6DxAhBDZ+8xTNIAjzku7+ZvGE0XALO1duY3b5OpDlsrPfxTamyJ9tiHzQ+nq+duegBEMXeQvjtwc92bQhiZBqRkzxHuh69th80KpHs/qmHB7bM3B45K+1bQo8mVW68oyuuVrYO72KRC9ua/q1vfL2T98jAn76xguxUbsOgpxtJMkVstJYHKcRUjF+0tDpbZCpP3/r38a/m3da6LV4ffn11IHjiyB9hq2oDyjWufl+vpQMz5vP80Ba9jZeZSIBAxYUYsFhYlv4QBiMJrh58zZeeeV1vPDSq3jhxVdx5ep1zDZ3cOnKdQwGI6wWS7iqAiHAEz+V5A0bn70PcIEPv5JljcZmfDsjX2vKS7j88ocDKPAtACZTlhXNitX61G4UwHxWuQqnp3Pk+QQ3XngN126/AjscscEzs3zmTurv5a4mBc4hFRjNrxS6tExp2v5+Vng/rjSf54F1MdGGBg8/TNnNZw26CBNh1C13UMEjaUKyUhYP1qb4JH+Nl94A0vhxgiAHrOPeKW0VKcNz7TNSZKxyNc8Yp0DJmZXzCaNpWMo2TvrIvzPw71RhnhMaWkYg+S9I55bOGMiAsgIeGU7nJealQzA5TD5CHTKUboDp9kt464d/C9ff/DHcxg0shptYZAVWGcHrYCgLGsNBgcFggKLIeXUk3rvD+5ACEV8vojdBxt3Y/JfLpeVDrEuQc23L5RL7+/uYn53B1VU8U+d9wM7OJUynUz57l7EZIG77+NabcZ1v/1pBBORfBaRCpOWf1Luvn/vgWZsVyaLfSOSHgulcBmdakks8u5nod7p5qqEB+xnq2dOwBiGunHUbtT/+vz3QkYHdc4w2/85Bu4PwniS9KVKEkBiHfSAsViUePXmCjz/7DA8f72JZeVQuICvGgBliVWcww0t46Tu/i7d/+ncxvv0WFoMNnPgMJTJ4kyGQRSCDYjBCXgyYuQBAlvN5pdPwtbNy53bt+Iya7itynqf+uvoi+puwPQsjm2UoqwqLxQLO1bBEAALm8wVO5wsMRlNsbl/CeDrjjZOJQPpWxUZndfSvG6hjukCHj79tiLMNtUGCiRui/arpxz5uveguVskjDq4RUupvr7z70/dAwE9ef4FHqXMqQqJ2pQTgvzJNMgYQu1Ej7SSzBF2jZQmzdGxNCuoX8yBERN3KUccvjfMs/+7fXiCKS/NcGnEXpemA1qPtvgk8L/MH0TKsOOKDEMbAy+bEVVXjy6/u4P0PPsCvPvoIB4fH2NjYxnS6yRsnyaCuK5RVheF4gktXbmC8sY2aBjiaO5zMSzhYmGIEkw3Y1gMWdyYQXO35tCvEJqTC0VgEYxGMAR95lePOojV5z1sW2J7He5bKqkIxnGC6cQU3X3gN127dhslzGJPDI8O9+7tYVgGDySY8CJnlTXR6ba3z8kKNtFVjY9Epa9c10G1f/uzEJSSCqdtG6228xm9xXFce54w4q/X0EUQIxJyjQtEuQ8xHTyhDN032xIk16NajgVbSTvFaRgvZS9SlYZA9Yn0zKFlN46X94AOgtzOuNcS6xOX5nxgctVJpHELsxAxBHC/xkgg4tjW18+i6tOatMvyGwqgftJwp/vXyPQu6caO9Kvqd3+j98Oz4rFkYfv9MTmTxqhTgEDBflfj4k8/wy/c/wL2vv8bnX3yJBw+fICDDxtYWBsMCxgIhsIDIZDpXDLcw2b6FbLSDlSMsSofTpUOwBRMnyIZI8B4nwMCLTPKBAGtZGJHwizFxxayuKrmlkF+sMETwvkbtKzgP5MUEWzu38NKrb+HS1WuoAT6TZwY4W3p8cuc+li5gY2sTwyIDkYEjA8pygAx84GMnxophXchIYO2RG3e9jdHbhu324zTS+WQzr2KPYqbDL11cHFvxNWGhGyfFEzjPQIkgOk/IyB6lNH2fMEDkMAlL0JH0VY2V4kG6YqrhMh0LgY3eUasSodvVmJAKo5++/gLvB+jM4xRSgqR+0el3Gkf/tNJoRWR6l1xj2cRJCbdOsLW4Hb80zjf170JaF83reaGLs/v9PMLl+SHZhBZ7Fg+IHkDpAmoPfPzJF/hf/+xf4cmTXTx6/BhHJycwpsBiXuLw8ADDYY7NzRlf2m7Z0Ow84DyBsiE2dq5i69INDKbbqEKG4/kKq9UKXu7V5h5pQcbypsgQ4IJcHYJGieDlYZ6WBbk1AD4gBNam6lBh5VaAzTGe7mDnyot49c3vYjDehAssaGoAthhgvlrh6/uPAVgMx2OYwRAn8xKlNzDFCMEWcIG1cEuGaaUaupSJ4oOJQr9euKC9tF7RIzbGN4A2/gty40BiCka2ouaYTAu6iM6xByFGXasMf2oa6QvRj/Q4jtBV+niQ40ZsZG+ujCG5+oTjN/jtlbd+8l4A8LtvvhiFke251iPtxCpVqXOerBu3K4ziqwaG72QOIYiG1BZ+jXDqo2y7U9N/EEYMqQ1DsgkU+B4fYwBT4Ms79/Ev/uRP8eTJHk5OT7C3twdjLEbDKYInPNl9hIOjPQyGQ2zMNpBnBWsVxsbNiTYfYDTewnTzKnauXMNovIHDkxOsqhWO5mdYOQ8yAxibIxgLB6DydWMJiisuwsQkgimw0KwDX4my8hVWvoYtRphsXsHlay/h1Td/AE9DOBBMkSOQRx08Nje3cHq6xJd3vsZZ5TDZ3IEdjLB/dIr941PYYoR8NEWW8bk94QChf4BJBFHTQt22gkwsz4G1/tvG9nzwzYQRa3ZcDxJNqjfPLiIRRtTSdiQo+V//dPm2yUu+ReuCtG8aPbTSN9j7jqVEzeh333wxIuoe64AgTP1IhAp1Ds+20iUSNKaRZWZWa9tamMZt8KwTliTcaDz1T/JX//W8G5zdMrcdt3Gavqco7fAe6IZ3v9e55DeARBgR8e2MjtkUHga7T4/xz//5n+DBgycAEQ4Od7FcLFAUQ4xHM4RgsFyd4OBwF/tPnyKzA1y6dAV5ztMwnvwZERysbueDASbTDYw2NnHl5kuosgEePz3F4fECR6dLLD1giyGCyQCyqFmyAdbC5DlsXgAwKJ1HHQAXDGAGqMliXlVYuoCls/BmjLfe/TGu3HgFy4qwqGrY3CIrclR1jcFghPFogv2TOb54uIvSA9ubGxgOBzg+PsHDp4c4XDgUwwnGwxHvg5KRWzuykUYPQjOlY+q6fvotYkF4JOWh5tB4E/ci6BMM/aCcz5pQOyYJ/yNl267QuWCaFnk/6UsqNNI0TD7Whk1rXV40HrEHq8CUqADAL8nIlTOK015++yfvIQTWjGSPgM7/iGRvUWcaZeTt9JTSqXSMfpRSQxuShQ//Zg2s3bAx9ho+9k3nnw2kfrSGC40Q1O/OpoZu/DXoC+6UoQtdnN3vLhP9RpAIo0AAZTnIZKiDwem8wv/nT/8N3v/gI5DJUVVLHB49gXcOg+EYRTGFc8BydYzV6hinZ2c4OjxDVTlsbGzydSJyR7WR0TTIypgDYTzbxmT7MmZXbmK6eQ0wA1TeYnf/GLuHx/zaSFXBESGQxbJyWNUey9JhUVZYVQEOBt5kKIPF6aLCwckCZyWhxhivvvFbeOGVd7GoDFYuYFHVmE6nyLMClfPIbY5hMUAxnmJ/UWL/+BSuXmFjOsVktoHjsxJffv0Yjx7vIssyTDc2MRiNZZIm91gR2y2f3SKRw+I3t2tjZ+FQ/tdSE54JzyeMIh/xuNCKGUvXynd9WhbEwCzBjT8QsXAf5bppGiS4Q+BpGcfjfh349jxAbmhAi6YskPS4SIoLAOzVt3/yHkg0IyFo2sUMSWOJn1rIdedlSFbYup2NlDLxOxVqTXz9mwq9fnyJwDknLP3uhre+vwVhpGU5D7o4u9/nsxskw9RpXOH2bs6pMALBkwVlQyxXNT759Av8yZ/+K5wtVrBZhpOTfZycPIU1BkU+hjUFvA+oqjN4v4L3wGrl8OTJHp7s7qIYDDHb2IQLDrzGoVfP8qX8tfMwNsdwPMNs6zI2t6/j6s0XsXn5GqgY4Xi+xP7xCearCodnCxwtVljWwMoFLKuAeeVxuqxxMi9xdLbEwfEcyyrD5auv4a13foK33v0xRhuXcLpYYlXXIGsxnW0iwCAzuRwQ9hiMBhhOJlgsSzzafYrTVYXxbBuzjU0UmcXB/gHuPniM4/kKeTHCZLaBYjiE8wGVPJ3D2wZ+HRD6x2bQdvsm8HzCqAE1cvPvi4rekUUIgV+O1d/d/pMCSZyuMGoiNHmzrACv9MkLJJo1UarcpMn5w15++8fvBQT87psvSYGbC5A0UkRHYKEky4oQ6acV6RaSOu3RNYxr/O5f/b2O7yLN598nYRRrmTgNCtwiBFk1S0F3L2eYlx7GDvHw8T7+p//5X+LLr+6CCCgyg9PjPaxWZ7A2Q5GPkOcjGGPg/BLGOL6V0fHrDwdHh3iyt4uDw0MMBgWmGzPZWc13GoXgedpGlk/+e8JgPIUdjLB5+QouXb2OV157HVeu30IwBZAPEUyBs9Lh8GQhL9gaLCtg6Qh2MMaVay/g9bd+iO9+//dx7ebrGEy2MZzOUHmPZe0w295BWXn4YLCxsQnvHVy9BBEwmUxgbIaj+QJPD4/hyWI6HmNnc4bZbIaz+QpffHUX9x88RlYMMJ1t8MORGa+0heB4JzCpkTu1Jp3XXvhrEUbcvzgPZa11HmNYE0bgLQ990M2XTGNbUvxROMl0lEF4U3dh8/JEEpZ+c3j8TbRuM9LpTp/g4P0f6sF+qX2pSwi1KTWu/d1/mTj4SlhibYyv6JBwbeIkv5ZL8+7k1fpOBJHiOu87glT9vPwgDXQxpCnOixtrKfOtThqS5VziJ6OZSqz+ehBKb1AFC8oGODpZ4Z/9s3+JTz75EieLM2zPxqBqgdXiGD44GLLIsgFMlsH7Gq5ewbkaRPx6rQ8BdVXh+PgYD+7fw9f3v8bJ8TFmsxmKQQ7vvVzqZjAYDhEArMoybmnJigzFcITJxgZmWzvIhxNsbF/Bq298By+98iYmG5cx2biEy9dewK0XX8NLr76FWy+8ihu3X8Xla7cxnG7CFAMU4zG8ITw9PoEpxhiON/Dl3XvYuryDKjhkeQbIKfA8zzAYDpDnBVarEk8PjlA7YDzdwGQ4xDS3gHd4vLuPr+8/QO0dJptTDEY5BkUGEzzqcongKhFKBEcZPPEbbi3TbWvvjrad/u1yx/NAu8MTNXYb/W6FJclIkyfeGoenRim/6fSKhQfAv0l4mBIDNUXbWpNvCPw2XghBHtYUrHEPUVI+It4+IbI9BN4Qqb2Z8fFfe/ntH4vN6KVedU2/mw7cGK6pMz1rEahFPHZtI1d7WhbjizDSgkKFUULnbhnTtAqcV+OiIG0n68XTC51y9MXqipcurvNQt6Fd7nZGLIwg07CGUgFkMlTeojZDoJjg6f4J/vn//C/w4Qcf4fDwELbIMRkWWJ3so1zOARgYWyAfDGGshfcVXF3Ke/ayJ0cYrC5XAALKcoWv79/Hna++wtnZGTa2tzCeTAB4nM0XsBk/EkmG76/hkZPvPILJUAwnGE02MBjNcO36bdy8+RJ2Ll/H5s5lbImbTrcxHM2QFSMEw+fcKLOoncfTg2Ncvv4Cfv7Lj2CHQ1y/fQuL1YpfmyUDK0ydZwaj4QCDQYEA4Ph0jsWyxDDPUBi+6dKbDAcnp3hysA9vAFtkCIGQ2Qyj4QCWwHeEw8ATG7x5H9U5wgjo+ftNoctBDfb1EAZCI4xUZnT5bl0YQQQQp4rR456l9mqZXpIXkgckAzNHtLdB7VJREImg6bwkEhKzDufRrM7bK2//hPcZvfFiq5O3/sYKdgSVhHfTxPAewZZCn3BCFCptYYTnyavznTJFN75C17/7HSERRudBt7m7uLrfz4S1IwfyTQYBGQIsjDzsE2BRIsPBAvjFR1/iz3/+AT7/9HPsPbmDVb3EdPMyLBHO9p6grlaAzZDlBfJiACKSRxkrBMcvuJAYH0FAbjOQPmPtahwdHeL+/Xu4d+8ejo4OMBwMMR6NUbsaZbmEsXwmydUOwQcYy9M6Swbj8QQAIc8LTCZTDIYDfjbdZsiLQs6dZTA2A4xFNiiwWJY4OT3DcLqJn//yY3zy1T28/vbbmG5soqxrBBeQ2wy5tbDkQMGLQBpiPBohtwbHB4eoqhLD0RRLBxyvSrjMogwBe/tHWKxq1M4AlKEYDGHlBsvgGZ+Bh+m+M9ba1NNtq18HzsdxfkgTqMKoCyqH2vzXVjzS3wiNMPJqkBYh5GWAMZ3lfRVOfeBUGCVbCtBTJ3v5rZ+8h8DTNCQFbv19hjBKoRX+DYVRzFP+b+e9jjsF+vdOGCk2kt9BfhP4wcSMH02EgTMZTlcBn997iJ+9/xF+8f5H2Hu8i93HD7C//wi2KDCbbMMtl1ie7MMaIFgLmxewlvcSIfBlasE3wojbDzwNlKeqeWTjy9QfPnyIr7++j88/+wwPHz7klarpGGQCXF2hLis4x9M4Ip7K2CwTwze/PFsUBYJnBs3k0YAA2RtFhGVZYbksUQxH+PNffoA/+Te/wGtvfxfjzQ0Mp1NkWYb5fIkiyzEeDpCRB4UKBH7hZCgaYUbA4eExjs9WcFmBk9UKR2dL3kFuClQVYVV6zFclytohHwyQ5zkMAuAqmCAXyLWaKP3utv6vA+fjOD+kCQxosXyEPhnRZcWW5pQIoyi01GyjswNBwDYg1ZY4brziVoSXERtjF5jtmnS8tC82IySZtP62VD/tGCwh0w7GzHvRNy+laqdiaz5FDSDmKf938yYhhAkAiflW80g3X5IQT1f+voljPNxYjb98J/n1umeE/3qgtOEOze/aExZlBdgh5j7H+188xM8//BxffP0ID77+GsdPH+HB3c9wfHSEYnYJ166/gInJcHqwi1V5DBCf2bJ5ARg+/e5cDUNAnlkYY2OFifiJHy4Dq9RezpKFEFBVFc5OTvHgwQN88cUX+PTTT7FaLTCZjJHlfHfRarXE6fEJp3V8RiQE2UMYAkhW5qqqgvMOyxU/W3Q6XyCAcHx6hj/7s3+Fn/3lB7h081VcffF1DDc2AJuLBsfXso6HA+TGA6GO+1gya5FZYJBZuAA82T/C8XKFkOdYuoCyCiiyMQbFBJUPWFU1yprps7W1iYwA41ewhvjQsWfeVf5s2pb5ROn0TdqbSLYEdHglxaH+6126EUaIfUd2lSffMfx5ypUII16qb/pDK1rrS0SCnuCQ/hBi/QSJCqBuWgD20ls/eY+eWzNSoLihq49g53+3jeJ6ePGbCqNWvr3lE9ydsvRBq3wXxOvL41nwTeM3oAJfpmBi9AvBwFAG2AyhmODrp8f48199iQ8/v4eDkzn2Dw7w9MFd7D3+GtX8FFlRYLx9E5PxBhYHT7CaH4BMgMksL4vnBYgs3yOk58rEbs4n/Ruap0AdddvVDuPRSLSlB/jii0/xi/d/gb29PVgR8EVRgGSzW7kqsVgssFwusVwssFwsUVYlnFzEz4ZV4OjoBB98+Cv86Z/+Kb66cweTrSt46e0fIpvsYLK1jcp7rCqH4IDgAly9wiDn6X583wvSKYKHJ4NF7bB7dIRl7WFsASCDgZU7luSBANmu4F2N7a0ZNidjlKtFHDz7RnkG6uuivyb04+n17Xi22qvZf3guqHYC6DGdRPBplToINL72maD2IgmjGJgIpG5eCR1DCHwcBM+tGbEQMsJgugVA43U7X9ePf2rNAozB2s5hSB2UIKkQiBWSmrL9sK02KnDaNO92uEKrfEDsCGvwGwkjOf7QchqmmqKChnuA+BkhAsGYDHlewHvg8HSFv/j8Ad7/6jG+vP8ET4+OEILD/OApDp58jbOjAwwGI2xsXcZouo3gSpwcPUCoV6z1BIAsP5IYiF97RVp/oS8lwj+F7vg8KHJUVYnlaoEQHKw1mM/PcPfuXfziF7/Ap598jPv37+Pg4ADVqkRdsVY1HA5hjOGXQGSV8PDgEHfu3MHP//zP8a9/9nN88eWXKGuH2nlsXb6J7VuvoTRDZOMxYA2cc6grJ6TyMMRHjGByOLkRnGRFyBkPZwJOzuY4ODyDcwaDfIShtTDkgMB7jZz3qOsAm1sgeAzzHBvTGZyr+Z5dMfTqk9mRPuSl3bptrfTqUvIi6OfDXl/xDNI3gggAnUUGoUHsPx0kLeEakGjhzQ5potbuRfZPFqGIO0i8y8p5D1fXcJ5vAkGST78w96C3/tF/ExAC/q//6R8CSQeKf1t2nYRBE5UySsmuQOhcIdC1EenTyAoq2PiZ2/OFUfo7LU8KqioqdMMVWjiBc4RRgB7+uwi6RG7i951p0imrQmg0IQQQ6SUbYqymAcrK4MnuAT65cx93D0t8+eQQx8fHmI2HqBbHON59gLOnD+DrCrPpNnYuX4c3GY4Pd1Gf7YJcCVfyPTI2tzBZwRfqe+7AJvA5LWXmSNtkNSaEAEruLw4hAF6fyOYlYmP5kD6Rga9rVOUK5XIpNqUZRoMRMpthOBxiMCwABJRliVW5xHx+gtPTU3gPTKdbyMcjrCoPW0xx6YU3Mbn5Dgbb1zHenOGll26D4OEWC0zzAS7PxpgOAmajHJPpCEVmQcGjyDP4UON0Ocf+fImvd0/xyZd7ODlzGI03sDEZwZDDslzx3dzBAMFjZzbC5VmOF69M8fL1HZhqjur0DK5e8GZPz48IKB0M9LI4bs4g0xGmFQGJVtXllSCaRfPNeLrxVONLw/TQsQ/cdq2wJL5+s5bNaZCsljW4WMAEsfk42b6BgPj0ucZXHue4cmGeb56pUvponOB9V6YhhAAyQQzYBPzeWy8BnU6e/mVoBFCcYmlIIpyiMyRzTXZ6bUjE0dmHFC/sV5fYfCBXVbIm1JRBS0E95ekXRm0thb3ld7LcySN1QJD4sRw9kDYMO8arB0K76Yh4dWp9LxQAeARfI7iab/sxGYIdYRkGuLd3hg+/fIQ7j49x98EeDg9PMCwGyACszs5wuH+AsvLY3LyK8ewqsnyE1dkxlqcHIF8xWXMDkxUwlq/XCDB8VSwMgq9Z2yV5DFqKnYuGwFMowLsa3tcIgU/bE4hXszJ5rhz8Npp3NYIP/NJHMYDN+O7r5XKJs8UcxyfHODg4wMH+IY6OjnB2dgoiYDgcYjgYyTNIDisf4PIxrr/0JlYuw3Ayw9ZsChMCMrKo64Cq8pivahydLnFWBaxkh7dDQC3airG8Alk6g0A5Do74sLCra35Y0hg+luIIzgGGMoQAPjfnHUbFEG61wDALCKGCC2AeMTyAgHgK22rryIv8lfJR2vbpN/fWthBJdzKnELl5XXGJEFQwxghGeI8dq3rs1JSiZdJBRhUFFW5aVv0dtB8kQlBxRCGU0oZEg5S+Ah6aGYE+M1s7vq+Yl3H5Am3vWNpp51JjcdDnZroZ/XsK2hBaU/3+zYGFIRKcdV2hKmuAcpTIcO/JIX715X3cfbKPe4+f4vD4FKGukXnAlRVWixUoZBiPtpAPJrD5CLWrUa0WQLWKUysiecVDLsIHycgIICuGgOwLSaF2Nay1KIpcbl40KAp+knqQF8gMnzFkw3bNq2XpaJvQiOTiM00/Go0wnc0w29jAbLaJbDCAA6FygV8LMYRgM2TDCRzlyIsClgBfV4APWC2WWM3nODk5w/7RMe4/foqPPr2Dj7+4g8f7hzhZlP9f7v6rX5LjOvQF/xGRmVW1bftuoAF0wxsSBCiRkuhkKHfO0Z2Zq3N+93W+xbzri8y8zMN9PC/3jq6ODD0JEiBoYAjvGt1ov31VZWaYeVgRmVG5a3c3QFDS0epf9q7MjAy7YsVysYJ5a5nVLY3zURcWAM/KZMyoqjg4OGB3dw/bOnAK7yE4RdvCzCkOvGY/GG5NZ6jJhP16Hnszirch8rmfCy58zrB8/VwApY5Ol6SbfId9IjIJOv1clGJUpsJRGcMwnCshGjRsa7GtxZx68qviZ/TEgz3lPoJqJ+re3SdTXsbh5CDP+nut06STS96FLM9FsS2vC5m4Fh92LGmXZvDtcs5osUPy7+STpDNZhIWaJyKUdTR3KkPLCtC3M0QRLeXYQwgBHxStcwRV0JoVrmzV/Prtj3j/8lWuXLnKdH8fgGo0ZjIeY9uavb1dSlOwtjKhGhWMxhVNfcD8YAtbH2CMAkIMdC99E8j7Na10Qpj68RZjQNog65wcd91XGLxr8d6KpQwJkJ/GPvVJQljvZYGzVohWWvwkRrYshsIFSCA2U1U4XbB2/Byrx06hqgk+KFRwjMqCvd1ddna22Nu6zcHODru722xv3cD7lsmoYnUisblNKd7qLgT2Zw1704a68Vjrqesa11qUU9jG0c5b6qamcTWtb/AmoApwTc3qygjbTAnOE7RBBzAhQBD93iLnPUSkHIuG7zII3X+Lj5bA8PlQZxTomJUMlsyVQaIel+VdWlzS2C6HON9VVO8oeZbm6YI0FdUhSaTzwWJOPfmVvwsEvv7Uw52fR0fVunOPesKUqJn3Xt7faTvIIWKUvx00GO6dGEmz5Vn8+lDZS7azCBzV6aQ5emdIn8f65MmPLqP7Fe8X250ghJg4KELQtKrkxp7lrY9u8NHVLa7dvM3+/i62nWPKkvF4lcl4RFPXzKYHjMuS8XhEURicb5nNdmjmu/h2RmGiE2MKSdux41G/FujM+yZyOiJ8BApj8M7RWhHjvG1jmFhxbCRE868o+5b2g8rwSmuJAGCMiex/GkiFV+lYJUOghMLgTMHmqfupVo7jfEndtHhnKbRi9/YNdm7eZH9ni/2dLXZ2btPUM4yC8XjE5vFNcaosC4ro43Qwb9mdNsxqR9NYvLXoAK621NMDZgf71PN96mZK085woUVr6Z9CBzbHI2xbY1QhXFE88jv1WWxx1/blcIf3oftv8dESyHq4Kz0X6LpSsgxkXi4SlSHXkt4ppQhEl4yFsT0KBjidnmaTK8CC4arDiVPRmva1Jy8sVECpxT1cQ5BjiqOT2hEUU5719z19EATs5NUI90qMVIjIHaltV99MB9NHlRtei4NxyD9p8L4vf0n6vJ5KZeX38rJSKkY2TXkn1ld0MukK8Yjpwkh8Z8yIg1bz5gdXee3dj7l2e5dpXeNdQwiOshgzHq9im5b57AC8w2iFUQqlPY09YD7dppnvYZR4JEs7JC52QgWtxI9IK4Xp9HLxJSKa+0h4QvSqJqTjgTxKgVGKalRiCoP3YpHKsb/rMxl1qUPkzLrdXkrLZeTsNFHaG2ZNS7W6yZkHHsOMNvC6YjqdY9sGbMPe9m3ef+dNVktNfbCPbWfYtkGHwGRlzOmzp6hGY+a2xcTQN00b2J+17B/U1LWVo5SaGjubMd3Z5mDvFrbZp2n2aer9KBJ6mrrGoDhzYl28sYNCRYW+IoqAGX6glLQ3g8VJHydnEmdjkDmBRV1jynNIlEL+LiDSSsxZpQTDb2I6QlxuMrE8L7OHnnMavs/xXCb74tgv3mXtj8RI5YuUvJSGt7aVlS/J/EuisSmlMMZQFLKyDfr6t4DPLaPPDoOBW2j3IcKXId1nAhFpkt5BG01hSpraUjeOvTm88cE1fv3mB9zY2mM6n4toE5DJrDXT2QH7B3syfhoCHusa6mZG3RxQt/ugLMYEmmZO07a0bSvHUacJMGhnDyHuL1vUHwksttmYxPH0FtFPA3lfhhgMziPKdVWUVJMJuigpx2NMUWJMgbWWUVlh6ynTrVvcvnEF/BwdHK6taeYz9nZ3uX17m4PZnLqxzOfiy2QK0x2t5Jxld3eXne0tdrduMt27zcHWVT756E1uXnqLW5fe5sZ7b/HJO2/zycfXuHlbNt4qU8joKfC6t6rdDT47vtwJFnU2dwKJJSQHKiadcDhC9+mzZzqqYo5Km0OSnoa0Y1GJ3dcziW+LhvuMy+meLZjn+99dpWLed6vg3UCyTUryHo6eLL8LiArqe+jwzwOSpU4ujTIFKM3etObVtz7gpVfe4eb2lKaxcc+YBE2jGOGBNjoKtm0j+QUvJvJ6StNMae0chYtMhxHOs+PGFq2R0l4lV9YHC/iRjX8ObdtirSghbWsFZ7LrbtARdQXiyiD6oqAUphwxXlmnKEtG4zGbxzZZWVvBNjXGgG9qxpVCuQYdHKOywlvH3v4ut2/f5vrN20znNXXTMJ3OqOsGozWjqoqimyEEx97eDjdvfsLs4Ca+3WG2c4XprUscXPuQvY/f49YH7/HxO+9w7eNP4i5zA1rhjcLHv0k3sgAdJzx88fmBjJVsAFYxeuqycRJYrhNeBvlcHNKFpRCC1GEJnoTQC4+ig8zGPWKeGCXjxDPxWOJF5EjQ34QYQsBa8S/xUXmXJNY++eKEPmp+5wSueybq1UOgFmrSw0LeXV0+X7h3AhVrqJxcsS7yv0LIkFwOhQ2KNij2a8f7127z4mtv8epbH7B70KL1iFKXFKqgCIaCUgKKoaNS2lM3cwgW71qca2jqOa6uKZTGqAIftOxDK0uKqhTxOq9uQs5UyfhD+lpEkT5dWjh6sFYIYiJKHRpk6HAkLAyoRgWDDhoVNbFaVYyrNXQwlFqztrbC+voGVTmi0AWjsqCpp+ztbKHwjKoRZVFim5bdvX22dveZzlvmdUs9r2nnjVghDYxHhsmkYG11jA6O2f5tmvltqqJlbCyh2cPPdnCz27S7N9j55CNufPwh9cEBMk+zsLILlCg1arGjUr8t9l/WQQufDEfoKMgXz0Qwln0rBFFr1Z2UYgozIJT5gIlUNHxGplqQsvMFNSnyI5fbMSwiCirSgQgkzOrEWCXbu3o5N6d+i1Qzp6JpRY0F46OOJIjIocSBqY+V0ucVgpIBHJSX64qUUEg0sstXJRk4pOexLt0XCfrB6Os9bMdvD6mD70yYonIYj0J8cYIsGVLLIMHtPQYXxO9lZ2r5zQeXeeHVt3j1o0+4sT+VFTgoCi2ESDtNGQwlEr+nbWpsO6fUSDwi12LbBts0FAFGFOhg8C6aZhPbHIL0Y+rP9BclHsZe/GVS30PUiwQ/8KORMSyKokPKskpByrJrEV0PQaCfyzqA8apzfC3NBKNG1PtT6oM95rMZa2urnDp1jslkneMnT7KxsUFZjahrh6nGVJMV2rZlb/+ArZ0ptZcDCUIwYBW+cShvGVWaybjg2OYaaysjtGo42LuB8nNGpcK3c2w7xdl92voWI7+HP7jFfH9XHERDEP1l6r2Iy/3V455M4IBKXvWKzvKW5k43j1R/ZPfdQKcDqQLxdJXUw4vfS/mpjvn8lGUx+f2k3yHEZ4QY18lH3WeyDPeEaGGEIw+jon4reOkjoRn93FURt+WSua5zbmahA7qfi43SucIpnal+jx23DBYndk8YlULYnRD//itB1q2fGTrFbDDdbyJBlSFSKFUQwojGl8xdyaXru7z14TV2Zp55qzk4aJhNp9imARe6NURFUufbBt82KO8IvgUnV/AtCk+hDa6VgxGLslocx4jw8igRSWm1jGVa7QaQFpH0W7C0H7+olPxtILUxjcJkZQXbWHa3t7h59SomKCbjCeWkwqpAMVljsnGSE6fPUY5XMaMVEfO8J7RzdrZucOPGdaZ1y0Ht2J21zFpH3ThAs7q2xqnTZzh5+hSjUUHbzKhnU/AOJdGMhFDQokKDnU3Z392RiUmQTdufptmC2Mv79zNDHwxRfMTuLf+7LarpXS5qiyk+Ep1kZY/vlFKYdJKMTwRVykiEKKZcHOlYTldMiF6WKZOeoi/5HRFRZdalzwrSIbkPg4bo2p6OTLpDf32uELIButtA3QmCksDzThU4Jfu/4pv4v8KHAhcm7M8K3ruyzSvvXOLq9oyDecA2CqNLmramaWbM6wOsrReU3t61KG8JvsHbGrwQIo2l0gofHRWNkYm5CAlZIyergCArpNIhelYfbnsaZaNNpwQ1C9a3zwEi95A4hKLQ1M2Mg4M9trZuc7CzDa3FlIFQODZPnWXjxDkef/IZnnz6C1Rr62wcP8HqygTlGpqDbbZu3eD27pSb+w23Z5a9JjBtA40DpUuKasza5jHK0QilNPv7B922hxxCCNT1nJ2dnc4CmebEvcyBNHHvnvLeQPLrJ3g++e8FluJ4RsdC5OYXXh+ar9n4p8ZFYkSMs72QNpNehJREcYHkNBoW97wsViDVTt53mnjrZCOckwBa9wqpvHSF6Kq+OJhSWe9jJLmBk90C4b9L0XcjLnlWnxck7ieoAk8Z3ezlnQ/QBsPcFdzas7z90Q1+/daH3NxvmDvNrPZYJwNUGIXzDXUzpW1nELd+WltDcGgtp7gG26K8w+DQ0R7lncMURvSAaXwS3gQiQsmlENE6BBH1nPOyzyhew34LIXSuHT4IB3EYZxLERUtHn6KEvPFKpn255DtB0oDWAWcbbFtTNzNsO2Xr5hXmO9fZKCxnVyvOrq/y2EMP8OXnv8Ajj11Ea8PGseOsrq/jbMt0b5vt27fYPThgZgMHbeCgdtSNp5lbbGOxbUM1KhmNKsqypLXSBypGppDAc2KF2j84oK5rqf49IM5C1wWyGbvQYZ8d0oROYhhSqHDhRI6EIyeOynQ7IURTf3yXu+5ItmmcewISom6pSxNxLeGN1E3aOmzx4tzMNHDp4VATv/hBphbOuKNDpdwBJB/RH4Wg4h6ow+Xl+Jzedwib6ZE+LXT5H3H/eUCnV4nhUIWWxnbripoRl7cOeP2DK7zxwRV2Zg5LiUURtEm8D9ooTKEkcqK32LYmhDb6Gtme8NgGfAvOEbylrSU4fVqdkjOr9Fk+/T0hOHyw0eTraG2Dj3vOhEMSLkmupOMQYpF+CzeTnucDI9NBazlyWikhSMI5yoXoqZHtu17249Er/ufzKd5ZwFOVClfvsF46nr14ni9dfJAnz5/ha19+lkcfeRBjQtSfearJKmiDbRr2dnc4OJgyty1z55jXLaF1GO8pg2NSKlbHhtGoJERCq5SmKgqC99imJniP857ZfCauDEpJ+7MJ3q/4CZ/7d+LIGhu71Oy2HBbz658t3Ouoj0naq0gzdIr5BVld4phlkzbPL6lgVBS5QkiK7J5p0GncIp6Lb5roJcUfbZG5SKZ7EOLY/U56Na1lsRLORKp2r5MyUVvJ6HBn3R0WEZklZQeGq+3dQC10cIJ8IuWmyixFp5D7PEHFs+d18GgcOgRcgFaNuDX1vHHpOu9cu85WXVM7R9u2AHgVcMbjtc826or4ZG3NvJlRlppCBVGw1nOUdzT1nNbWQphwQhwyBBQInZjXExqHcy1NO8d5232TWHEZl/S9rJLe+7gn0cYwE3k5eT/Gyal1t81DRe/u5aCEKAbZiOuDw3lHVRVUpWF1MuLJxy/yxOMPc/6+8/gAs2ZGNanY3t7j/H0P8MiD58E5irHokkxRUc/n1LMp04N9Dqb7tM2ckYYVDauF4uzxdTbXxoxHBVqLv10IAVMYnLc421IYQ9M2VOOKlZWxmKaXtvl3C0Ms74hVfJju8/m0qK+R+Z7qnNLnRIgghfTMxmBeDW7lu0XpSmcHtHZ1JNFh6bNEQ9LBHJrUwIXKLnImw/uj4J6JUtLIf45E4O5FH1FWqkNXn88HRLnp0MGiQyCgsJTcPmj5zQdX+PjWNjf39mmCl/PIYqxllMNrL450WV7GaIpSY13DdLqP0YFCBTSOqjSRAHmMUVSjCnyyfA3a1/X54B1eiJIV36UhJMQBQTrnPM4FXLQMLhKt9I2kd8Gji+iXkxG5kHPaEc+EGDm5YqA15yylUTz1xGP8/pe/jLOOl3/9Oj/7xSvs1Afs1VN++OOXuHbtNo9cfIhzZ09jxqtsnL6famUDgmK6t0c7n9HWM0rlObYyYqPSbFSKSrXo0DCqStCa1ori33mLiVtXrHfU7Zwybu79t4I0sfMJflcYJOsXGXmZWwCBKH0sEpH0blhmWpy69FoWn/67YR1jNAwV8Hhc9k9L0VIx+VDYMtHK9/i6iDZEEpezndnfQ/S7++jznfCq59CElOfF9mLFcJIQOzF/LgQ3V64tWRE+LShPUOCUwaoxjVrh0vVdPr5yg/nM0Taetm7xFhQGgjDW6V/el2klNiHgm5pmJvuvqrJE6eQdLkHTtFGikPYuhg1NV6RHxOGKiOS9iGUy0PJ3gWBEh7quWYM+7aQPHZX3yNYOEb9EbEr6h6FiWMoXAuW9xMVWKKmGiuFNgufCA/fz3BeeYefWLq/8+je88ebb2OC48NB59vZ3ePfSFX7z9rsoFXj0kYtsnjjJ+vGznDjzEKtrJ9FBiTulgkmh2BxrNsaKjYmmwhJaS1GtYqoNvCrxBKwVB05TaJy3+OjGMB5PCCQCnYZI+mM40TuEzIj54rujrqMh5Z+PUf9O/h4mAgL5TOhxvb+Xv4J7wUtkzhACSumYtwiD/aAnl52oTFcKUvidZVeGW/nC5L2PDjEZyJwcIuPhyQyLxCdJp72UuqRTP0dOqIe+nFwe7YnQ0WXmzRqiz5Laf2qQkuXcrZYRtw4cH12+yfRgTjOdo2wAB0YXFEUl2x+CQVMIccol/uSv4T2V0tBa6nkt70I6MkZOerW2FcLqc4J0uE0JIdKmV6LScrilYzj8WktEv24N6DJOC0I6TLIvMN8KkONVYtEl38Taq0iISsajCWtrazz7hacptebll37Jhx9epmkaLjx0no3VMQf7+1hTsDtvuHHrJsdPHOP06VNsHDvBqbMPsr5xgsl4wrisGBUlk0KxWnjWxoFRFSi0wlBQVusUk01MtSLiZJoLcSS10hijGY0kIFxqnlIQjlhkl9KfQw8G1110SstLSrDkbY7n3Xzuy5D7tOhILKq8LjkRGs5vFfWiIOlC8HiiiiERn+xfPidFn5oOBJUNQIKoWa8lipm05CquVneFQ519FPSNJzP1LYOjnh+Cu5a92BH99a8BEjvo6vWbXL1xS5SpszkaxagaUVViUk6D3jl2Khn81PvC1Qg6aKVw1jKdTUUBWBYoo2VFdxmnk+udlrS7R8x0xUVlKArElT2EAFERTb5CZt92rc7ycLliM2OoldadC0f6631AKSMnl/jAqZMnuO/cWS599CHXr19HKc3qZMSpk8fw3tO0jrKc4JVhe2/KeDzm/hMnqBSsrK6yurrKSlUxNoZJVTCpSsajAmNUdCFQBORAy2o0oRqNqUbjaMWNQcCQAShHBaOq6PpyyCX+W0Ai8jJUhydBx43EtPLrMAghWmQ+0vj77OyzIaQ0eU+kPFJZiQgGhHCHpDKIeyp9SJzR4fpDPO9IkO/oNGSVuSeChVDPIwnCkZzYneHuZeflHVH25wqLyvJA4PbWFvPZjOl0Clp0O1VVyYRqZH9ZnPV9e+LvNASCbwobrTveB1rn0MZITOiQiJG0LynuQ+SCunbnTRcM6QZ52QIg5cb/AtEyZgA52VZktHgtjIUQVO8CIRwOB+ycbCsC4t62NvpFabQu0VqxubmB94G333mHg9kUcJw+dZyN9TVaD3UbqKoxAcPW3pSD/Sn3nzjGsXFJYTxrqyMmRqFdy8hoqkJTGSMuKkFhqjGNcwSFhBspSoqiREWFeg+BspQAb8v66N8c7rCoQ8YVLUH7jlgMru794CBGIp7k5ck6M1CeK9URQ+i5JR+8+H6HGIrIiBi9IJrlkK9sgCRcAkc1YEjB0gQL8ZthY0JHtfvG3h2GZfff/+uDcCByZQMSIODZ399jOp3S1BZQjMZjWDhTKvfX7iEyE326yFEkscZZi7WO0WhMUUpIW1EEixJbhYCPBEosHt0gRMm5HzfpcxWPuJZLa4P34J2nqsYSI1oXlNUYreWkER9kl30gme6Jzp5yyVHcUfSMLh3yvHfzEDyMeODFIhN8QBeKTz75hA8ufUzdzJnP9thcH3Py+AZN42it4tjGCapywrS2bG9tszkuOLk+YlQoTp/Y5EvPPMnF8+cwoWVUaMrSMJvPaJ2jsZ5p3eKDEJuqGsUQtZExQtO0Fq0NxzaPUZWlHOOd4V3HPA0GrxuzQG/aH3CQnxbuPC8O434+L/s5t2y+xvTZN7KA9c+XQZd3alMcw45+CPZKujjG2ddduuV8F4LsRVFgCkFumQHDVEsgIfqSgelp2pGMYlfTnNO5U+dL6lio9OIduu13Dansw+WrEKjnM/YO9mi9oyjKeIR0AMS8efT30v6kfFbxFAZTlHE3vkIhBGc8GqELI6tO5Gw7xMruRaEt/d2V1o1bHO94GSMnvoKhqkZMJhOKQraYWBc6Ehryw/864iNERsy/URRN+QchOCr+RklIXKJPkjEl1Uh219+4dYv9/X0ODg5iFEfZJDuvW3b3ZzgXMKakaTx10zAZa46vjVitDA/dd5bz506xuTphXGi8rcUfq22xLjBtWmrrUaYUnZv34htFLzp7F6iqEaurq4yqEd7aI2wx+QI7SBDz+m1hmENX3pL6yHgffiXtCgsuHCqZ+JVw56H7Xt6FGMcqcUi58QFk/NIimTgk1ekCRbTP53LCSR93fcRQ4sOqxtU4OTihjpRHPwskSph+D94exYD9Tw9FUdC0Ld57xuPxwruEMIGeIEuohYw7VYidTWm0iQNsTDwKWlPbFoymLEsZwFwRGjwEJ3uuMgLVly+/hbD1ZQoSijn/xIkTfOub3+Kxxx7HmIK2tRJfSMuVnNeUKqII17PoaZzztWLBsx5Br4CccGFMQVWOGY3GVEWJay3eOs7dd5bJZEzbHFDXU7Z3drEegjK0rcMrgwuBstJsrlacGI84s7mBr+cUOrA6GWGbOfVsRtu0OB+YzVtaH0BrvI9irkIIrA/dwlgWJcc2N7sJO8Rcssn7WSF9/1nyGH4XEieczW/Bo1ziWSQOxMifuaPiAnmIdCE9HtazJz4pvL7kmcpKBE0sdv0CSRToUQOiEEIMLRsDMCXqKauofJgqMqzMvcKygYQ7vfifG5RSHD92jKIoQCmKUs5y7yHJKJEgZaJe1yVKRQ5fEMkYMX2bQk76UEozn7eMJhO0KQkdMYkK7QzR83Ebjj9xoqXLWnHI/PLzX+ahCxeiU6CnLCuqchRDyMpR2VpXnTiWCJtkGXUJiehFQrSAP0FFnVMBZoypVnFe4VxgZbJKcJ4zp09y+sxJxpNR3JYhJ+JqrRitxKOPlHimV4VmY2XMuDTM5weUhWJ1VFBoxbyumc9r8B47n4Ft8W2DVoGiKGnbuJE4Esg0ic+cOUPTNOiyuJvR67NBSP99ynnVfZc9uuvcFCajJ0yHQal41HmyesaTUkiLZa7UXuB0ZIxDPN5ILol7rrLv0l/nojVtWZWHSNv9DnFSDChw/vcoSJHj8tU+SOiALjyIjix9WlEZ5B9C8lkQE6II9X10oPRdUtz2OpzPA8JALzS8FqFrVwBQjEYj5rMZo/GYopIz7kOUy33cutER/p4CSX93DwSBiHoZHa1RVTmhLFYp9ApKr7B6/AShECc+BaxOxhDiEdLOCborRdAKFbkrU5SsTFapygprLUVZcvbsWb7wxWf5o699nXP338crr73KpUuXpCYDvyEJZiFbKRJyK60xRUHrLK2zskVGF6jovpA73CmlKYoR2owZrZ+i2jxLS4UPhvvuO8/9993P8WMbVFVBUQgHWNcNu7u7BO0xFYwmcpy18gGDYlyWBA0f3bjKpSuX0HiM1sybFuc9JTCi4dzmiC898xgPXXiAY8eOMV5ZkXpqQwigjWFjbVUWlKo8dP5XCFJmt4vfBwmPgWzPkHFbPuGJfTmE4Ry8d4j4ksYgcdOZdbZLmRwd84Uqzimt5KDVIotVHsJhi1sOCoXyCrxCdaFrohEFRF8YJI2SqFyooFE+0xlJSNNMbhzId0IhD69mR1WKJe9Cxq4vhSBm1jttMYlkaeGu/52u/P7fBxhgbWUFhWI0HmGKAhcCzkuguuDToY1RA5MZMRd6QgkRkb1c8ZEyEAqMHlEUE6wFTIWuCumD4GjqGYRAURbiDa2EJVZKURYFVVlRRNFrNBrx7Je+xF/8xV/wt3/7t/zt3/5XvvGNb3Ly1CkuXrzIww8/3J/uYe0iIocQayz4Egi0znL8xAkuXrzIytpqNwFUJEz5VRQV48kax88+QLG2iRmtcvPWNmUx4mtf+xonT5xgOt2jMIaDgwOsbSnLEhc8s/kB4KjrqezPc47gG+q25aCxNM5SFYZxVTFvGmwrQf3XRwUPnTvOQ/ef5eELF1jf3GCyuoJXoHSB84GiLFlZWWVtdU0WgkOodegBZGO3HJt/dxCHN96k/5bXIkSPemttDJgo590pnXSZUT+UhStO3+X3SvWx5xPBSvig4knUqvvOE5xIYEZrisLEeEYhUI0q2YUdj48ZFqriqREpw8TZ5ETrSAISKyWVXfwmB0HORZ16Xo/45N8ZmblXUKysrLK+vsbmxqZ4PcfYMM7JHqzgRbEcQi+ypYaquNANNRUScUdO1VCFcDfWOWzbUhVF3FKhaOoarRRFIZtW82yS3O6c4+TJk3zrW9/ir//qr3jqySe5du0a77//Pk3b8O6773FwcMA3v/kNHn74As61VFXZ4UKC/F5rzalTp/jLv/xL/vzP/5xzZ891Y6riwqONOBMWpsAHhfUKpQu0qbAu8NZb7/Laa6+jlOK9d9/h6idXqaoRIQTa1nIwm7Kzu40uC1rnIrFzBF+jlGy1KYoRo2qCUXJqrvKO9dUJG6srbK5NIFheefWXbO9sMx5PqOtGQtQahQuealSxvr7OxsZG184cFriNO8yFu0HP2f9uMFzGZnGMBIYLSnyani0Ql2XfR8ieHW5Dz60JLOa1wBkRd+0vKK8Q79+0c1fFWTGszNKKQeenoTKquQwS5zXMdxkcbuS/f1BAURiOHTvOxrEN6qjIloMPZS8UGZHt7mK0vS6Xgf0z7wljDNpogvfU0wNKIyJa6ntTlAQ0bXfaR1Qgxm+feOIJ/uZv/oZnv/Qst27f4h/+4R/49a9/zXg8Zjab8eqrr/Kd73yXra3bPPLIIxRFIVtPjoAkjpdlyfFjxxiPx0wmmeI+iZnp6KKiYHVlRSxWowrlA3iFs54XX3qJ7333u7zyy18xPzjAWsfu7i7vv/suB7s7TKcHzOs5s+k8muYNB/UcR8B5L9EyTUXTOOZNS1mNGE9Wsc6zur5J01guf3yZ27dvE5Rs7BXfL01wUJqK1ZVVVtdWpV7/ASAnLMYYimg1VUp3+w/TvNdRVLuX+XmvkHRR1jqslfA3wsnfQ/92lc8o5vDdnaBvg44KTvFjISNaw3wPg3RGiJYCH6l2PysDZAcJ/tuCOAUqHAGPc57Tp0/inGdUjGQrRiQGKnEJSUc9GJjUJbLqh8gR9ZTJ6NgnzlMVJc3sgNneLoUGQ8BUoxieRHyEnIe6sfi4D/Hs2bN89Q++yvETx3n9td/wf/4ff8/Nm7f4oz/6Ok89+RSXL1/mxo0b3Lp1k9+8+RZn7ruP8coaB/vzGDxfi1leRxFSgUfjPGxv7fLBBx/hozI6hR921uNdQKkCaz3nzz/A3/zN/8Jzz32JUVVB3NpijALvuX37FrPZlKqqUMowPZjy8aWPRbxwjtnBPjQ1rpmzN59DVdEExWRlgibQNC1OlezXnpXjZxitn+Da1j4fX7vNx9dvM5u3NI0cA442bB47gfeKzc0TWOe5//77KJShaZpOpRF0DPs6WJBVR4xFF7bIESxCx30Esdwtw92E6x3OH7pyN47MhYPBipVwLWYf4oIEcZe+jtLLoHyterF+oZ3DugYxcqWy8/dJsaBie4bQYXNZFLgoog0LSBEDiR6zYmFbZNs+D8g5sP9ooIDxuGK0sgIKmlbCVIQgBGdh7OMevhCiSBoiYcJH8eNwHyklYo5Y6TwFEJzt9DOJQzaFoYwnbayurgCBzY1NvvTclzh9+jRvv/023//+9/nkk0+4ePFhHnnkEXZ2d7j88WW8c2gtkRALU7K2tkZRDa2CgoCpbSrWfzabU9c1u7t71HWN956iKPnKV77Kt7/9bc6ePcO5s+c4c+YsRVHSzGrwjrIsYqA1CNYyne6LArsUfNTxpA+tFHbeQDvn2PoGThfcPKiZuoA2JefPnObM6dPszFpu7jfs1HBzv+XNj67x8uvvcvnmDrWH0aikbVu88zR1i7MS3kUHzYljxwlBIglonbjWvOGLt58aDg/rvcEdvrvz/FxCuDJIBGlIGI+CEIlMjp8LdGJJGeREMLDojvLvF9JkHFqtUjDx9G55g/9tIAYKk2FnZ2cbZx1FUaELLYcjRmtUCGJ1kOiK2ern433cWS8EysXNiOLlHJQmaEUxKiPXoCgKLZYjFdBFIStuDLFajcYU8ey79bV1nnrqSZ54/Alu3rjJiz97kRs3r3Pq1AnOn7+Pppnz4YcfcPnKZayTE2WNURJTqZAd7cPFi4wgoRST1RXOnDtLNR5x7MRxfu8rv8/J06c4cfoUX3j2i1x85GE2jx+ndi3Tes7BdMq8mWEKhQ8tyijm9ZTWNWgUq6ur7O3s8t57H3D5yiUOplO01owrzYmVESeOrbM7a7l0a59r+3O2dvc4vbnBpBxzY2fOpVtTfvHWh7z6/hU+uLbDB9d3ubXXokzJiRPHOXPyBEZrnPOYskJpzcrqCmfPnu3amhbnvL0AaOGWglb46OolO20i8fod4mkg4JVfuIKSTaufNxwe80AIVi5cZuFeLFvFzdwgHv054er8jJxzgqCmP90hQbKa+BgKIoWD6OHeG7tAKf8NYFh2zo192hodymtJu5QWSRjAenAOpvtzdnb28XEPZojKYxdN/OmSHfeW4O0g3MKgpkETlEGXI3F4jKua7raaGLwqwIzQ5Sq6XJEjkqzj/APnee755/Eh8OZbb3Ht+nWKouTcuXOcPn2asirZ3tmhrmuSiHzs+DGUUtTdfrrlkHQMWmtGoxHnzp3jz779Z/z5X/w5X//G1zm2ucnHH3/M7u4uKIV1jrqtmbfzGMPICDe0t8OzzzzF7z33Jb74xWd44rHHMYXh6tWrsr1mvs98b5t66wYPndpgtTTc2t7n+vY+N3fmfHT5Bp/c2OK1t9/n0s1tbs9aPrx2i5u7+zij8TpwMN9nc3Od4ByubZmMKqqyYG11jcl4hc2NDU5srkfheEm4iw4+LRZ9DvApmYmEQ5/nFAzIBuck8kWWXsS2bEN8cjFI+sQcdJQIupWYeyAYMjHEFB2C6ENUYlsz6q+UiA90eapcMlwoR67oj9D5JvTRCBdl4uX1yuFu6Ybvk7VgKJcvQqr/4pX2ViVIebsYcXE+r3Foaq+gGDFrWvHDCLJSaOQsK5LeSMtR0yYqd7WWo1y8l3XGlAUmKhpDkAORTLlK4wvqxqGCw+Oo65nsoULhdQXlGmZ8nGpyjNFohclkwvnz51ldWeGNN17njTdex/uWotAcP3Gc9Y11nHXcuHGDvb09rLUYU3D69Fl2dvdpG4dWEi1AF0a4rvGEcjRhdX2DRx5/jEcffwwUjMdjrI1K4lu3OXv2HGVZsr+/3zmCrqyuoMsCjCg26/kMby0XLlzgmS88w/Nf/hJ//eff5uELDzKqJty4cQNv5xRYJmGOmW9zbnNMqKfc+OQ6t29N2dqa86Ofv87/+b2XeO2DTziwPh6fDVVlWB0bTqwbvvTUg3zhiYvYesZsf4/9rW2cc7JHzXkuPPggp44fp4jcpvO28yvySuOCEr49hN7J9I4QMk4/Xgvz595gkQsa4uthENzs7mAghqWFeTgPkvjVz4l+vgf6Odrlp6L4FfVmspD1+yklYV9m8KGnDDophSNlSxMqWV0SLFM8fRpI+R6e6J8WPtv3w7KH958GukHK7vO8Wttig0MXFTNrubW1zXQ2x3s5zjpZLoVo94pL4SZEx5P8M1CKoIWV6nFHoTCU5ZigxFKWg2xpAK8U2lQoU0buaEQ1GrG5ucFDDz1E0zZcuXKF2XSKMYaTJ0/y0IMPMRmPmc6m7O3uMplMqKqSc+fOcvHCBba3tjpOeV7XOO+pqoo//MM/5K//+q/4i7/8S/7Lf/7PnD17jtFoxOraKltbW7z44ot8+NGHTMZjjp84wYkTJxhPJiglUSKatsEGi1Ie3zYYrXjw/H1M93f42Qs/5sWf/YT9nS1U8Dz66COsra3Q1gdo3/B7z32J48dPcHtrm2s3tvBecbA/g6AoxmMm6xO8nXGwe5324BYT7bhw7iRfef6LPPPEYxzs7nL50sfM9vexbc2jDz/K5uYm4/GYhx96SIwBccIv09stg2zq9vApOZlPDXHc5ffhwoZ4+ttCyDiinLAlXB5CN28GfaiHFUtstYknTpqiEHY7zo7gfafxz+HzbNxyCIOVJFHmYbp/PzAuKoLXWF1xY+uA29u7zOt5DBFLhqJ3b0TaghrEuTXqImRjosRDkjwOL47idVsUJprPDVpDVRjOnT3D8ePHuXb1KleuXBZ9lfNsbm5w6vQJqlGJs5aVlQnf/ObX+W//7W/53/63/4YPnjffegs68b6gLAq+8pXf5/d+//cZjyc89NCDNG3L1vYWRVWBUuxND5g1NfOmoW4blNFU4xFNK/coaJ3FRcRu25bCwOrqhBs3rvPLX77M/v42zjZ8fPljTpw4xrf/9I/5xtf+gL/+67/g6S89z3YLL/3mfS5dvYGzliK0lFgKN2VEzWox59H7Vvnaly7yjecf45mHH2CiS978zTu8+OLL3LpxE9vMOXXyOBCYHkzRRnPuvvv6Pu4OKj08bkL8+6sbr2X4+zlD0hmFaM0MOh25PSj7cLV/axA60ktLvdSU7d5XqldDxAiSOd0QnVFWuZQgBDETu6grIllG+qRLv7kT3OX1vz18xvpla8HC3Wi8gjIj5r7g8vVt9qc1rXcok5wOwwBRosirFnNdBkk0LIpS8CtyWCEEOQ/J+3hEtKxcOkYGKOLR1lopzp45i9GGa9evs7e7h/cSW2Zzc5OVlRWUUuzsbvPYY4/y3HPP8dCFhzh27BgaCe3R2pbRaATAuXP38Xu/9/u89upr/Pf//t+5eeMmANvb26xMJqyvrzOdTnHWMh6P8d7T1LXEM3IOUExWVwElG1itw7YNRTwO6e133sIYuO/caUajgl/96mX++Z/+ByuTiue/9EVOnTzB1evX+B///D1+9cprlEYxKQKq2ef4RHN2c4VnHjzH1595nK889QiPPXSGQlu2tm/wi1//kl+/8hv29g4Ej/G4VkKROOu5eOFhzp09t9D/R43O8HmaE5GMybIS9YSfKyRCme6lkIX6JGwbTsScWKRdFjmINHREfYMUmr7P2xWQOEj9oQ3pef87feMl0uOiGEbswO5ZXrcoBwYyaw99OTlR6q+oB4rliJJL4b0ixCuXTZd9I1dWjyVwpzLza5h+eJ/k1+AX9Ue5OJZADfwxOp+SpEtqPYSC/SbwweVb1BaMLilGJeOVkYhh6WMfCE4Uo2lgE4RAjHIU9UxeRYNCdJZUUFVjjCkIBNq2jv4yChUCTd2IudpaRmUpym2jOXvuLCsrK+zv7dO0LWVZMR6PWV9fZzQa4b1ndXWV+++/H200trVcu3aNsir55je/QVmUKC2WpS9/+Xkmkwm/+c1vRDy1ltl0ynw+R2lNay37+/sordlcW497t2BcjWTBc44qnlm2t7fL/t4+bd3grKWdz1mZjHngwQd48MEHeOedN3nrjdd4/713+Md//Ht+8IN/4Qc//C7/1//1f/KLX77M6rjg1NqI4yPFl5+8yNe//Ay//8wTPPPg/Ty0voqeHnDj6hV++eqv+KcffpeXX/01N7du01rLeDyimc+5feuWKNHLkocvPMzmsWMQBG9VfsZXhDSJh2PXQcSLXr+4JM0dIPn+pCuVs/g77fWKeBKvlCZPm6qY6rqszmkOEd1Mkg5I3uXzp5emkj4oRGKY3oeQdM0xdM2gzBAjpx/qGB/EazXEEyF1XMlD4NB2BKVE/6GUrMLpsLvlMJzO/3FBBbBNCxiuXN9hr7ZgSoJWuOCwrl3oDxW9kSFtz1jSh5kBICkCjZFjxmU7Rdk9y0HFgXdOrHLaGEbViLXVNZyzWNty9uxpLly4wPFjJzh58hSrK6torVlbW8MYg7OOvb09fvKTn/Dzn7/M+Qce4KGHHiL4wOraKucfeID9/X12drZZX19nZWWFphWiNB6Pcc4xm80ojGF1dRXnHa1tmUwmaBTHNjY5cfx4tD6KSBkC7O3tce3adR5/4jH+6A+/StPM+M0brzGfT1E4Pr70IS+9+FNeeumnXL18iQfPnuTZRx/kW7//DH/6B1/ki4/cz8m1ipFx1PUBN27d5pXX3+Af//n7/Oxnv+DSR1fY292To56ahrZtYswkOaJoZTzm6aefwuiCXMWRJmK3GKcFuU+ysNgN4U7vPi9QUeWSE8h+9vZEBXoDTlqEc/zr6jqscuhjGqno7pAIUipbQspEBia6qQz7SJtoYSMssk3ERuQNOLLjhu+XeGjmIMTyiLz+w4HEvZ7XjktXrmMx6LIEDc5brLNd/0Hc3W7EHyidYLrIzqbk8kyIToE2BdqUotuLRCn5wHS5K9BaYZ0leEdpDCvjFTbW1/C2JQTHE088wTe/8U0uXHiYzY1Nib1UN+zs7LC7u8vVq1d54YUXePPNN3njjd+wv7fPo489SgieM2fOcO7cOW7cuMF0OuXY5iarq6vUdY2zVoiPc53lrCxL9vf2mc/mtLZlPBnzxBOPc+rUaYkIqSUsiges9bz7zrt88MEHvPPu2/zwhz/g6rWrMfCfZjyuOHHiGM89+zT/+a/+lP/1r/+Mr3/5GS6e2eT0aolq9qj3t7h+7Qo/f/XXfOfnL/GjX7zCpcu3aGcKN/WEeQN2jne1HAU134c4eS4+fJEHzt+PD4unmnQ4PuC803V45v7bgY+hiF0MVdxzPDIfOz1OJERH1X1x7kbitoROLNKAPr+OkYlWZKVELEx9pvtse9AxkiCxgCS2ENm1kLmtC+sq71Vk/48iRj2kCuYNX/YsTUJhK4WYxSv7JO+iz53YLWa+pIbLQXbWF9za3uPm1i7FeIzWomvpOceECE7Elqx/pR2xH5X8l9wwCAjbbwpUWaKrEl0UccwCUXKTMYJ46qwlODkJxESl93i8QjkqWV1dibGWSiaTFUYjOYpnNpvx0osv8Z3vfId/+Zd/5he//AXT6ZSdnR22tm5x/LgExD996hTj0ZibN2/QWsva2hqTlQkuxrY+fuwYhEBT10wmE4wx3Lx1k/2DA5q6ZmUy4cyp01SmpG1avFcURSWcniqwLvDOO2/zi1/8nI8vf4xWhslkwoULD/Hss1/kz/7kj/mzP/kmv/flL3Hy3Ems8uzNZsxayzvvX+JHL7zE93/yU178xa/44OMr1K1jPpszP9gnNHOMq9F2jg41rp3RziXCwaiseOqpJymKAmubzokvxAm+DA+kv+WF/M0Rdpgy/R3+XuRsh9BnJfl2eLEwk+V3iNKM0VkYke40j0GlOo/59H28soYufiKGLaMllLBzCZ+jG0rktrrDGHQUJSONSGKfSFPZuWkdpUrsXL5qL1C+0Dcmin96sAs8QT6x8oZ3cqgER40t7a8Q0vM+D6KfQqeX6eImx/wH5R4FeTuXEc2FukZOLt2HYZsWP12AEDQUE7YParySQxjji25EQzybK4XhkIB2smophNCHAbeZnCRBCVc0qjCjEWU5wiiDw9O0bYxao8WRLATmsxkEj7MS3RA0zgWOnzzJc889z4WHLjI9mDIaTTh+/ARaa+q65vbWbd597x0+ufpJFxrXuZad3R0mkzEhOI6fOMFsPuP27ZtY23DixDFGo6ojTA9fuAg+UJqCCw8+RFVVXLnyCTvb2+zvHbB18zaXPvqI3Z0d5tM53nqqouLE5jFWV1al45XsMbvv/AM89dTT/Nm3/4xvf/vbfOPrX+fkqePiIKoV+23Ne9eu8cu33uMHL73CP//oJV745eu8//F1pjNLsB47nzPf36Ge7mDnu/jmADffg2aKm+2Bb1F4zp49w4ULF1BaFlyZl/FfOkE1H/QIvb5G4o+rbMy7NCoRHZnwIXPXvkM06A4HvfdypFA02+mgxWABfZ5ZXPFUVtJX9Yxdb2Lv50XaM5ryyedvWNR5pXkYF9J0TJ9wWV2FY30ljU5xsLqyhabEVi+flHSd1kNabfM0ZOlSxRPrlzdE/i4bvmXP5LFwZUKYVJRD/2eAoMCimNUtRVVijMZ7L0pE0mogPV8VpYT2ANnFb6MYF5AAZJ0/Uk/0lRZHQ2UKlEn7w2SlPDxFku5ANtTWdc3u/pQbt7YZjdZ45gtfYm19g0+uXGVlPGY8GtE2LdevX2c+n1MWUn8FoCIBbVtUFBc31tc5ODhge3tb/JROnaIwhrqueeSRRzh9+jTGGC5evMgjjz7C1tYWt27eZDab8fLLP+eHP/oh169fhxBoZjW+afFtzfrqmJMnjnP+gfM888zTfOWrf8A3vv5NvvrVP+CpJ57i9KnTALRNw/7+Pm+/9QYvvfxzvvv9H/Dd7/2Q137zFls7exJ0v23Y39tlf2ebZrYPvsXbmraeUk/35ZjwYCkLRVkYwHPh4kOsrYnurCyrrjcTQcghv094PkiyFHJicDdI5ebzKYTEq90Z8u8+b5B6ZX0QF9D0LiFtiIdEWCsib3f6UJSyZG/aPTQmQYiWNBUVVioqp1IWqXNzhVjfEZ+yQwZcwe+yQz8PyOsWYlCx0eqEoBR1UxOcw2iD0TruyxFTelEYQhCHv5BO1gyhM4mqyA7nykhtNCoqDI1JBw72pSsli4YMdTwsMR49XDeWvWnD62+9z8eXb3L9xja/fuV1bt66xebmOkVhmM5m3Lhxg/lsLv0fhzhEYre6uorSmvX1dZQS614IgclkwtmzZ2mt5cTx4zz+2ONMp1PKsuTiwxfxzvPmm28ym80wWnbeb21ty/E/WrGzdZt6fw83P+DYxoTnnn2Gb33jG/zpn32b55//PU6dOs1oNKG1jrpu2dna4uNLH/PCT17ge9/5Hi/86AUuX7rMdH+fZjZF42nrA5rZLvPpNnvbN5gf7OJtAzGonbOWQGA8GhOiqHLu3Dkef+wxJuNxxNvMoDAkBoP7LGH2+/B9mh/3AtL3w/zvHYRYDJ9+OriXslMane28yOexVgrnnQT5iwc4JliqMzoa+gyJBcn9opjW0eqcWt5DY8Kh4QLiBEoDkbitBCF9FKTM/lbSyN/8+t1CV0+QiIqF6aMhoMCHGFxe4kepeMiic20MhCZxj9IeQQCl5Nwx6xzOOokXrLQEu+vc61Un/ibuUQF4j/cWTei2mLTOMfeBt96/xD9990f84798n1/84hWMKcWPSMHB/h47Ozu0bSujGRGqKAyT8Zj1jQ2894wnE4nSp+D4seNcvHCRzfUNmrrmwQceZDad8tMXXuBXv/wlL7/0c37y4x/z3rvvUpiCxx9/nD//9rf5yu//PmdOnaaZ1di65r4zJ3n68Yt84cmHef7ZJ3n0kQusrKyhdQFa0diGa9eu8fOXXuKFF37Gj3/8E3758i+4cf0mzaymmdXUsynN/ADlW7BzbL2Hne9RT3dw9QG+mRNci45qAqMlhs+8bjhx4gTPP/ccZ8+cwWgRt/ITcZOa4I4QMurthRJ0qBhN3YQ4SMuuQ9ktIURZ2oT9yazflU9vKQMWxDO5X66u+MwwqGIS3zqIAf7kd79/EYing0SicacrfisdmTWGrMA+3dCnYbHBw8YvKyt7GRW+i8/7tOm7xXxSmv798uvzhNQvQSoDRnP91k1ab6mqEQRo6gZXtyifHNJC52ejk5JRG8qipCxL8YKPIl7btFibjqJOopecU+ZJGxVj2NpUp2iZI8aEBtke4nXBQeN458PLvPXuJeaN5/SZMxw7tgkqcPvWTW7fviWsdDROlGVBURScOXuO9fV1bt26xXQ6ZVSW4D1PPfkkTz3xBO+/9x71bM4nV67w4osv8tKLL/Ld73yHF378E957912auubY5iZPPfkEJ06cYHNjg+PHjjGpKp549BH+6Ctf5vkvPsl9p49Tak9pNFVR0raOa9du8OtXfs33v/99fvyjH/H22++wu7NHVUowNm8trm6w8xpbz1C+pjIO5eeEdiqKat+Aq8E10ldKlKvzuib4wCMXH+HhCxdYGVfoLr6PGAcEZ8S0OcTjHoQ0KMSXtZMUPJ2/GKRsDs+TPN/hXCO7X0gbEvHrL0XvkZ/nITja3S4lfp8ZUnXoiWGCfH54L0euJ1BKoZMG6OiO7UGITjQNsuhYGBNIYcNa3AWSPuxoX7BB5/07BWl76nQ4mM24ev16d/LrfF7jGhuPGxJECkgAMR85pzQM2shOd6MTh5QcywrKGNaiMyQgx0dLPG0R/4aaNRU9Xdu2pShKTFWhihGeCucLVteOce7sOTY21gjecu3qVW7duoVS4qymlQTAN8bw0IMPcvz4Ca5+cpWbN29x8+YtjCk4f/48W9tb/OCHP+S73/0u3//+97l8+TLz+Yy6nnchSMqyZGNjnbIsuHLlMhBYX19jbW2VBx+4j5PHNyl0oK0PCK6hbed8+NGHvPDTF/nJCz/j5Zd/xaVLH0vA/M5qJX81CuUctp5j6znBNgQ7J7gZys8xoaUIFhPkyCZBLPmybcXJ8dTpk5RFQVkYUdrHQfGd064g45BI3AnSvEjc671CwimyOSqL3UKybpLn6ckIVhp/2a3/6epwGJZ/mxPH1N6cMUnPEwz7T4c0eyLkCZYTKI/sO/H4IPGFE6UIxMFyHutsF9s5F60WOi3jTpY3739eCEqxvbvLvGmoipL57IC2mROcheDlrEIC3srxziHNps7qAURCVddzQhDOqapKxpPoJhCNKUB23LX4k/j0PkROSQN4nGsoqoJqXFFWsqfMGM3G+hrnzp5mbWWEtS3bO7s0rcVFq4jzHoJiPJpw8eLDeB+4dv0GTdPy61+/wrvvvsdPfvITXnvtdW7cuMErr7zCpUuXCFGUl1jZAWsb1tZWuO++sxw/foyHH77Iww9fpKpKjBExUKuA0YGDgx3efOs3/OAH3+UHP/gBr7zyKjdu3qJuIkFN/lQZ8igUwbfYdk7bTPGuxXuLdy24Fh28XBI5vFsFAwqU58SJDTY3VgDXGRsEhLvpDDP3qOtZhDTZPsu3AssIEZ1EuJwNUNHPTCkWmYcE6TZXPA/m5yJIG0LcmdDN/8E3XV7pq2V1jxCSn9HCw/RRusv9yjORZyF9fC4FhS72jvyVRPl3faWlHSHrxCCkTrZXRd1LKqPz7cjLXyKeLZZx9JW3Z5jHwv2gjKMuAt0JCqYo8aqkGq2As8z3tihCTfA1KE9hNM7WeNcKYUormNYYXUTzZ4O1Nda18UzyGB8p6ovQEtdaFyWmHOGVoq4dAUPQFTae8Kq1wrsa7xtQnlFlOHNyk6889yTf/OrTPPP4eR59+H5OnlzHaM/u7i7bewd4VRIkaAaegtbBI48+weOPP8X16ze4dfM2q+NVrly5wve+9z1+9tMX2dvZpdQGgqcsDd5ZWtuKeHfmDF/84hf5+te+xhOPP87a6iqb8VBE7xxlVTEaV7Su4Z333uaHP/oB3/v+d/jFL1/m2tVPhAi4gImx1J1zPWcUra5yhJDFhxrna4J3qKDBa9l+FEmQdKYYYapqhNEKHRznz57k5Il1Tp8+xngyAhVPbyEIqcviuGvEnD68CLonkGmCR5rWcypRPFxwHuuljTTf8jSJo1HZfEzfEb+JSpQBDqd5Eus0wG/xuJZFI3Zm3Oway00uOF2Z8r0csWWjQ6iIXYlYE/2bEleZG7K6+RLzSaDTJEoQojznukDxKZbQMtYusV/RMSo+MzGKYFEUncUtgVSkF+9CWEJgYhek56kLOqJ3FPR9lf8cQJbbEXkNn3d9tORauI1sMAG0Llhd34RgmO9PUVai3xWVbN9onaVta8DHVUsIkdYS18jhaF2N98JJCbJFUTZE0z5K3O1NIdEctcYTKKsxxXgCxoijmQbvGmxbx8MNDU8/8Qh/+o2v8sdf/zLf/uOv8vxzT7G5sULdzLl6/QZ7szmmHIEpGY1XMUXF2uomzz77PCsrK7zz1jvMDqaURUnTtBLI3geSt4htLcF7RlXJE48/zte+9jX+8i//km9981s8/eRTHD92XEK6xjPrUYrt7W1ef/01fvDDH/Djn/yI1994nes3rktco4h/wpX0q65CEF18tCKu4kG1gHBFRhkKVYEq8UHhgpKY3d1ZbUL8Sw0nj61x37lTnDx1jGokRz0576IFOTkNxvEa/JPadIqPHoEyjmM55Pi4eKVcF56r/JveV0+xWCwMFtUjQL6LpSzMz3zep7IlH5mLQrBCEGda0WWKJU3mr2wn6wwtqQ/S3OkMUvFgR6VEMug7q7eQaWO6zl/IJa9YRi0Z9EXH5B4xDl0HKaGg0efrPwQoPPt7u8zmU1zQBFNBtYIerxAgxoEOnY5Ipb09hcEFT9s2coaVt7LqpGOHUzgXkcazro3imJMjrMejEWUlR06nQyJt26BC4PTJY3zxycc5vrnBrG648skV8K2cqlFOWNs8zng8oSwKJuMxCiiriueel537H77/Ie+/924namotXErb1DRtjdaK++6/j2ef/SJ/+md/wp/+2Z/w7Je+yPkHzrOxuUbA07Q1ppAQtjs727z62it8/4ff50c//hHvf/g+uwf7gtxKyRbKZCXKJkTX8iCrt8v1IUp++8jVGGPQynSOgD129hOkLAomkwmrqyviRJm4g4TucZzir4U63B0GUsan/fwoCPfuHiCwWLAsgkIIeuJwt/z6za4JEsFT0e0EhEuSqS0RIxIRz79JUhRiTeszkn0pPbkhHKp79ra/hHeRtCGFULXxSNukM8o6rG9s/x2LXuefCu686vzbgAJWqwKDR+mC8doG5coGjYNpLadL9KeH9BsLjVF439K0tYgH8fio7lTPSLh7Flih8BQacA3NdJe97ZtoFShLOQsvIQRIRMmHLzzEic0NPrl6lZ//+lWuXLsZD5VUNE5z333neeLRRzi2scLKqODMqWN89Stf5utf+0NsO+dXv3yJ7a1blKVGKc+oKAjOMhpXXHz4If74j7/F3/yX/8zX/uiPePzxx9nc2GB9bY2i0F34Yucs169d5ac/fYF//Kf/wQ9/9EPefvstprNpt6KS40MInR5tOZbISi3EqEdbmWDiZJcOJDxqrm1sbHDy5EnZ3qDoF9pDkRc/CzGir3voZaY0F+Rvz8UMr2UQQjb3fgtQSsSzvKw0p5aWrejGIL3Xut/mkX+TaIBzcjqOcLgCSilM2kgbAmbz0S//nULxjacfjgnyyd2v3PHz+C6tzEQX9khhlepWYclLPladGVoK7Z4nSpmtdKmd3bv0vNOp9H5OPfR5JsjLWAbD55/2vnuWPS5MISFjTUE5GrN54iTXbtxmd1qjyxEHB1Nm9ZymbvDOU5lS9A5adydgON/SREW3DgHT7X7OVhalCLpAFYXoiwqDCYHZ9k22P3mfkoayKtEq0MynEKJrfjFi/cQpHn30MVbHFS/89Kdc/uQ6Dzxwnicef5yt3X1+/dqbGKN49MJ5Hrr/HI9cfIiv/N5zPP/ss6yvTvjJj77Pa6/8ivl8RqEVZWnY3Nzg6aef4utf/xrPP/cl7n/gfo4dO0YVvZbb6HFblhXeOq5+coXXX3udV155lXfffZed3R3q2RyVjlzyHhe8oHsQXZBzojpIoKOVZoFzlw9EvFABrQoKU0azejS4BN9bIuO32hRUZcH586f50rPPcOrUaYyOvjAdJ9XNv27SqihqpFf9JMwmaiASjDjJQfyWOiPFkCClLHIHjcO4t5i2/y0l5SX2f3s4/ATSYxWvRSKY+jiEEHVvCx+hEhGK7U2fJuKT+mwICaeDkgArhAV26XDDF6F/H7LBoCP2PeHx3vcUMwvatKxSCY56E9J3h1aMJV8seXQ0HJHHZwDp2BjaQymUs3zt957jiYfOs2ICBS3BNpRlwcpkHaUqCKbzafDe0TZzXPJ/iSuOSvqJjkBLfX0McBacBdcS2jm0U0osJiKCs5ZCawotejzvPds7O9y8eZOPP/qYsii4+MhjTNZP8N6l67zw81/x0su/hADPPf88X/vaH/HII4+iNbzwwo/55S9/wc7uDsE7zpw5zR//8bf4b//1f+Wv/vLPefaLz3D61CnRwWjhwowpWFuVI62vXb3Gz158kX/4h//BSz9/iavXrtI0DcEHylL0M03TYGPoERvjIqXfKTqgivqF3Ms34WLa0wi6X0jjqk+A9FCp6FUeoNCy8fbM6TNsbGxgdCH7w0LPnQ0neILFZ8tS9I8VxEkjf2XSxtyTDrXbvZC3a5hhD7I2RUJBRksi3OFT6PquJxT5Qp/y7Yj9ABK+LxCi1L4IvY7tcD4qMhcqnhhiNh95/u8AvvHMI12CPnE3dpBNjBzkPrF5vfyXtimEIL4GOTFK36UrsZpd47P3w2/6Bh8e+MW69wO07EopuzKXlXWH++7ZoH9CFKtMUUCA9dV1jm1u4GzN3s4t8bQOGmcDBoNSGmNAaY/zNXUzFWI0CO+7UF+lCMp0BydqpTHBMt+9yd71DzFYyskqikA7n6JCkKD9kxVUtcLq2jqPPfoIo7LgqSef5NHHn+TtDy7z45/+nKvXr7O1tcXNrS3mrWdv1vDeh5f40U9/yksv/4p523LuvvN89Y/+kG9861s88tijbGxuUJRykm2InIf3oLXgwK2bt3jl1Vf48Y9/wttvv8Xe7i5NIwHf2rbt2mmd7MkTdxGxjPkQROSPugxRyIsimTiZpGO8WIG6TZ8yEcqijJNcOCPi+MiiUaC1YTSSPXDPPPMEDz/8EKNKolemrI/iUNQhDOzvFiZn91Z+y9+cM+oSZGmH+Ldwm4HUQnV2tMSVHPnBoVrnj0LGmAznYNeWuDE2fdg/z//EmzhFQv59hBB6S6XWGrP58HN/F4BvLiFGdMpJUUTpLKxIPonFPb5/Lumks9WQlY6QGiqTa7Hii1zA4jcg7LEkj/dZsrxed4JhumH6u913z/KyteqQvTAlk9EYHTzHNtY4d+o4a5MRB3t7zKZ1tMwU8RBWTwiWppnTtnNIOo683NQ3Kq0Q8XQQBUoFyhCY795i7/oldLCEomR1bYKrZ8xnB1jvMaMJqhjTto7V1TWee+45NjeO8da7H/HjF3/BlavXaNqWpnXs7Bzw0cef8MYbb/HWW2+yt7vHo49d5Bvf+Dp/+Id/wOOPPy6xk6L/CgumW9nScu3qNV5++WV+8uOf8OFHH7K3u4tzsg1G2iO44oMTzsen2Mm9pTW5eISgMIUcway1WdBhi56o3xWOimFZUIyrceQ2XEeMZDUXA41SivFkxOnTJ3ns0Yc5d+4MRbG41++zEKPlkN4riMRjAfI2Dcs6jH4Z9NO/z0I+yOdqD4dK7h5JX0erWKZaWSAkHTEa5JNuIw4Q8TXEoIvpPoFKNCD2Ra8zeuZi1xxJLx8ppaPVx4jZOVHeIIHeE+FI3ZHEFMkrel8OQnKmq6tUzIcghE1Fz+L8kvSxg+PP0D3L842Zpr6K13BA0n3/PP9gEYbfLkD2WWK7i7JgZTxCxS0YVXBMSsPpYxucPX0agsU2DVVRURYFIbTU8wPm833RFWmFifv9ggrxkuKUUoTEGQUhWIWCUnnmezvM97axroFCsbY6YVQpcJZROcboCqUrMBW3d6Zc+uQGb7z5Lq+/+S63b29jG/ECNxgJbds0BNfw9BOP8Od/+jX+5Jtf5YFzJ1kdj6i0pioKjFJUhfgTra2s4H3g9u0tfvDDH/G9732Pjz78kL2dXTHh+8glZ0fWKABvZV9exioEQqc3CYBRQuALU2DQYi3zMdY3MrWDDygVY4hHJ82qks2vztuoc/KCY1qjTYHSsLq+wuOPP8IXnn6Cjc31lFtn2k2EQQUvtfHyN7kbyJzozdzds+ibI346ENJp8kHyDFHfSscl9fi8BAvlO08/AVD4uDh1TgBxTiScHXIjAkuedV3vJZxJyi+ZuGOZIS4O/fse/6XNfe461q3zPaKfSylLHd1RvHeYjYef+zuAbz4jCmypkFBToyXcaBH3JMW8hdikCRr/pCr0EzdRveXU8Mj7rCOHRGD4HX2XdLKrwOHV4Kj74XOBxTpxRLrhMxVlX600hS4oKNA+iC+Rkjgua2tjzp4+gXct+/sH4B0KR9vMaJo67uIvUNpExzxB4NZaXABTlFTjUURkybPUCuMd9f42073b4FsaO8PogJvPmM1neG+oJutUq8cYrazjQsHW9j7bO/vMDua0TSsLR1BUWrOxNuHpxx/hL7/9Lb7+1S9z9uQaBS2V0QTrCC7g2pa6biirEaYYsbd/wE9ffJn/39//Pe+8807cHCx+QGmc02orvmwSZVIIiJi8Vdo8mbjrjngVaCURD5RWvUqgW7UTVy4uEknhL9tjRHENXqzqSkPkXrXWrG+s8uQTj/HIwxcZjyuZ9EE2nSI5y/imWZYmbhr4JXeHQTBVCFGajcM0PRz5avAiLVIAy9inT0+MQof/y78dfN3dyBjk70J0VJaxl7wTbUn1ThZ8gCVnAbBQXEBYrLZtaZoW21oJuZDtBD4Khu8TQuYgFUzOVZ8/pA7oFIPxGr7/PEC4O2iahvm8obUaR0WNYh4CrbJo3XJsVfHHX/0if/z7X+D8iRVGtJQ4tIKiKFFFJREcTYnSBehSOCHk5NiAeDireLqpCh7rapxvKTRUpUI1U+Z7tzmYTmmcotUljDfQozVap9jd2WZ/d4fgLGWhcW1DM59RGnji8fP8L//pG/zX//u3+eKTFxkbT6UMI0qa/TlFUBIFwGhW1jbY2p/zj9/9Ef/v//2/870f/Zy9g5q11XVhARDimi6tlRzP7V0XSE4gRK4liGUxqgiKsmA8GjOqRpRl0ZmPk6J1cewkXhQhyGbjsooOeCn/w6AUTEYjTp06yXg86gjREcnvGVK9+vp9fnj2eUE+N+4Eh9uSnmd5LLwLXXtDdGiUrTs557g495XSfTyjkMnSiSo6L0deJ+pWVZUoZu/IVSyCzxq7jBglyDkb2cw3TPE/B4QgPjRNO8PW2+D2UFi8b6Mnr2NSGLSd89Qj9/MX3/wDnn3iAquVotKBQgcKLVypTmfXGU1VVZRViQ+eZi6mf+M9BidhMNoWFSxGBUZaMSp0PBY7oKoJxeomxco6Vhc0rZc9bpUmuAbbTFGhZWNtzB989Xn+H/+3v+b3vvwUo8qjQkuhFZU2FJSYUBIcTCYrtBZef+Mt/j//3/+d7/zkRW7szGA0wRQV09lMxnRg+BAfI4cPFiU7WiJyekJwEh/cWtrW4q2DGP2y81OJuofU14LQDu8lnpJ1TpTgwWO07iINiDFlce1Ok6gqS45tHqOqKplU/4q4t3wy//Ygeea/ky6uNzLJy/7nMji6finP4XMhUmTzPSAbuDM5pls0koUUEGuaAr7+9MVIY3rCRIiIlEx0SbbNdDCJG+j0PZG9ziHEJ8kCQmxkl4dSWarYCA5l00FOz1La/lms4BHQEcOBuHu4xunvHfKKzrRkqbwPVFXJdPcmVz/8OcdWW8qyxNqAokR7OQVhPKpQHsZVwQP3n+OBB+4neMfB/i5NM2cyHrGxvopzlrapozgnk1f0RB6DTJzQNoR2Rmim1Du3qac7mCLggqJlRDE5xpkHHsFR4ZxMXtksGmibOYrAgw88wF//1V/yja//IasrhqbeRQXHeFRhlBx/41pHCBozHvPJzW3+/l++y/d/8iLbezUNBbqY4IKnVDFoWdymoYsSn/Yyxf1MBDkmWjyd5V4ck2VgBD9lu4s2JqrzAcTnihgaRXQ1Mv75xOj0UkqjFbIQRLFR9J8lRhk0cOHiQzz7pWdZW12JC6cS14CYV9KEdGFdB2O+7K6DjnuIup2ujlnuode1dJdPcy3pa5LJv9dJSc0kv5RHt88s5b6EWOTQMQidLkjmfpJ8Qtq7lpVKiEHRYt55GSHVpaNIfZ1SF4maJ34XK+qdx2w8LKb9P372cZyT1UVWMmGrInpIQQuDLU9zTkepxXu6b6JHbYYwi98dzoslXFSfbvGZ6t4dznMIS8u66/3husSnUmL2KgQRX1y9y84nr3L1/VcpC8XpEyfEBF/IFo3gVTQtix/WsWMbYs05ewpXT/nkysfsbt2mUIFxqZmUBZORYWQUpVH4pmFUGkZViQqWZn7AfG+LUB+wMqnYnR+gqwkrx8+yceo+vK7krDprwVoMEkKjLAueeeop/st/+U88cvEibTvHuhlGi/5rNq0hiBFjNp8zay0v/vp1/o9/+g7vX7pCGxReG0w5RhcVOI+yc7xtBHu0WA29J3IwLSo4ZMO9iJchbS+ILH0yYCilMaaM+/WSeKYlAkES71Tc6hFpVchM0irt3VOK1raxjCgBaBP3TCkevPAgTz79BKsrk4ifklka1oT1n4UY9VMmKZeze4ScJL3JAo4tKIOknZESLDweJguxzEUi1BOH4V8QnR5kDoqxa0O2K2MIIk0tckbpV67GzjnRRElCECIqzqfRWueTn5GCb33h0X6jW/JQzRTBd/ybKR+Hc7ZDDK1l9fKLh8GlNPnf/Lsc+nSLz1T37nCeQ1hW1t3vD9cF6HdUq4CPpuoQwBhNmO+y+9GrHDNzZlvXqPdvs742ZjQe4fSIvYOGECS+tTEGhcUox5kTGzz16AWefvIxzp4+TaECB7sSt9nOJV7zdG+beiYna7RNjcZTqMCpzVUePHuSy1c+hmpMtXmK1RPnKMZrtE0gOEuwNfiWMnp1Hz9xjCeefJz9/T1eevlFXnr55/zqV6/y9jvvUbeeEyfPgNI0jWV/NuNffvAj/uG7P2anduhqQm3F/K6LAnygnR8Q7AzvrIiZWkK6pRVd6UDwltY2sn8+7iED8asKQRF8QOtCzk7TosTWSsKFBC3+SyBher21EKNjJr82Ig6bwkRCJ0TOtnKwZVpsTSHHfT988SGeeuJxxuPxgnogjXh6dK/ESI6zXrwEaRdxiuFkXcCx+OUh9ntQ6gAtlySBVPwS6AlRV9Peihg5okOQmIqMiAbikdrdd/19grTpviwLTFFgbdvpDEMImI1Hnvs7Anz9qQtxhenj0oYo5klhPSRC0XXeQkMPT1yVxK6Yyb0Ro+HgpHshet2zrD5y13fQMlhW1t3vD7cJFVBEU6+SQVMY8AETAmG2xfTqm1RhF6Mcu7eus7V1DaMt45FMUhs01nuUbzHaU5qAb+fYZs7GyhoXH3iIpx97lCcffZjHH7nIA2dPs7Ey5uTGOmdOHmN9ZcLxzTUuPHieCw/ex8MXHuLKpUu89+FHnLr/IVY2ThHMiKb1OOsJ3qKin48PgizGFHz88WVee/11rlz9hFu3b3Pjxk0uXf6ES5c/YW8649Tp+5jVNd/5wQ/4xSuvoaoVgioImM5LOjhH285xtkEFCSFholOhONE5QmjxvoXg0FqM9mmnfRyVTjwTzthgTCnnySWfqmRpCx5rrdjbtHivuxi+RbgxiYCgI8vk4jl0KgQ5/SISO2M0jz72CI8//iijUdQZZRAykaOTEdKc7VMt/lqKegk/83uZtN2TIY5FCDESRLzrn3O4LKmqpBm2JcHC886Pq+dyhM7E333KfkEZlkkvbmVPloAk8j7EE2oCKFl8UKAe+PP/ZyDA/+u//mk3cAlCZHmF1ZXMFCwouqWMmPERHZrSpjeJGB1NGCKbnD1XGXGS+C4C0UNJ3iliPaLOa2neg/vMntjlk79fqIOKqQAVxJKlUrQXg6aE1jHCUt96j6u/+Qc2RvuAZj5rMOMxxWiV46fuZ/OBZ2k3nsAyYVyJ7sJ7BwoCGttoXBtbo8Ah/kbyHlrb4LxjOj1ge28PZz0//enP+Jd/+mc8mjPnH8CUYzya1snEBSCdb5ctCFoXFEXZrbLWO1CK8XjMuJKzw+azKe+8/Ta2tcwbi/WyIVppUFG/0LoWYpRJ5WWbhcbj3Bxnp7TNPsE3GHEcJwQJuRuiUjqEgBeKg1IlRVFhigplDDFXwRstUQFn8wNA2pJ0RwIKY0rKyJmFEGjbBmcbaa+pKKsJShsKo/kv/+kv+PM/+xPGo6qTDnLxpDPALHARaXJGtU581n2XT+gQEnZlxK3Xo4QlHEiIehtR/GbPM05i8XksP9P15O/y7/J3sks/4l6WT4iiU5euI1hxfiqFR4h/l19si3BAsR55nl7epWgMKuarULKTQPpFEHRY0QQq+n7IUcoibnWdmRGhnkgtEjWWdN5/FAjkrLIE1dLBorEUBryzeNdgjMO4GWp+m91P3uTS6z9k//IvGNlPKOwWuD2Cn3eB+Qs8Y6OZFJpxoZkYRaXAENDeE5qGYGs0LYVq2du/xa9+/SsaNPc/9BjKjAEtiOFsz+1rhTI6msorimqEKgpc3ODsvBdiYCT2T+MCv/jVK/zqldeYNY69WU3TtuAdhVYUSovHuLfiaAh4JACcqNgN4uAnuBKC1CfhQ1qo5DYReyE8QaV8JCCabBwQIhiUHNMt3HwfM0vwMI2HrNE9xy8clydIe4NnNBoxGo1RA5Gi+37J5L4XSKk/3Vc59F8mQvK7gmH+ywjRYksicRv0yTDVIrck9x19yPRROjrALvUzSp2fTLIpBEhH7UKIO6DFqzWxyHkwtn87+O3R4J5gYfKkXkzDIVOnKDS+tfjWUmoj9hkv3sDtwVVuvvMdbrz1z8xuv4Gtr+PdFO9qgm0JviGEOSE0ECwoifQoTn0SfrbUCudq5vN93nrnTQ7qKRubJ3GqF7eFJZaVSmapBjQ2gEN12y1cCjpG3M0ewz+0bUtd18znNbPZtCs/4UaCxFH0k7bnhBcguoykiJiLkPdlZx4QwhQJDSTXgCDxtjq1ghYxucuHuPqmRVaaryJ3JaKFYrK6wsrKWFb9ARfyWSGhRohXOp/xKFCZ1NBDEPYy7rn7XcGhIcjAd/vURIQTQiLESzicnmgJ5kcpIbbZD2dhvBHOXIKuFabAecEzHZaxiJ1Fotd2L8Qk8QHSaZU+dM9djHudE62lMND2H057xHdw6J10gnREiJ3bl9/7VnTph2X1GeQ/l9ZAPsveBk2IF1HMEoW2w7sa4iQAWRFkJVBAQIUGZXfYvf4Wl978CduXXqW9/SHs30DV24Rml+AOCH6Gt1OcnUd9i3hz4xrm+7tcv3KFN994k9/85g2q8SqrG8ewTsQd6+IWBR8Xlth+70Vsa9uWpm1pY4whQTIxsUMcW2uxrRXlcHIajXmkKx9vmVjCnejOk1pGR9JIPzrn8dYTop9JCHTuISAnmiplYh93nR/1J/0YpnprteRo9fhbDsSMccdVDMsSLWYppnhHoD5niJL1coS6R0h9eGfsTHNq8d3wmczrqKcJyNgcMU/T3M/f5+qZbvw7vMirmL6Jf7MiRMoquvxTTCNNv450kArrZcS0YkX/hfifIioJk04o0yUJ0i1vaAiZrJy9T/fLr759C3mm1SfJtYkoHZFnguHze7nSwKXLB0XwEgIkBCVnjAVHwLK/vyN+LUqjlME7IeBpNRFTdwA7x+9d49a7L3P1Nz9i/9KvmF57k9ntD7Gzm4R2F9/u4upd/HwPOz/Azg9oZ7ts3fyEN157lRd+/AK3buzinMIrTTUZ0bQNs/lcuIMOeaTt3vtF0SbpYnI9YJz0BCiMQcXJbNsmRnSc0zQNTdN0+oaE6BrkbPcYFI4AwS32PyQdgvQF3ZiJjlKQNR2xLDqKEGRsVXaOngJ0UFK/4NFJHA3gXSCQAnhFHI3HsZdFQWE0RWmYrKzEKAuLuJNPoHQrjxZS9U9if0n5cUN3/Ls4x/qVL+U0KCriV2/NRoUueNxQ8kj9ms+RxTk8zJ20PAwfA72OLHTckBDuVG4a55TGCzJnx3lnRsBURCQhSqXDREXH29Xdecz6w8/9HYRu136CDlET4elWvMQ+9xVKtErH8A5K6Yy1y9MtDsmysCKLf4mtyCG5EPTPF/KNRGP4VerQ/v6IOpEU4bH/hu/TfVAiFnTbDWQQC+1RdsrOjY8I0xsUoYnfBMldgkhJXgS0DxQ+oL1D2Zb6YI+929fY377ObPcGzd5N5js3qHdvMd+9xXTrOru3rvHxh2/xmzde46cv/oK9qWO8ehJVTGgV1K7FWUvbNmK1sw5no+I6bsnwPrrpR+/kboxj+3Kim3OYIepapAmxD1MPxO8LXXQOhcFbbDPHtnOCtx12KjJEzUBpQ1FUFEWJOBSl6JbxfeSCUIL0uWtiD1q2zgQJZVOYguAkMoBSCqUN2sjWkvvuO8ezX3iazY21fjGPY0nWD3IT/3STP/5d8mxZuvQ7RKIVIvEbpgHwyziWhfshhg9ey5OuPLXgcCkLkkoqmFxnHC1b8rVAPgWUSuX0dV+cIxFfsicJOmE06wO5FT3gUp3RYVjsmFSN1FAfQndYYGKbiZXsGpkPXNbQZZDS59/17/rB7/I8Iu29wPC74f0QhnULHWKlgXK07SxGWIxexd3Vny5qfKB0UHqF9grtA8o1GHdA2W7D3kfMrrzCrXd/yuVXvsv7P/8n3v7pP/L6j/+BX//g7/nlz77Da6++zPbWDoWeoNUYKAgEfLBoTdxSItyrhJ+VCeq9QqsiKrjFAjNsm4/bNsQRthfFjho5FQlG2uiLErE1hQYRT2v59khCFLcJmFwflRae7u89YOwgjYxRt6+9jw4ArK+tszKZxLHrucFFyLF2gI9d/vFvep7h5qHvM47ojtDV53DKBfw7AuTT5e8XCUgPIefGsmd5exKxGbroyLvsw2E58adNx3MNEncnyh4GGboQcotCVGr5Ra/RpA03MYC/aOuk5MUBWlxh721IDqdJivxl4xRr1eGUeLPI2n23kjqIidM3y6+oYCQGbUeaXOgAzT6Fr1EDfcpi/iHJllmBluDmeHuAslNMmKPbPVSzi59v0xzcYrp7g+3tm0ync6bzltFoglIa2zZY2xBci/JWogSYeKiCMXK2uRErlVZaOA8MzsqWja4KWcemPV/OtUk1SUg736WX5W9EOJNOz4guIhKnSI5bCtENAvIy+q6L7G72SAlnlHG0Kk4AMpFTYLFvuwkVkV/wt18YZCzkSOv1tTVGoyoi0uJ4fapLLAHZXJEyh2kOfRevISQRb/HqUWXxJuaRws1kzENiCBKEJFZlkk16LnnEB90rySfl16ULYpJXSvidvh2H26J1H+8skBa6niOT+iS/92WQTAFBgRK9iHNejleOu627TgwQQrTMJItfRpAS+OCEvY44Jla4nkIeNTDpuVxpbERPcxhkiniU6HTSfc+ULP1+WPZimUsuAgEHKhGjIMpRo6A+YBRqCXLW5ZgPpJTtA7iQLFFCnOUcKonh7JxMZh8sASvxsW3LrLXsTltmtQT7B4fzNd7NcfUMW9fd4FsrG0et9wSlKUxBWY4hyEEAmnTW16JtW86Xd3hnI1cje8pcVIor8RJAq14U10rySxEfvW/j2W9Nh6Td0hA5FUEW+ZOWJ08AJUpO8bYWXFJR3yAfdFl2BFIIu9A1H8SXRZwfhQhLUdLOEDxVWbC5sU5lDCku0p3gEA6kSRm53kRAQpyU6W/8OKZfzGsIiUCk2dNdUR+TELi7j2JR33uLuqBhfcXQJHv0UrKcKHXlx7/DOub1Fk4/HhGVrKl9th2oZNFM1rfUKGQcQiRKUX0x/PwwhBQiMmPjEgUOHVsvfirLGpD+hqTsiu/yjvgskHf07xwWelqIkSis4wF6CggOb2vaeioIsoC4fR4Jrwh9P4pYIwTaWo91ntZ6Wmtp2pa6aZm3cu1P58xri/Ne9l1Fb3B9SF/W9XQkGiYiRyw/Yoaw3lKhkE4LjnqWtpW41CLOJZ3h0SBmX4tzEq0gxOiNi/Vb1GEIKCGu0bIlzJIYSqKthRCEO9LRSCLuJL1Vj6igDin+ehT5VPxN4pIDjMYVaysrjIpSch9W518Bhn0wvL8TSDvulH6RACVuBPqDM9JCcic4an4N8UBwuLey+swlyAc5UMEny6cWvbL3XsbTJPvmXRolK51sdpVNi4c9xFIIT7VAXfv3qROkc6KfSIYseYPT7/xKHTssOJCsaHduw1GQl7vsPoeO/Y2vQ/B4HD5ONknhsPF8+OC9rNa+XzUXVsgBZyYDKEhjnad1gdYFrA/UrWPettStpW4ts9mUtm3Fgc+5mHVfb1mt4ooz8KyPhWfphQCFYCXsSLqCxTtHa8X8HzLfs2WQngviCSdnXYtSvYgnJfYiFKlb4nOlZB+aihFGQ0iEfnGMBZlj27MwFAFB/F5UDH1c7ch1pVaPqzFrKytUpXiKq2yR/NeEfuxl/JMH851AcCi2eThXQhrP/p6o00xzLkTm4kgY4JMo9GPvxHeyYPT45UNm5k8Ha8YDYdPvRACNTvpLCRCokmk/DXKyIAwhFSgbOhNxohM3BIGi4jFD/OEEESocTYVB4VyIV7LO9B2bfieQ34udPrySBWJ4DfPN81u87yHEAVzIJ9UxlaMCQXnhkJATY0H2aCW390Om/CFEESn43m/DeY8LARudEa1PYdQM1ivmdUvTygbRJBJ1jo1xEQhKhPC2bYUtVwpnhdORzaNO9oipgFJyH5zF2xZvZeuEd3KApI6LTK/jSr4ihrIsKYpSlNZdv/nOxQHlYyRHJ37UsY6aaHVN4lNnAIht6DZrqzhOQQhTXGmFM+rHRhFEbETEy/StOO4F0X/hpQmANprV1VU219cptEY5WTBChrMdjgQg9MTwjpcgzaEr5StpBIZcSU5AwhL8O3QlPEw9FELkar2Q/uxdmsPdWHZl9mUMy5OqLaQmdIRT/ibOB8SyqSMtUET9XDRsZVlEFOiNWz6m6ShHijWUnBpTAUMQH4Fkvu/Z/ZReZQOWT/b4dXflY0X+TXa/8Dx7lpAz/5VfOeTfD94cer70flnG3e+QZmgUySQ4WNPIsdXS0enKjwzvkU4mS+Tusst5j42cUesD1iOOjB7mtcUj0Qx9kFnsswPyFGC9JSDe3kDkMHrOVCkojY7hcBHx0lmcFR2Pc61MakRRKUx0L6JpLcdCJ0Ik7gEiogXf4p0coaQi0VPBRgKYnCqT+CULVO+vFs3yHqFOKuFM7O+oOBVTsO4sb+K2IpORGGtbNspKcDoVleNoBVGxv76+zubGBpUuKLpJGvEqx7kODwZ4lOFGhyIL6bMrcmSDHO4A2XzIyhgkkVcd3shpKt0Vy4xJO3wLUdUixCATcdMIR92cGKSkV4wxSwLbye+EFenSSkZW2iyVlzHSUaiSuiY6nMRHHfspynN9JZdBaprgR2+zTp1xCJY86qF/2ZWWEbUhLCDHp4Qj6/dbQeiJUDomB0/b1jTtTDilWKZYICObGge/Y8e9I0QFYJfGB6z1nUhWN/J33lrq1lG3bbRmJvEvq1L80TugyeTw3mPiDlVnpW7GqKjPEd2ORKOMep6hYx2Q/HeIIXBFCyRWr9AtZi1tW2PbWpTvXs67x0ssaukzIRzSd5HL0qaL70TcixbixOjqENun4nHaRgsxSlxSt5BKAV28nA6ntUIVBh3DjaytrbC2usK4LMWxsysqJ4CfHpItILcBfe7Yl7jf7kE4RCvlcfYw/uzQJRExL1QtRG7Kp2icEV9B+tInE6aKY9ENiPSXH7QZ1ZMp4cz6+FKJMOYgtgkhYpIvdDdHT+LUCwFpwlHpUifdgWD9K0Feh8+rHtLVOlqjZEVwTYNralQQriKHTpkXlf2J+IR4ic+PyNHWBdrW01hPYwN1d3nqqHMTpXWMg414ICdrleyAjvdKVjZrLS5yTNZJTCEfT7BtIzck4VtF9JO+isQ0pD1WMQ53JEBCjERcDyHQNokYzXFtLaJeiCJkXL/EaiJWlSQ+pNAgchCBBGyXyRaJSRDuJwDeuo4TC0r63fvYzk4HGUXCbMImfYkx4n+1troWdUYFpSmy9b2Hz0yS7vBhwr9FXIwEYYCny/A1BCG4ics5BFk+ctunSfO7484z1UwnckXmLvmfgagQtEkm+pg+n1dxPOVZogyJcKV84limb7P8lVI9Z5QSee/FjT6zEiXlo/DO6ZLicsTtJlfX2YKk3hOPP8krdkTHpzSDgcm/XXg+9OUYXAnSCps6KbGx6UrIH1s6uE8sb563Al+gXIW2JcaVFL7AWGBaYxqHGuoAEN1QcEJ1ggsEJ/ok58BZaBqY1Z7Z3DKvLfMmMGthv/Hc2p9zY3efeevxQRMIoiS2NfgGbIOf17SzGS5FNoy6FKXAlIVwAASJ093Ucnpr2+Ba0REFH88Wi3oYySP5/MDwLXsAAI1pSURBVBQEXaDLEaocS0yjzos3jr1tKXxLGVpMEJ+npOehE+tjvml8kq+HMShTgJGooCgkbEoaNS/mZO8kvrVKYlwkXsrojvMhEh8V66c6XUY8UaWs2FhbY30yYVSWrExWmIwnciACSvrBx3Ee4F76m66EG6KpWcQ/4TQO42T62+fV4z3xT7fhNOJhNxMVUq/kuhJkkZANztnJPSnPQZ2EShyugxC3oXCX3ksfpifS94kaxJZnZYQg9XWRu+poRBQlc11T2hqyYE2TDMg6NGUixKd7HhVXKu77STFjlnlVhpA7TS6+Sz0f+1+u2Fl9h8SUSwaxTxW/7seyu4aQ5GkpSywA6Vn3PLGrgysvWgVQzqBcgfYFhTMUXhFmDbRWjigaVEAQTn6IUlvEClHiK6xVtC00TaBtA40NzBvHtPHs14Hd2rFft7QgERADOBwutGBrgmvAOrRF9milCakVKI8pFNrIb3FLkPPKkrVUuImkZFaiZtYFVTmiqkYyUXWBVyksSCaCRouV9y06EqIiOEzaeBsiIi8MTjJoyBYNpUswhRAkLYQufULo10ClZKOnLKAKFzymKOKY9voJrYUHcy7Gv47WMqUUVSlm/VJrvBX9U1mUlEbOgpM9bgG9KK32cAjXZLDTkHdNjAQhx50cl+W3IEaqf+jwLZ/YWVlpjqS8I+VWURwVsTcL+ZPcIvJ6JejplpTbMRSLC6mKopXQfiEeklckLrFOeeaJOezb03NjKV+iPso5Jx7YZARhAQ49EFBai3MfAedarG0hZkpiH7P0R2Tz7whiR2WK5bvCoSQe5Szz6S4EK4rYTH6OkpwQoaBwMdqd9R7nAtZFhXUU0awPtM6LT9Gs4WDeUreO1hPPA1Fx/5VYJtsUTUEZdFGh45lg2ghSQoiHEB7mblW+rzA6FaaFpixLyrKiLEtMESMnJr1XyHzLkv7LWwmw302RHikVLIpgSoiR0QXGlLIxVsmZZsoYOawyaY8ys7TONsqmxSQ9814ssyoq2MuoXBcHyuTkGSiLgtWVFRRytJRzFkOg0lBqKLQQdOkjJfFu7xG6sU5X6gAWCVH/jH6hX4ZaS0D6cHnKRHATse4G4K6wPL8h5Nl1X2Tj2ksai647nQUutl1ped40TdT9ZRnfK4RoPhQxrmezQDpVSaLBVwIJiYYTPhf3hu/uBIKQ2TeD73uuZvkFkUDEThKlcs8RJq6Q2LYub9Vp3OJ7jwo19WwPFzyhONyzISJRkpusc50fkRAiL0TIg/VgXaBuPbN5y7xpaaxHNv9rvDL4pLdRmtaLG0AiRsoUcu6a0nKaBkR9kgcsICKZj9ElRYFsulCxKtv0TOxHhcIUWkT4GLRNLgkIF2wLPjsZNvaZlB17MRKhfhOsiVchivGAiBu63wKrcgVodI7z3tM0NT4ep+ViJMtEJBPROsoyXJRCpNoUNtd7jPKUWq5C0fseRe4ox5ejIHTYEiHNi0PoEHr8Emr0W0OaCy4qoO2C5fYwPh8FS+dIJPRd2zMCSmrmgAinsU5+REE+6vNN1QhgnYvxjLK6JT+BVEKisEPIB1gpqUValYZpUn7BxxUmXqJHGq44cXXInKdC0vYPOqbv6HT1PHXekcsgdKwn3eCJp6pwLCn/Rba1J5hCUKI1UXkCVojRdJsQPOVoJGrlzrQv9fHBM28s86bFRh+rxjrmrRM9UeNpHbhgsF7TtEKgZnXLrGlxQdE4j3Xgg+hxVFGhdClEqChF5DFy8KMPirqx2LpmPjugqad42+BdQ/Ct7KR3HoJCY1AxlpBwKDkS9ZhTaHEJUMHLPjjnUM7i2hod2QJnbeSiUo+LM6NWhYhjquiU4ZhCuCGtgbT9I+Ff1IFE8UzHv0QrpA5CYGU8JR52iH5IgpdxMVLEZTLinZe80/jbtgbbYGyN8S1F4h5DoNckxoWr0yVGbclApMnFkOFimHAvpEmZEcs093Ss9+L3Sk53ESsCYUG94EVETt9027bE4zlZxBIcrotc+TzPn6koFvvFDYELc73jwtKrVEakSmpBZbD4nTFGfN4W3nxKyBtCxiGFqHNZBvk3oRuMYWflSrT4LN6nTky/F+oAnWVqmKYfuCGnJAPpbFTYyzosnZhdeRkiMqtYq0icgiXYGdg5rWs4mNdLmcOUj0te1Y1lOm84mNXMm2S6d9GK5qnj3zYGTPORwKALdFFRjsaMRhOq0ZhiNMYUFWjRufgY0E3h0UbhbUtbz2maGa5tOv2Q93F/EdGTXvdKUKWIm1+R/vHSITqe+qqCB+/wTY23LVq2Xi/0l+STkDUqq5URZbiRdpiyv3xQMdi+6H58DAbnXVREa01RGIqiNxMrHQhpK0gqV4lzoxBU0Q/KOyFLwTmaOinxW+x8im+m4FqMEp1RUP03iSsIYYid9w4pLyE2Pec+hIR6yyD1bXIuDDlOd8QtdLic0gzHRDJL5fTPu3wyiSF3qk0kIx/n9G8omaSWJEIXokht4kkuyTlYGyOc0VEQskm4LF33LuNe+uc95R5Cnp9UKA24rFa95+29Q0i6qq5Ovcl8mS4o5J2eVgDEZ2UIib3s2ydcYOgsBeI/00x3ce0U7yx1Wx9CJiG6CTnECbK1QnzqJvoRNWnLh+xBS/fOB/Hxic6HzntCdOwrKgkwb0wlxKSQ8CAQ94k5j7dyXpmIVC2ta3HBg9YErfBKCIVWUWFdlhACbYwEKX0XRByNrgMSJt+DtzgrljMVPM5alNbYVrijbnVFRwdPEVMLU8QDGhOFl1XSaIkqaa3FxthM8tvRNA11XS81lsCiKZ+OW5ejsiXgWy/yiT+XbKUheU75FhX7KOnVUikeCV7320IICaf6+g8XyyHkZnZpd/TZ0f2Bi4cQ7l5hSXkJQtzWkeZIIu4dYU9oEZtzdE49KDK1TjfvxXWjA+9dt19FOuResr4T3P37jngMOuQwSTgMidrmcPcSe8gHPucGloLMlQj9apBQUxHY392ime5JGPpM55FDl4dSMhGVTGkbFI11NE525jetwzaBpoXa+hifWriAEJDNs01Da2W7hzGawoioowPivNiKTsfbFteKklZFZTVK5PQQAkaXGC3bOUTXIHn6IOJNqrMKSDyEeBpt8nHybS2hS4hhZJ3gkPOyDUXGqV8ZJd8YbD9orEfaa0UhnraZeO9pGjkWXBBejiHKFdLLcAB6BLJtS4DoJV7IVIjVURp0aSiqElOUlKMxhSlx1jE7mOKdeIynk0c+DW79ziGqUMSr+Yg+6KDv++RcS5o/d/s0hu0VrnR5WYlDuiNRi3NcRVcLZ51wuGUpz5xPMbCFk0kfuCWb9RL3s5R4qJCZi5OXbVKU+Ri8P+5wD3EPV7yUHsqq0lHDlaIrP+dklGxT0EEu5YW7OayHoqtTXn9pg0ZrseTkMq/k0XMiXQ4KXORqemOGITjFdH8fQ8vYB0YWkn/NoT5T4mNE62jnDQfTOQfzhsYH2iC+JLYNtI2GMAEmeAoJiRKgNNFJT8nK72wM8RE83re0tiY0NdganI3bMxzeWinXa9mMqk3U2Yhvji4MQREte9GxMnKqGo1RYDy08zn1bIqtG5r5HBu3lygv3IVAoKj6448AvFLosmIyWaUox2K+16Iz0lHX5YOisRYXAkUpFkGFEt8hJeKVib5CZCtrVwaRYOkUY1lGzwdRIifCqKIIZ4whFBq9MkGPVihGG4xXNpmsrkf6Fwje0TYN4HEc3lya+wOl2oQgHNXh8Y9zzQ/VBYN0PqCyK+VJJCLKh85fTRNdOYTtjI6lYjmU3ushhEVuR+o5wM8MfJCdl6KqCrJn0rsFv6IECqmD8r67ktiWc3uBAb2IFgKdlglZXeOhexn1jF9/Rvh0H/aDMVCUZRAQljXcwaLxaSARtWUUv4fFdyF+FxC9ApEbqOf7yGFnotDVd2iHCoFgPTZ6WM+tZ2Z93PJhaVzAOoP1osj2XqT/QmuMUhLDuSjQSkuco2bW6YJcO4tXLcdM+yBe0F7ONA+A1gVlKWKdjlyanLBaxG0WEq61MHIEtFIx7hEehQPvcLbGtS3BtQQrnFGCMFSIdr8gKCWrLBJTSaaLbNcwZTzDzYvJPfgQ04qCV0Xx32ZxsBKI6CxHdhuj5ay4SLCttTgbOkKkou5JmwKtC1H4mwqKMUU1EYJpqjihNWbZ+vYZYMl8/9SQLJyJgUj9LMStV3mkNM5GnWgImMJQlCU+eOp5jW3T3sWMGEZCmfIzWlNVFSFA3YiIvACRwA2ne+jCl0Rik0R2otielae0ioGCh7lEGFYsp27d++xa/vzwhEwczqeFEDs3iZN5ucO6HL58XJEO1+fTQF6eCw7rHc41ODennu7j4l4sGwYDFr9JrK4LgdoH2gDWBxoLdQPzVlM7TeOg9p42eGxw2CAbXY2Ss9nwsrFQBSEMwVu8rfF23oll3kZrWXAxuD1R5yHcTmEMVRUjQAYhVICILGVFUVZZ4P4g/kUurnZOHCaV8rhOv+Kjj9FhEVqlSRQXvyhndJzKkSJy/jiO5ZBrPwq0lmByOu1h6yiKWEFV2hdnZDOtLgy6KinHY8Yrq6yurcqps0U8my3pyLojhD4/GOLrEIbP0mRO73ocT32f7g/nNYQ7pRHXEHH16PSPqY7xs8V6H50XyBgeBZ1iQ7wgJSBWWjVCJrIlOKqzjoLUSQkWRK8lV/ZlT0CSC3kIXVtCWGJqjDDMM12JNc0j0x0FC/UJmZI+lR2CnF0YvJxv5mbi7OgDLrTiEDgYmKi6JoSAU9B4R+08tVPUDmY2UDtD4wpqr2iCpwmOJnhs8CJm6Oh97ANE72YDkSBJ+A/v5gRfy3lrA1D0Do6yTUdEHx+jbvoYBVB2vPdOkCESX+csrm2wTk5C0XjZ8Y94X8uuhLvjh3CjRIIUHwbkCCUrOFhVlbgHpPGAweK2SBRSfa0VEbMsS3RhKMYVxajPK09vIkeYdIbaaIqqohqNWFtdZ1RUFJEjXQYdfmUi+RC/+3ReGvkZIS3EyQLVld2VLzQ9EaFUtoqncYS4d7BpGkBRVlVn1RpCcjEwRuhA0zQEiFxnOp9OoG+bgIytELG0DzCEgG3tgiI+h+DFOnsktQpxwktlZSXJ3w0h74B0n6CX8YW4ECsw5JDyPBbz6wczraYhLJYRkiy8RFczfJZgwbeD6MuRKTqG6UOIK0Lcl4NSVGPD3t5NXDOT01WjHsE5G3VOcpXlqDtnLQRogP22ZWs6ZWtasz217M0900axP3fsHMyYNjWtF7LmItubXDUMme7AiRNi4ohAQjSoGBa2A6VENFHC8aSNuUrJloygTYyhBD76hckkkMBrwTfE4x9p6ll0h+ivEER8kn4SfzLhiGQyex865WWnhNZF9J0RPEvgo2jR3UfFuA6ICBy5QxNxQnRbvVuGiiKBOBkZQlAxiqY4OVrrqKpKRBDpMXGHkJZQFiWb6xJixNUNWvX+6y4uNj52bYghfhcX2X4xDVFPlC7R/x3G4QTLvu+fy5XmZh8+ZgneD/Ie6oeTD9IwbSKosrm6j0CxwKrKlCF0rjwhJsvSJIjtzMuQMUvHFnXxjKKvRqY76RLGEmVQIwE51MCjoeuUmKrvpN703w1S7FiJXLg4ibTqVXGKtOlR6pPk0rtxXcOLIaeW1THlkaBL78TrXAhSdIF3Da7ZRwUr1qYY59vH01yH4EPABWisZ9pYuWrH/syye2DZ3pftH4kzskSrVvxeKVHTS4zqRrgh2+CthP9Q3smEPYJDSWfbm3giK1H/FUIQDYkuopwvOOB9EAMEcqw0ytPamrIyNM0sEiAJpHYvEOiPrhZ75CLyaoIQ9RCVs4jOS4iQiA7LQQnh17LrMuFw20rUyxTCwhjRi7ZNCqcbJ2RcYFKvBR8ojWF1ssKorBZKSpDjLh1+Z8Qn4dGhoTj04K6wgL+RE7ob5LhOnDsgnHDbNp0uiXwuRe4rxac3sc/CcP9ppitSkYYIQRoQ4TtUNH+nExIuA61iAK0YUjbEFX9xLSSjmneAe0iS0qQOA9mmEAK0VkSfJL+GjogMG56uPtsc8raG6OyXjlrukOcule2yiHK7tXOa5gAQYhSUiFQ+7loOcXGOzrPd78ZZ5m3LrLYczBshRtOWnWnNQdPQBEcbfDwXPkOqtLomVt0n9l3iEaV0SonHsgxyJAJxDEPcAY6Ok1fYKFkAgnBEaemTRSFIXKLgaG2NwqJwOB/1RR0hGhCkrN1aZ4tbWuziyqi6Y28ywpTiindUWJwe5RCEoyHN/WThyhe15BZgnWPe1DRtPEopfRsZK6JrgneeyhSsjlcOWaYSJJzJJ193dZzQ4hUyTiG/IskXziuI9eoQiQ8yfh23tARfczw/CoatGeJnUKrDlS6/JR0gYxINCGmxjRFL/R3qkfePLLBH6A5DiDbRiKiCz8szDinjWPCyjuhZuaMhhKhVj4pG7320msheI0nTbzlJZeby873CEAm8S7J4xpIOOibkGzKD9EYgoF0L9QztxXqDV3iX2HCJrJhDEh1SwP0mOj42LtA4x6y1zKyjSdtIfFyvU11DMotKPRVi0k1mXhA9gfdyQor30dISledaF3hUPAZblOrGFBRFJccXeTGPJ4KntHhap9jYrplRGYVrJW7TckIkfRcCBK8IweCCJmgTN8EuJOtuVDc2Ms5pgndjrrItRwucWCwPKTQlCd5TxKOUnYtGAKPxLlA3La1zWB86kSmZx/FiJRXc8oyKgiooKhcwzkdze38tot4QD+MMT/0hlew+z3Pq2rmEUIWQqxsk3VF6U2Ie6W/6DcJZ6qjQT06MQxB9kVhafSQqgjtxHmbcoOokKLoGyPoVCbET/FWqH9tEhMQQJWOqE4IPL2IjJB5zitSyvJOSSbX7Pcgn5SUV6kVBBriYnh/KO7t3TixpQtj6/BMsfBsWyeew7GX1VIkDzPa+5dB9QxBdjncUPmCaJu6TUnIMkJNtDKkNKXIekVBoralMiVEminMBVSi80QSjcEoIiAxS1A2F0MVyTqSwu7KJqbq9RNJX1ntIR5Hr6J2tUvhgMa+HjhNC/iqJl+SdxbUxLnbTYOs5lYbQzgjeopTobUQiFKEq9bNXYn8KviBQElSFLidUkwnKGFQM/xo7RfanKdENta34RiUfKomrFfWCXoix7sZTxz1xMimUNuhObIh763L8QghTU9cEFfBKSzSExuPqFlu3tI0jhN4crZXmWFkxtgGaBts2hODxMd7XoqyQcEbqFocx6iLlEqIU4xNl9E8maj+WCX8SHqYtV8KMSD7LoMPbiB59v8nDruzkI9V916s7lBLClc+BkBqTQVc3oTaI9i2gkzEjO5ABcu7R9yQsCFYe4gASpA/6Kw7rILmOrH6Imw6T1SoHyWvxmYr/ydSO/0LkBvIGZt+HjtPozeTLIBA5ibTZNXbwnUDyi9HsogjnvI86k/4ioVueX5rMSjylxd9L4bzkIZdsXFRaU5Ylk9GI1ckKK+MJZVEI4YnN6dFW/FxkmqVxkFjbPXfU1yP1h2zOFU5ACebG1dDEQpJLXNTKBAl12ymzFRCJkW1qbC0RLG09I1jZpX9IJOsgcQJCmIMqQJUoU4mSPEsZ6JiGrs3yVAiQ3PaTPF+lh2OvgvRW2uironXMOSccrNFygEQcK+csbTPHu0ac9DpBNk4wFQO2Rb+lcTViUlUU2lBEFwsVgqBBEKtkVpuuNTl08+DOqNinE4rQtVdnYVRUZt4/9F1Ci1gFcYjtIwSESKBC5h8UugVcHsgCKl70Xd6ZHmxYtuBZlAYi4VORw0oLMYqe283wNYSQdu3fpWcSJJly8DhNUsG/OxO3HFIH2bT3yMohgT5yWocKirBIoOTZMO+c4+u5nIHu5RAcftfvPxtwfIG0PwJHQatKvJagYwkRQ5T5hbuUmEUuDqYxhtFozMrKmJXJiFFpMHjZShJJRQwKsHhlSCPtyvordpgPqc5CYLXR6BhYTZBYCJAQIRHnnBPkC16scLIrP8jWDid7znSQrSDeiQfukdBxABJGNokDncIc5H0iemmyxX+9ejo2uvtCVms98Nrv3sd8nLPdvrt8AepwJfZhPZtysLtFvb9DO9+XeN1EPCeOXcxHlQXFZEw5GVNVJaUxaB89jkO6pLpBCuhxJRW6BIaomOtsch1Ojnvd1VGcQR457keFtFISnyrQi0bD/Byi35QFFRwSb+tubcghEUyl5DDPNPcWxyubv9lTnb0aXAILT6WX+68HDSdDiJSsIxyZwjW+6ahl+qavcNZJA6KU0oUgYkjuANfXIwjlX+jsrPP77BYgTe4QQ2wmyL/tKhNEp6CUhmIMo1UsBhsUSsmR0iGIedx78Hl4WQd4T2U047JgZVQxrgoKo5CY+SFyAz1IdfpVMj1TWoiP1DGNkYB4TtOZ9ztFccpPBjVuJI46GqSvpLIWFfVQRgUKoynjrv6edCTCk12pYkiAOQmWFi+lxVAWEveWVurUBulrqWOqZM8ZqXgAxCJyE3fKBZroowRI6F1Cf6afUuJTpGRDdDOfsb+9Rb2/i60PcLYlEPBKEWKdg9YQ97BRGqqVMSsrK4yrEUbJgtGjRGI5Yh/GOieikY+N1DmfN8KtSX9maRKhiBZj50TyEFzt8TtPK+Mo+ae8Q+h33i/OtXzepAcyF7p0WfsOpe1AFt0UXUEn1404V1PkzTSmHQOTzUctnTREhsNUUz7K73PCsgghKyh/ll8q6jXICMxC2n6Mu2/y3x23MxiQJJP2Xx+GvB75s2Xv5Hd6n78L8Xwuha4mTDZP4nSJC0B2ln2a1xJXPMvfCRc0KmBSFUxGJaPCUGqFUVFc6DgMBFEjJ6FUNILpxSgD6bQMYwxFkfZmBRFNogldcFXqAj23JUQkjp21BBuDp/lW9rd18bHF0bIX8vqFRK4+4NvweXL49/FAgqT/Cz5GQPAumtodRivZgxZi2JLQc0kL/ZjGKQlY0sAuxGyaDKAwpWyIVVpRGk0zm3Lz6hUOtm9C3D7TOuEOtNGYqqSoSiFEhcYXmmI8ZnNzk+PHjrEyGnfiGhnOSnC5VL80l+Rlqq9UNRGq2AIl49A9ydqYX7L4SN4LeXXv5Z2oFw7P5y59913yU4p5Zcam0HFSHaIcqo+K3S4LW0YnEDFTqQy3YmRQonqnw1EhRouU+J5g0LCcmCxrNPRK2/zZkGDlMMxn+G7xgVyHnkcYErsc8nLS5yFD9u7BAsRBUEJo2qCZrB9nNFmLoo/GB1EQy+fLTJwBgqc0hnEiRlUh4U4JnTZHRYfMvP4qxhgi9qGIYkYIkYqe00rFlSmGmPDCbIXQ93s3Np2VLe7BCvnZZy3OtTjb9Kd9HNIVxQEgLsmRQwqkQHq9Dintc3PWCgJG0SF95b1DKyiNhBHByyRIJ7CEiEt93bN+IcVjEoWzbOHQXeRJ0eFFy41STPf3+ODdt7l+5SNmeztyqol3wocln6NMVPJG4QuFLgpWRmPWxmPGZYWJEy0ijrQm1jWNepqg8jAQovJWRXE+La6J0MSPFjPpHmZ3C/i7eLGweB7+JtUj/ybNlRCEsCTVSUjm9467yfLr/s/f5+qRmH8nefTlJE4wBMEWwZMlIP2WNSRN0oye3wmWNrJTmsXrM4J05vDpnWARaUPSu2RXiKJKTmzlGvRDBI2ENW0dlJN1JuvHUGWFjbaD5FeT8skhBLEaFQpGhWZSFqxUhYhrWjaEaqVEFFiovVAjpRDLmo/KfBJi9b5TEoBME/DxuOqI6EHSyzfyXeK2CqMoCiUag+hQGeKBjhJOI1K1DBb7StqpkDoKyGrfpYnKZKJorGTZJMSjjomTM30vuNN/rxBDyXBSEFfbFOcnvU89L1ZLcVo1RlM3cy5/fInLH33I9q3r1LN9vGslygSL+tGOSY14bJSmKktWJhL7Satex5c+6tVd/djn/ZQmd/58YfIO+jSlWwrdAiq3ed/keQzzE0iEQaBLE8MRm+RnmHFlOYQg9ECpuPVESWcJByyELElBSfkeMss4sWs7nVHqw5AGQUnBSYfSvc07Kevkbqy6J0IsQi5SZd/6zHfoTpDq1P/ob0RR2x+pJP3fdalc8Xk/OEnfEGTyLtQLeZa1q4N4BHWGlZCIUQi0qmBy7Cy+XKHVDm+yIzriit+Vk4unIVApxYrRrBSm8zCWVb3vzdSe1O/xTsQmfPTGlr2FIVqGnI2nwuo4wsHHLR0Zm5SJtdKqgA4OvHBFEoIkKrCViGcdcemuRNrEIz21DUQ8zK2eoueIHAxIHSKBkfZFouHEtN41vUsqiuUQpFyxzvUEX6VJIZKB1CW+Txl5lIjT2nB7Z5t333uHa1c+Yr53G1qJ9GhtG48Xl690AG2hsIB1tLbFFJqiKhhNCopCgoMlzEjt6ufL4tFfPfS9KHWMkzviSP6+64glILgwnIN3gJhVYhKE+47zMch/ISQn0XhGXdpuldODhI1BRLKuBvG1tKOfB0TCl4OMmYqe9iF5ASS/h7hBNsiqKxWTSoguI3ZcHGDFosUHesRJSsqkdEvgnY+TJHZ+ynMJdO8HdQlxIvmOgGQDli1Tkk6eS0dKZ0o+eZmDpS1/EyeJNFn4dpEi5G8bYLRxGrN2El9ovLYLHKdMsOw0DSScgwJKYKw1Y6MZpR3iOk77OI7SB1J3GS+pRlrRpF5BtqPQW8K8k0BoMiBCtOS46dTncfaiUBqMUfhgcXYeCVe0piGcGtEzOElQon/OiBGpb4Tol1UpO+cjQQqyfArupt30sXzR/0Xfk7hyLtNlCHcj+93SeWF9mg4thdtFLJeSpRwJDgihUYadgxkffnSJD997h1vXLlMfbBFc0xHtEL2hvbWEusXPG2zdijNuLLosNGUpDoLZdIwVingm/GkkRAmPe1wGUc4n3OvxtZ8b+TOxOgvRSgs9adEdTPYEOa7nWB46yaAvQyVnx0wv20NP/EPo6UFqd5rzSon+MpVBEvP63pHcYn3jKC6+DEHkO7KE+TuhpPJpUkQmnUjiOgR1su+6/+J96H0Wchje3xHytIcGbDCQPlohsiDluXPZEBa+za6cw+tRL7Z1tMbGmQcpxutY67t+7b/tvbx9kBM6jVaUWjEqNeNCM6kKRqWJQe8Xh02GIuZJEAKCKKUh29UR+9a7/uhsEGKUK4+6vL2ce+Zsi7UNzjYEZ6HbHGuFY1Kx5G5lFBDv5dQXkWvyog+SUCQpKuMilyTfysRKcaiFFcnqL82ETkzoxZt8PGSF12ngCXGyE73m5b1EfCyKEm1KXNA0XnFze5ffvPU2H37wPrvbW7hmjlEeFVqxbHrPdHaAdQ0utAQVF+kQqExFpSrGxbjz9Bbo9VoLIFNjAVTmm5MIjPRz3sc5HmbzLrl1LCkqhy6vOC/SB9KnyToneflo/VJRjM7rIf04pAkswfXezygRx1TWUZUVx9lhp8XMF7Tdg4mfINUrcShJpswbHFMcyidEpFvI+wgIsdhkzsy5LGKnCWsfy4mDmq7U2fnVpR1eCzkPWrFAkOSlCkJ4nBmzeuI8o5WT+FB2Z20Jcgk3mK7g+5VCa0VphCBNKs1KJYQpnZoahR0hPnFwB+gw6F8fldBONrCmKJteYh8JOxO9ZFUQy5WSGEVNLVal4FohSDiUCvjO0bJrdBQ5YplBRS9uWQ2rUYUxhRSlxN8oEaMkRyWkTosEkdv10bOdiF9ypVHoT/4IIREs6UvxTlYde57SJY/9PqRFDBtSVARTMWs9l6/d4sOPL7O7s838YI/mYI/QziliILnZ9IBPrn3MvJ2ijAQjDB6MMhRmRFWMqIqym8SHIC2Oh7BLQJyF4wbVzl3lcNr03Bgjge9MduJGIjTDOZbuO0KUljEhFjq6OiRJhVy305W5HCLmxXkh3D/x+yQep0W/r0s29hmxMysPffHvUPD1px9aLGIJBeyVbZKxUjHIudKE6Fy12H8pj36SS1UixUydMdAdDcvtJ1tq+IBaL0k7HEgV2zPMW0zOPQSkganjhvVdgNQGRC/lvabQBuPnHGzdlPPu42ZL7yWnhCshIA6QXhEccpCjlfjTbTxPzfuo28gIZIiiTnwcWVsRjTr9THyEEstc1oo4sXvioLUcnmc06GAJdo5r53LWdpBQIaggp896CSnciYfJPSPoGLxNYbRwHtVojFIaFyLHkrHnKi50opxPk0JaKARUyhFCmQ73S5MsxX0WziiEKMfGftFKoYymLGNokLg7HyV6qtQPWmtGZcnOzjZ7u9t4Z9FKc/L4CSaTMVrBuKowSjzylfdcfv99bl2/wfHN43KCrVZgTPRFkiOzQ6fiEFFWcCiOXmpH+vn/b+9Pnyw5jgRP8GeHu78zrsyMPJHgTYKc3p2W7mmySnpkZETmP9h/iP/Xfl3ZlRnp6e2jWMUuskiQBEEAiTwj4h3ubmbzQVXd/b2ITIDVvSP7YTThiOeXuR2qaqpqaqqC1WRVTXOWVVfbIW/jLjipLyjYquQAw7eMeYxMyJ47ZoX2vDyk3XsEZbDDHeO/jpcQpZYtE/+AG6oNDEv5yvQMTBKT1U+nzIg7mJEaPO4i4ul5wQxbuveqHDIaK886SI6RK5v1vZRRSrJOPHxXfps4cviM2B/kh/kGj11v9pcD0HoORrvh+oQRHY+OO5RICjojgRBkDvhcqGNmc/0W125xWUJUmL3JDrF9yOtFw8GmLLGnu2ybZiWbhu3cHlZ3bClZe9Ipk6HIoAqSOe0vcYp0yEqHxbQ2Jc0hah2ll6wY/ZbctxodUloph4RGQXOT+aCTUHGa60wYkvMR54P486ibgdh13DjuxhQxm5j0deo1eqTGS/KOYTVRmFRRp4dxFAY81EteQ+aGEIkhUkqRjMeuEILD+0CM4m9Uz2bsthvevX2Dd46+a9ncXHO6XnFxsqaJUQL6O89sNmM1m/Pm5RvarmW2XFLNZxI/vBJpa17PxEZSyhBDXLFVh0K8tI0GQMZGbGDKDYxpHjAW67nx3H7LMf19N33IC6MGkVPSSUVvDWqi+RypZuTVsfMWTBiZoYhuOXIaAHCIhWR2ZaU3UwudCjM2hu9hRkjJ0xlw2riizEo7AdXLLbwHQrcDEg+vCSZKM9Qy67zDYWqUrNxZB1v5x8ztro6eMkj57vjLaTumMJ4fln0XFLTN9sxAAEU1sUAokboE6Hqq2pFzS3f9Cl86Ui8D0vedqLOKLJYEQNRIcUsuRZI2tsnTZq+MKJv/sRqGRgQw252StkpG8oD0odi2zCjuncV9VoLVcKq5b+naG3K/V4loYlOycXS2+XGsg0hEst/M+4ivjAkJgYpaZkxL62kLC2aQz1mjTPYT9VHHzRjVJJqCjKfV7XBMgrfIjRaDB/o+Sd0DRC8qZN3MefjwET/8wQ8oKXH97i30Hf1+Q2p3zBvxjE9ZtvGEWLNenbFenbBPiexgtVzijMlRyH2iqiKxlthHvQU9s8lDhTiDMuxalzYKIQc1eB/C4TQoMEzeMKGb4zdHKCDROgeDtwUVlMnRwCQVM2rf9e0pjSmBKDOSiUYiPKh7StQFGRUYTDWbqoIAYf78Z7+kwN988mz4gHScVmFiMzpsrBJkkZUbrwZKoxJDFnlezqerS4eNGf185Hl7eYpr9vJhh99mUPK9EfT3UTnje/L7kJkJDGXqX+nzsezsRBR3eEIJVHhSv6fUHhczm5d/IeS9RnyUnF/STinL+wDFkFJWVbKu9LTZs08acRHdU+dGohua5bw2zkQNmWHFTKVyxBDHeLTb+CDbImTlTVbPuv2GlPaD9/Ihc5eYRSJVqZ0ny/edjzgXCFVNDJXuRYvgvO7Fg8IY0U+ITSRpE9VL0VU+bIHEPi2TnWSXkbH1zpwnmQ6svKebgUOsiFGYZMq9tCGL/cKHiljVnJ+f87NPfsbzZ0959+YNb9+8pvQt2+01bbsjVgEfKnqcZMDFs1idsDo7oetkYvEe3bunE4Mth8eoWWQO7ahOuzMX6UPpC2lDjBKL21JIGci8fYSbamjWs1v0eYzL8pQcTh2QR7OLSXADWg14VlRuGMrQMTgGpxPE1ITiDC0HlW3ChIbVOinPiZr2s1864N/86OmtBhVr1OTb7iAQ1rQJ4zHQizEgN/qfTEHpBpEIJg1AlkwHzUt7Q+7d7ogD0M46GAxVjYRhjhwfZQplIn0BBwY3pgN71DeoikFxoK73vcv0eKKHq68/w6Wt5J9HU7xkRT4nUgoyXuA92TvalNjsW3Z9pi2ONkkSRQu3UZyuXOks65xk7RArkrVVpVVlVLI1Q9Qo7wNeYz6XksXTOkvc7JT2kDWg/gHyC9HIJ+R7OSMGaxfwIRLjTAL4BzFc48KE4EZJOGeRhoRApyt7cngnnucmNcn9QyQf1AeV0ITBiMgv6qIwX9kSI2qBpMnKRO+IVUNVz1iv1zx58ohnTx/z7OkT3rx5y5dfvWCfWm72G9qcmC+XJALz+ZJQVcSqoqoqqqrRLBlFQ/h6Uj8ujEgdPGkaUVGZYU6Zuqqo65oq1lSxYdbMmTUz6lgTonjTz2YVTVXhcOJaULKG/82SI4+i/ZPBXE00jLChg1CpuBYoNg8Tr2kq2chmIiFJ/yvYzQntlTIpcfDxm4ybPj9oPDrZOooklXCieufUy24DB2Hx0c9+CfDzHz8dPgTKDYxQDOmVCckh18tkFp3SP4ix1d69C0Yi1/NhCVZtC5P3pozIkFKuH5etnEd/DmVLgbghsV8hVhK2Y1rekNjwjkDl9i37W3ScfHGyCuQge4mj7FzG5Q2bd1/jc0twshUhFYkHCaovS4kU50hAlyS77FZTF6UiAy05zpTpIcgmfWXSqHB2cVbVK8aEEMO587JnzgUhUHKmlJ6+25JTK3viBhvBMMCKdIZY2n4nOdd8qPA+EqsahkSJYijOOhtaPfsk8Y9MTWOQCRSp9be4P4i9wfCgHEnEFgXAKYMz4kefd8ETgiQILFlCiJDFIF7XDVU95+RkzZPHjzk7WTFrRFK62e344uuvuNpccbO5Ae9ZLk+YzZbMl2txC/CB4CWO+G7X8vrlaxzC6KW3RLWJURlOVYNzxBg5WZ1ycXbO2fkFJyenrNdr1usV69Wa1XLJejHjZDnnbLXgdL1gvVxwerImenGPIMsqodloZRUSQhWFuQyTrNGB1GdkMmKnymost0n5GKSv9X3FgfEKB79uvydjYN+ZXgvOCVNNFqN9pN+BGf3tJ89HRiCUOxSAitjT+26ivpk/zFjwpKID1xRCwTaBInGiZca0aV4Op/PytKLccf6+a9xxfTyXgXReQioMJGDLxEo8Xv1YZCBug5Oe1Jl4oiJpf3kKi0Xk3ZsXuO0bmiCG6D4V+ixL9cHLvqligd4Lkmc+wz7Bri8kRBotiAd4wbpXCNxZT7uBAykvdsOMbfYhHzSomvOyXJ96+nZH1+9EvUy9rF75IIZVXSHtbalZl8Wdj5JUwMnqmQ+VqGVebEMyuoKEKWuCR11it2y2Qx8iRCPqmZjEvEk9EwZkZUgjbYyc2qzsOekns72YcTTpcrlDkhjEWBPrivXJCR89e8pqMSennuVywZOnT9luN7z4+gV9n7i+2lBXNR89/Zjlck1l/kR46lhThYrtTlKZ13WjE7DU38dI3TTMZnOapmE+X7FYrpjNF9RVRdQswFUM1FVNFRwx7/HtDXnzFtoN9HtS17NenzCvF6xmc5oYWTZz5s2cWdNQ1TV4oSex6Qk+SE8hUQjs0L46sBEpbRhNC0yw/i4CULDn5a9KPxPVbJCUNHKEdyKKFVXXBjbhHGH+0c9+CYV/+7PvqB45MqOi6ot3Y8oaNzCrsRD56HDJqEUxaHLZGj2cTm9OOuWvYEbHMKp0t98Vfx8JKSGzqD5TRl8IOZUBM7+lKVj75RhXAuyegQWuDy7TXb0g5B58oFPpiFKI9o4TAlZ/P/pS6IqnQ+wHXd+JiI/WVd8vKnLLqVy3rLMUNVo7UV2Kk60Tsn1CDMZ935JzBznhzLse200/UYuCMoeCGqJVgkUiR/oYNVa5SENYHVREk7Af4uQ5zq/SBrLNumKiL4NtQZ1SVQIUg7bZktyA8MaMsvq3MOCrqaYaKaBIZEhPUXVrxnp9wvOPPmI5byB1lFJYrZc8f/4Rbdvxpz/8kat3N9zcbDg/OeOjJ89pYk0VJBU4Gbo+SfsrkTgNnJe8dGIPE03KKaP0roinfE74kgg5EXJH3r5h+/IvvP3qT/z6P/w7fvP3/5nrt2+5f3bGPEbm0XE6qzipPMvasaw9y1lgNa9ZLuasFg3rec28jkQ1kYh7waDEK76JfctomoGZTPnO+Evsjkr3Uxy3yXo4ZAzs2TxkLRneENrWMko5lMrC/COxGf3tTz/WS/KgOReKQVCjH07fnII2RBB0cllPho8PN4ZHZKD0GNppEoA+WrBqCcIeHsPNCbynnjCmzikIwiMIPLRBVSers3WsGd3s3BkTGPRxk/hkJiiu0OZMDLB/94p+vyU4J8SehYEHkLo4B0pAOUOfM/susWsTqe9HolYpTcZQCFL6TvtCw656ZOneMfoT4SXCo0xGhb5v6dOekiXzrSzOqwhv33EiqjinqzwoM3KagXYwiusSvm5GGeIoTeyHWfOzyUCrQ2JR+5wu/4IZmbU/tQyQSVHGRKQf86mysU5JVm4Ge5ITZhxChfe6PUXDrPgQCbWoUPcuzjg7OR0lMScSzvOPv0u77fjLF1+w3W4gZ55ePuT+2RkOSH1P1yf6VAaGXJww3KquCCFKkLe2o2872raDIimWStdCv8enPaXd0V29YvPi9/zp1/87v/mP/yuf/vrvePnlXyAn/uX//V9xvp7TvfuCcvWCzZ9/x+s//Bf2X3/G5uVn7N5+QXvzhuChcYV1gNNZxelqQWo7bm62asERdV0YsrZVONXIFAbkElcQ7zT1k/ax0YQMqi5KDe+qdqMgaqDQ6zh2Kmg4N2SldarOFyDMn/3slzj4m588GzgclGEp1l52HBqy7bdzEkdDpA5rkyHTP1MyUoSf3nfj6wcwqgVyfEgykr/j7IXVRRnRcM2Yz9ExlqFlH9Xn4Juu0KaeECOrecP165f43OKN2LM40kkf2SGRCXOBNhWJraP9mi02jZM2BGUu4jipPhsaRkT6ThhrUXUmRAnFmkuR0CBkgivqqa37wRCCHWYvVflKKWJw95LAT/rC473YZIQZyWqT4KXOlCqtjAxTdsvLEQXNTQqSh4axsC4RdnO0wHA0Bk5XZmSyEInXaVoiY5q5iKQWlGm6EKibhoeXD7g4PyM4p3vHwBGIseY7H3+X/W7Pl199wX5zxSoGvvvRU5oq4oKmcMLjghMXD4uYguTMa7c79ru9pJDqE+1eVixLtyOklv3Va77842/54z/+Hb/69/8vPv3HX/Hy5dcUF/jJJ/+Cy0dP+eLzL/iP/+7/w2e//Tv+/I//iT//+ld8/ttf89Uf/4nP//Ab/viH3/LZZ3/g3Zs3dJu3vPrsd/zht7/m9YsvxZ8IT58RXy+E0Qh9jzsTDuh66GH7e+vmMJYDCNJM6FPLn0xG6Jg51bhkvIQWrTRZ2gd+frCaNgbqKsrlrDAQ5C/o8uKAyHp/8nXn7H/TC7do+BaR/zXM6FZpyv/s3aKq5viNQ2Yk1ybPTiSgb4LBADgBG75SCl3qmc0bZos1m80VbvOK2nyGUpKlDxCpyImyb3ajLhW6XneoqwEy6/JkNklH1aJiOcGUEEV6kd8eL4xIcr9K5teScaRh1aqUPLoSurFLzdNbOSDeia1E/EWEYYMxI909z7iCljUrilNV3pmdR5eWBX/GaJ0HXa6/RQ46hKJlTg+GcTYbnsa7doFYRU1DniQzCAXwVHXNw4eX3L+4oIqivuai+Fc8s9mCH/zge9zs3vH5nz5l8/orcrthfbJkNm8EIb0Yj10MZC+Zf7PttWs7ural3Wxpt1tSt8X1e8r+hvbdS/70m7/nV//+f+X3v/l7Ntst958+55N/9W/5v/2b/4nv/Pi/Z7Y+5+svv+Tq5ddcv/mK9vodbFt8n0lty3a342p3w9urt3z15Z/5+vPf85c//Bf+/Ok/8unvfsurd+84u39JNV/RpjzMuYafTCaJoW8nkvEUv6fnd9OGPlfUo1ztQw5ENLHx0ZXgEMQuaQsciJr201+WUvjFj58dFC3irgYzLyZaH3IyBu9e+aggwVjR4/P/M5iRMxXgqB7OmRFe7R0HDOr4O3e/jw3i9OE76i8gs1Azm7NLhWXTsH31JaQdjkKxDaFFEzS6IMv7mtTA0helXndn4+lzIWUhFLlWxEPZyTiUkuV5C5uiDKOKUZmkbXh1FF2tohQ84855BkOnjoEav4OTlcexndN+FGaUclJ1U/uhjNsWnKKCMNaRWY3OjBppwCQjxpU9U6dNOh3GaGLHLMM2BH3GO5XPIVYVWR0rg1VEV7cePXzI5YP71FVUxszgUd61LbGOPP/Oc77+8i+8+Owz3rz8ij/96fc0sxkPHz+C4HExQHAUCynTSULNknpK23Lz7g3bm1c0vmNRF7rtO/746W/57W//EefhX/0PP+fn/+P/xM/+9S84f/Qx9ck9qvkJ89mKH37v+/zoB9/nk3/xU+r5grdv3/H26gpfNexLZpd79n1LypJufN/uudm1dD5y/ugZF48+IvuaziwcUzw95EMK0mfvg5JHdUyM1YbzJsgcaUkThidjJ8zIEiWgqrMzA7bD8fMfPbbXcU6Ct8sHTO9jEuJA9UT5gh52x4w/KrcK6iCkoVY1O9fZ2w6b2aWxRZIhqk1GMVCMctphkyYrEzKGafaEw2+JncE6b+wk2bM0+hcZkRmM50Xj0ug39Z9JFa7kg+DswaIaFFkOrsm8ff2KRXQ0MdK2vaSQdqJaFdWfU870XaYfmJFskOiLJ5cALlLXDTFGITgzVDoJWiakK2qZam04JISss7AgmIMJ2lfaX7Yco9KarcQNPkqD46QsnzOY28Q4HbzarHKWVcKi+OBFrZEZMgxjLFq1hDYZFG6zWUjva/lTg7yMpx9WQ2W5WB4XL/GsWx/EnUE8sUsWCTAV6ErBx8D9+/d48ugRTYyiriqq5VLUizhRVTOePnnO53/8Ey9fvqCUjj/84bdc3HvAvcv7hEXNdteSNj2p1bhS3Z799prt1Tu663f47or9zZd8/vnv+PyLz/n67Ruq1Qk//5//F55/8i+YX1wS52tCMyfGipyTZLxNmRZPmS949qMfc/b0MbsQ+PLNNTddx027Ydt17PpC6ypStWZ2+TFPP/nXXDz/hC4u2SfEtof0uXbr+HOC60rBB5OuJPJW1i6zg5C4vaFGeowaVPrRRTQ9zB9Oa6ESPSr04JzajICf//jJULiMt658FESsPiJQGKUe4XiTO04QxCmTOrx++3wqCo5cVDtsAGvwIdgjx3XgqEOPGYzdd84NburD+eTZQxVVy5zMzkM75a7+lXoFJfCiv2ZNRd9u2L59SRUCKZtEI8v7qDqTUqJPmb4fw7NkvBi+EaYqYXls1SmJTUQzgMrXlZnoGBzOd9qXKkmIm8A4qUhH2uqbqGbWTllVU2bvgSLqUOoT9axR1Uv2ZoUqCrseVjIZXQyQxZEYg9Q/98KzFF2LrapNan2ML9PxHNSLwQFQ6mG79HEaiVG+TNGFmXsXFzx78pimrg5WVBkmYJGSlssFlw8u+d3vPyWlntdvXnF2ccb3vvcxu3ZHu21xRZw9CTLqpMQsRlazhqpybPY3ECIff//H/Mt//Qt+8i/+JeuLhyRf0eNpUyb3mrUh97jcs725pqoDrsr89ve/5suXX3B2/yEPnn2X5uSC2ckFFw8/4sl3f8TT7/+UJz/873jw/McsLh7jZ2vw9aCyD1h6ZF6Y/j7GlOMrzo1ekiGE0akVwRuv5p3jsToGozXBQXl2sBn94pOnIy0VhqUw5w83sxlMNXn3z2RGHwJpw9366fTa9G6ZHkfu504bbQMxHZDpdTs3xnDotKVfcdOhncJkgGFw/vMkPFmdHDO7m3eiMgRPlyRtN06In1zEk1e3W+QktqLigtiMsHTUWcLOKhEmoUFRFZwwQHewvG/WFynDJMVRilTpzInRW5iRORIejucgYTqRcmx5XVYDpd5ggcwm4rtwQFUJpZ+9OTnaZt5p/2m/i+/TJCmm2jSsHHvDO0cMkVhV8rxOHLZHTqssaqjaQ89O13z87BmzphYbniKQs/rpd1PfM1usefbxd/njHz9n3/acX6x59for/vzZHzk7OcfHOSWIA2jVNCyWS9bLBeuTFfPTCxb3HnF2+RFn959Qz9a4UJN6+WYIga5r6doWXxJ5v8GlHbvrV/yXX/07vvr81/xv/+//J//5P/1/efPmisfPf0qzesz68mPWD7/D6sFTqtN7UK8ocY4LjUxeQ+hiW0yY4r/0p3Sj9OUwOeoKLgXpNAXHuJDl1O43uTnwgrvoDLuuY+fUJmn3w+yZ+Bn94idPh4KFOLXgwe/oGMZrVoHp+RR5h4YdFXN3uVOQhghvsGcP63NcgmiVIkoOcMSIjuH4npV/63mH1ml48YgpHZXtdAMpsjftZrtjNpO0RO/evCY4UQXEaupkBstQkq24yd4d6b4xMSTOqbFVssvmUkhFpCYZXC/JE/G4EEb1dxiEsS+HY8irzrA65r1GZpReH2w03sp0ekcj+rVdB0rAiGVMGYjYjkRaEaLwXlSrkkWyw4igSP/aMr08K8xouC9u4Ic9r2paUWYFohYKExK106t0lBFJtFBYr9Z85/lHLGazg7F2E5zJKZEK5BA4u3jAg4dP+dOfP+PLL/7Al3/5I9dv3/Lg/iXLk3N8JXvigg+yZNC35LTHBUeoKwoZ5xI+t5T9DTHvoL1m8/ZrXn/1Ge9efM7u+hV//sNv+Ydf/Qdeff0lv/r7/8Cf/vBrXr/+mqvrG16+3fLg0Q+ol/dIvuGmg22BPZGeSPEVxYufj0zEHOJmKbdxVSd+6d8p3kukSzuXlVvpH5FcxQaYSwYdGwv6JmOtY4bQC8rw0HHNmn0Eyuhn9IsffzTqfU6QYMqMBMlNYJsitD43nBkx65VJmx2HktL7QN4/7LAyMCWG6wNTGjp3ZBQHDGtSP8ljJs8ZkdwFUwZliInTxHTJ7EbId52QnszY5ndky+4Fcid2IN0Q62OgpI7NzWtK6nEeqqrCZVFTgpfY2IO/mHhPqH8SFAp96dWvRTygbSWulCAqne4bc15sRzDxwnXCuIbBMEaoTMmZ0+BgcBolY+kHWR4XBDXpSPKWSV/JayKp2bXRz0V+69e1DFGvxnEdZs4i8twg6RRl3GPXKExwBTF+S/2kHUEdM1PKdFkdSUth1tR8/Pw59y7OVf1wB5JAMRteKmQX2Lc9i+UJD5885M+f/57oMj4ltpst9y4vWc6XwjwpbK9ec/XmS0p/TUkbSrph8/YL3n75KW++/JTtmz/z7qtP+f0//O/8/lf/nj/++j/y2e/+gRd//pS//9V/4p9+9xt++4d/4rO/fE6bevYJ3t20vL1JPHz8fc7OH9Cmjmo+pyVQfAQvG5TRPjPDoMvipzb2uzo+6r+BIDS+kHO6epZljdRj3SJ9I0xLGZAgpdBEsTFVunP6bJGlfBlHoRE/Wa3PuZjNyPGLnzzT4FnWCIG7GcjQJDn7EDOCwQgOg5VbaHiCVHfBXbdvMSXt4JGTI7WevqwILP00fU6q5KyLB8YzvnYIMrMnzWgxeqvbGEyc99BVwaEfZHuAryTMhg+ZvHuLS62Ug8zaXgOmpZToUk+v9iORfBgkIaIj1IFYyQ508RTw4CL4muJq3T0uMahxot6ZHalgHayd6WycpU1j/42OhDKEh2M7xQV3pM4XtSGAJ+u2kEGqMkXfISqEcV7hqMIIDdFRXNHxmapnY2+PDrrOyaZRiiyKBO+JUcKmpGSRqOWtxWzOd7/zMfcu7g2SGhPzQNHlZ7LaD52sni2Xc2Z14OWLL+l213TtjrqOnJ+fcbJa4XLH66/+wu9+/R/54k//yBd//j2//y9/zz/9+u/4yx9+x5d//B0vv/gzX3z2KZ/+0z/yT7/5LX/5y+dsd1tcjLx6+4ZXV1dsdjve3Vwzmy+p6gXbvpBS5Pl3f8LFg0v2XUtXsqruQoe2gCKH9d/QZQK3LqibjpNx9IO/mrljjM6kMhbGbKSPRQJTvNL/jyUj+D35pjDA8Uk3NWD/zSciGR0i4u1zUCybIKT7BmY0EOdROcfnhzAh6jueG5D01vn47YP3nPyvHJr4Jx2IIuH43bEOwgBzEV8VkFUrGYDxmeNBELCkhg5KL1JFqKiipy5b+u21zDxqp/AS/oaUMvu+G1Niq9afdWtD1nZI+I4ogdp8hfO1XIsNPlRD4sIC8m1lDt4HXNDNlVbzYbXM+k2Rz8zKqjrFGAELASErc4K8Y6tRNJmOh5UnDGg8BCvNVjHm6ELH1el37Tc6toeHzuQqOBUgBltR9ISoriq2QZRCVUVWyyXPnj7l7PRE6mMa89AHYgjPumTtHKTS0/Y7Tk/P2W537LdXBJfYXr/h/sUp907PqQPsr17x23/493z5p9/y+sUXfPHZn/ny8895/dULcifbU9r9nrdXW95set5sM62L1MsTbrqebdeSHOz3HaWH5eKEXdvTZ8/F/ac8ePyEHt2T5jIBWZH0xTy+wNYkpSVKukdoagxXJlPtBJXv0b6aPHzw+nRyL/qsfSfr+1MpNxe1nTqJGpFKFk9+5wizZz/9JQ5+8WPxwGYg4ikXnEo0hy0RZD24oD9k4O66Jd/RcoohrD10/GO8d/i+Nl5ngUPQTrHnkOVvu1aQYh3aHju0kVbcpJYUbItMBlU3RhVPnzzoGxFt5Vsyq/ddC6oqxuJYNhXt5obc7nEliclIy0g5s+8l6qPt9k+q+omzmPnnOEG47CkuiiTULClVjasakcKqih5wFvBMVTCRZMQwXgaiHkV3b+qSF4aEOoR63e8FYnh1TiIcyN6zccSKiuiuyKZkwSWZDp3ajaRs6VexkY32BCdcQZjEhAkZmIEaEPO8k7AszjuNvjDisLTb9kuN0nQMgefPP+LRo0cSYlZEqgG3iqrfqG0jeE8qHW3bMp8vWa5WuOB49/oleXNN5eDi/B5NFfn0n/6R3/z6P+OzxDva7WR7xutXb8ilyLuVZ7PfcbXruN717LuOWFfkUmj3O9nk2/WkfaKuIrlkehzz1QlPnn9H1TLpQ+uJEWnlirVDcJQJrhaREe2+k9Erin/O9pdN1DFTlZ0XN5tpcDgzfk/HyDFojaOtSNV++664jHhhRu6IGQG6QuIwpmS/D+htfPj4yt3XFA6LGHpu+DM2Zvzu9JlpPaWPpyVKJ2cNFi9jc/QNfaaI5QNuMc7j5+wbcn1Qz9z4rBDaUICClW9xXETG8IDPDk+krmp2169o9zf46GVLQoHkdJd/LqQsnthmAC4lU4VIxBN9JIaKqq7Z73rAsTw5o6/mpFBJDXwQCamqCbHWpW6RjiS2ke1ME6YzsiNhTiYRyd/peBiIMdqHMDBT5wRZla2JamWIrJKMc+AG1chUeQZV0ikjsm51Wq4z/6UJlMnkmXURoBQZf3FNEQJIvRBPrCqRklLiyZPHPHn4UNRZdY5MKdErceVige1kLCFTVcIEupS5//AJ/W7Pzcsv2bx7x3K5Yr1c8Pe/+s/88dPf09QzcIGr3Y5t25HxbPZ7QlMRmkDneq43W0px9H3HfDYjBk/X7mi3O8GbnMilhyARJJvFio8//iF9qeh6Bg94RXjpN2OmIysacdqhfnwjnciA6NhNwuiUybiVUiiqtg3UYTHCbHxsvA6YpNHtdEQV45QudDUNfjGJZySDOop3x2DMwAbfKumOGdCkYlMYmMlwX/9vs9xxOXfA8Kwdem5lH6LqbRifF71oHC578+hcq+RUMhh40bS+RwRyq4425nq1lMBsNsPRcXP9mugTLmkQLSA7UStSFqYkq2qiioxbPwA8sarpe1UjfQWzJfhG7SQF5zR3GerEaPvWYkUIldRKuAdM+0+ZBiK/DKqQjJ0wIVSSMVQb+lYbK+ZqGRuTfILucC9JAvCLZKTkNMEbK1M+aROjEtrxLGz3zB3DaQXUIC8S3Wg8dU4a9+D+fZ49fUpTyfJ+MZXRCHP4gurQCn3OwwJB09S0mxt22xv2+y253/PlX/7M29cvqWvx0O5SousTqRS6vqf4QrOo8cHRtRnvZXOt946qirT7PV0nG2xTn+lyhqoi1Auq2YqPnv+QEBfEqh7w2Cqo/OPOibgwMdYcgFyUfh3Pp49Ll1onqD3R2cqlMP4p1Y/Do8wKW1iQsbExM4Y0eXG8+d8SytExXD9iardg4MqTfjki+G8LMhPcuirByJBd9mLULJNZ+vYhg6Ei7a3ybsP7aluch3pOG+awesji4imFMNqyPMQqUNWREB2C80UiGgbxrZM+E+NvoBB8Jpae3G4JqacCal8xq+bUYU4VZsTY4L1ISKFu8LHGxYpQNcM5MVJ8IKshOGusZgvknoeMJ+NyvHPij4OO0bTdNr5SX0FGSfWjBlNkP1ufZItK1uXh8Zkpch92upQocPzdUiQsS9I9cGYvzDnRt/shzdF2t2W720l7eB+hHoIQu7S9T5lmecbD7/+M5eUzNt2O33/6G3a7K5rGEeqCj4UQJUlmCIG6rmn3PdvtXmxCSpAF2G63I56XAsXRO8c2FfrkCdWCWM2lXX2n0rc9rtPqQcfoSuURLd1uqKrLuhDT992wb1DosAzMRJbvR3vhwNzt2aEuQleZA840AalQLkXUtELhb6Z700ylvGPwp8zgLiZygDhyYfKOfFiQd4KkwxuoWiDfydlEeHt92nny3uG745kxnuGa/T0o45ChSHly4bBdIzENdhSt98Fzx2Nrdo0pUx16QR3vvGx6raMn7a5I7U4DrpXBaJ3UsXEiVMv+tCIzEjiqqhL/kJQoOK63LW3fU3oITtRB7+OwhQPN8FEQhlOchLX1wTa8mgQ0GTttq9NQrvJbJA8mficyvjZrWnhdUfG8H90jTIW1SIzDeA4I7QaDehn62mwNcu4FkUaCmazoOEztEEIPiltJVTiRGhNNXfP8+UecrJb6bZmM9CvDiB0OoEqqRSMBFEczX7JYLOn3ezY370h5By5TzxtCDPS9rI6WLDaZvuvIZGKM5MTgcZ9SwjmN5lgKGcd1myi+ZrY8Y7G64OlH3+Pi/iNRt4NEHJCqmfQqjB5bfZ2AYaz08fSe9KGNX596Uc+L4INtnJfm2/iolqCalODjiOsyZqOKZ9+wFVUrB3F6/Kn6GY3MqFhhRcQuho+PMCXCQ8K9fT7CyDVBdppLJccnjplRLiPDmNbgkBWNhGJwzIzs3aOnhjvOjbr2FIwAnM7gtlSKcf3JDHkMghTmvCgexvZsBhISyTGESBUDkUS720DppA/0Xyq9OuqZMVXEvL6XlR7nPHUVid6RUif2DnWSTH2h7wt102iIjCzO1l78kIxai5O9Zj4qsyqmpqhLwGRL0Ghp0zpOml6K4E6MkVhLLCHx2Ja+lD601En6HUuLNNnkPCYPMLHfkFkcHu1bppINM7PcGULJGLHIgoP5RwnhVhpvuq5rnj9/zvnJCa6oFFVEWhaGpMxJG1qUGWL+V87hnCf1heViybxZknJHKi1ERyoOwXdJcpizbJROudC2O+qmJoaakgVn+iTJG4Imauzx7Ik8++4PePrRD3ny9Ls8++h7NLMFsY5gK4nCetSQnNWxVFXjEdUn/TRKsgLjQMo1idWUtYygq5HjpCR/TUJGn3N6TyQmMVybtFs0dIjhsSw4SD+G2dOfDn5GBg7pXEHKSR2tDQcNus18js+njbXfgnCDHHL4CW3YwbNDCYcMAiUNJw/qUwp6KgSk50dMY/qKFncHaF2KeqeqxDYwG6vr0bldG4uZ3DOzYhFHMw0uDSXRdddD0sRUerEvFGN+WSIqZkH+YuFDvGytIGe61FKiAx8IvsI72Qjcl46EzMYFN9ljNiEq74RJWN+ZdDOsvqnTpFZ9uh3Axt2rGhKi2Km8qnBjf8hqDE4d55QoZJxN+pRKZLMjDRttR2LAVncGKWyUioQhqdSmZdvGWuFF2q4gGTnuXVxw7+JcojMOktHYD0Ox9tMYUpFnfHaUrpBToWkWLNZrQtOQ8NxstvT9lqb2BOdp24Qk0M20bUdVVcRYAbDft2y2WwnYX1X4EOiBxb1LfvFv/2eePP0+FxcPCXGmsatkebxYdE0mq1bD9pyJpMJUkpxoHaAq2sigpvagnGTTcc5im7KxtneG8cXcIyysM/RJ0hYljdddxSiS8YSZUQph9pEs7f/NTz4aKiGMwsQuGZhpBZgg3vHv43OroPwdGYw9J49OVLljJjRVhw6+iSDc2MsHcEsysvPJMwzl6O87JKOD+h7fPTJ8y0RvVHrEiNDHJuBcGXb6pwIlBEIV6Nst+90GV8R+0vdiUwBIyoiKMqNcZKd804jvUqXB9ntfwAeir0BDwaTSk0oraao1e4+AJmaUsAcyo+pNc4AbmJEPeCfq3EDcR+3y6vFsUrU4f0rf5GIRGZ3gg24FGMdfe3PafcqcZI/ZpG5TJpTNjVGLGZiW1kGZkaiYhYJ4rIcYyakn9x2PHz1itVweqGmHZcqZjbEwZVVJsyMW2atVvMPXM2KzxMeZxBHvd4hzRqRPnq4Xe9a+6/ChopktwHvavme321M3DVXd4IKnJ3Dx9Lt854c/Jfq5OrdK5INCErmtmMSqfTk4nJrqZCqr4nAZaXI4J03GUiYF7WmKptS2sqcg7h1jX0zpX+yLSbbHeC+7C5Qhgmo/yshC8/Snv4QyMKMpjJW1j9idY5L9EEwafATCaITEy4FtQvtu+GsdI8Zd+/yQaWKojpYxqd4Bs+GwKs6hAVr1k5orbnxlHCi75rTeXitnUuT0OwZTRsakJwraLgpOw6QkV+jxEOe0OdBut8TS41Ki74pEhcSTqchFbAzmgBl8YdZU1FUQA6n37Pok2zS8RF/oUi9OmyVR+gJdgT7JdpScJdGedpBJrEXbGrwmfgxhUKMGBmVSNOLfM7xjO+V1Wd+QFdta4IRhFCOhwW1h9Btz2KQo9h9xthQWMUV4UR9kFYqh3/UQGsQ5KQ+KuAY6WQWbzefkruXliy9Zzuc8vLwkBt0HZ9g5MMZD7Bh+616ulHQhRDO9ZDxVNWc2XzCbL0g4tj1k39AWR+8CzXJNs1gRmznFB+Jsztm9+8yWK2IzgxApYc4Pf/qvmC3OZQO0FydWwRwzFSAM8rhqOUtPGpMwXLY+Khz8lfEcGcpoG5RxHaUp+ZKMtTAZ89FyWpeck042MkbRJoMse+akgNHfLMw++tkvnYadNchqfZd8SFMmJIbnoRT7dUSJ47lU7pgoDZxgiCCm9pJw18lDxeyjimiqv7shy8jkwYP6Cdj5iEaHD2iXwPDM5KlJ8Xa93NXe4fnDdt7d6hEEdTLFZ/ErwtG5hl0f2N9siGkPfQ99xpeCL55UKrKr6HuJS+SQ7KveaxJAD8UHdm1PcUa84s1tiOsS+D5BL7F3Su5B01eLimSbm2XsZJzkEOIc7RDOOTGMq/qWdWUtRsn3JZk0pnYFabnt1DeiEHG/KPMSFcp5QfSxrxhVukn/eucG72FZ4ZlEatC3bTxlVTVQvCfEilk9I7d7Nu/esN/vePzoMScnJ/QpgcbfGXibG7FoWoes8Z4HearIFwsO5yKxmgvDWayp5ifE+Zpmecr55WOefuf7nD94RD1fUi/WnD94yEff/QFn9x5SL1bMl6ecXz7j8sn3wNWDi4ZVSc1R0o8T35Ey0TDQ2/JD667jMH1maJ2+D1bOGJbYXnZm35OHtARdcNKFDKdd5lXzEelV3r1Np4PNCP72k48OGmDPCuFNBmA4P742wvE52qjpX+w57cwJTx/f1+tuwqnlufHZvx4O6zbdJyutul13g7vaxYALt+t017UDKOZaoGwpOwqR3T5zffWW3O/xuSOklkChuEBPJCH+KExCx9oAhxAozrPZdkJ0RZwn910v+9vMPpUlg2umJ6U9fbfHuaz56IXhlCzOmsJExqOU0ZdHiF7VAR0v7yXGNfqbYSlYd+mr+mnqkB1O1TFjeI5p1Aizc0wmnInEJSZOlcy07wdcPnoeL5JRVTd4F+jbTqTJ3Q4fAk+fPBHVg0OqsdGclm39ILYteb4Ukd7kP1k19bEmNnOq2ZrVyX1WZ/dZnd7n9PySxfqC5ek9Vif3WJ7co1mcMl9dsFhdsDp5wOrsEudn4DQL8NQ2JgaaQ4pw0n/W3pxkzA4eOqI5uyh1F5wapJeiuKz0KuMkYyNtN1VrKGYsL0t5I0lrzY9oww3bQRglo5ELjg9NwRDjQ8xohOMeOASnM60gu/atqW7GJYp8yp4bEXgsfXrYS1al23UbdVs9G+4oOo3n1mF3MJWD79oAWh207OMOPwZ5bDSWpuIoJbBve968u6btOwIdddlLnjMXyASyzcbKLEQakW+GIOFrb7b7IVlBKrDbd7IqouIzOVFKTymdePYWkZBK6sQz2wVhWqY+WaSDqaFyaOfYBw4J/h9C0C0rck/qa6tfeqDjWcQoamqfddswRqoWCmKPfkdOP55zltjWKl1NJzg3SPa2nGzE5Ak+0vUduThOTs9o2x1vX7/i4eUDzs/PdRfCCEP5k3EXqUglO8TQbn2BSvwFwAdcqMjF4UKN9zW4iA8NXXJU9ZyqEUfVPgd8nJFLhQszqtlS9h4abQwez/bvEAcx2lJ3i+HiFCe1f6yP5Locsiig5ViZVoY+No659EEa3DMO6a0obTtnjH3Ep+HRIh8KzTO1Gf1YAvLbwNmTx8Qs53ZMr90NhwSp6tV0wnHD/w5A6y0NNgTQxn/gc7fqIn2n79uvYeCkV6X4427U58o4w8i/w9ZPW/dNcNgXCCMypDJGQWTXJb5+e8O77Z5QeqoikpEZCtFd/ba1oZQialsp1HXNfLGUSJGp0PWJppnpHjclnpQouRPmk7NuBJEg7yXJRlVZgZGZtyhTkv4wiUZbUEb/J5u1vdqpZPVL3hvUNMNmJoxosEtYP2ObZhRXRglIstbI4URuEwnOH/evKkpFpF+nhnXvHDEE6lgxmzWkAqGe8fw736Xb73jz8itmdc3Tp09pmoZSxBmz73u1Ewo4ICVpY86j8dzh1P5ZKOZMoatN1le5lCEip1NbqIQpSWRndjINCYMQg9Gm4Mr4vdHWaucyVBi9qNps32JCI9OJfRhrHSvnnfg7MWovVuYxDHTJyPjlscmkP3xTGpU0kapzknk2eC8mE5mNJhX7q0jsbrCOOLp661yQW56150vJdH2vqojAgMwTBvWhY5QCDBH0760l+cPv33UMTMlsHIJr4+xw/O3JCsH7j7FesrwtzEaWaz29n7FxS97mOftwQo4LvPPUvjDzhToIURmhpizOczFGUp9YzGbMq0gsmcrBoq6oHPgi6pmNhUOM+D4XYi74PtFubri5fst2e03fthoWVrN45EODpuCeuRxo23QpWAdT+0OIyQeHSP9KsIWBwPLEDmXEY0xI1DzDj+khCG/3TGU03LIxc0AMXpbMY6DykLo9KfXMV2suHj3h9PyCEDy73RZK1qgc6jZhxnFTNSfqWRnwQfoBmzCV0RSSLB7kXmyershE5OR5cadQX64gm3qzMncGz3brL/MjOsancVKT5+y39K+B08itokqrPU4Nyt5pxpbJOE7LQZmKHeO10T9sfL4MYziu6km9nc0OCqVIIV6bMN45GND3gX3MjkPdf2Rsh+XeCUeP2ACnPg2esocd/u1heMdmryJ1G+tnM/ykLVNMn5SDfrtYCGAzut/61oio48AMD02OsQybVbyT9C1t17NPmT0V79KMtyxp/QxwVC5T+0wdPbGSgGHBeeazhpR7NrstOWeaKrKc1VTeQ07Mm4oqOFzJklXVRzlcwGVHKJ7aRWJx5K6jb/d0+x1duyO1Lanr5Og7SuokJ5q6JcjmX5FTnPahBfKStma800wmeukApgSkthenRlSZUCY2J3vZib1Nfo9TtxCKFqv3xMFTVLPoAy5ncrdnt7mh6zuaxYqzi0tOzy5YLlbUdc2bt2/YbLfDhDi1n6BbZASXZJuJMGepl4FD4lPZKi1IBAOxM+uW5CJ/gwtEH3HZURK47HDF44tsYjbpxqaPO0E/Pe3ekW60rlmYomQUFv+fUgpd12mkTt1nmDX4mY7JXTAyJKvXIcjt8V7J6henfmuCKiNdmyfIQKQmKdyGUeSS+9ND7suhNpAyqhC3iPIDYM/aaoh01kjcaOe87xikH9VLB0Y0PGP1m5T5LcCezVmUknz8XpGyB6Y3UW3eB3LH44qnZEfXZXa7npubPW/f3bDZ9Vznmq+3gZtck4IHVwguU0dHHRx1hODF18jiDO12G8gdq0VN04BLLbV31NERvTAM8fuI+BBxSA42r7nYPE7SI6eOdruha7ciRXQtfdvS7fe07VZCXKROVvWyrPjBpB+0352ueBmjQhHV/I0kc4Ua201anHSS9D06iUxuHJDdOEamLg74ql7BlELXtux3O25urockAMXBbLFivlizWKwIMfCHP/yO129ecLO5pt239L2orwZO1QuRvgyfxoloOvYO/YgmLyjFQxbny5GUHKnLdG0idZoebNK8sbjbRC9tNuP5rW6xTjzAd3l8pOdD2pLxk8QJfy047X9NK56zrnCKVGb1HOx36s+UKYT62U9/SYGf/+gxZcLthNiOD+5q6S0QkbsMjEmKfP97tyUxQyj5LQ0cB2Hy8xbY0v/BMfVhKozi7MSGpnflKCKtZJut7Z/clEFj/G0DzaT/DJzTlanJc0VtB/JRiVftXCCEmraLvHi55eXba7ZdSxUaQoG5b6n9Fud6UXNKhiQG6GREqjG3nSuEnFjOaxbzGTfbDc55Ui9RI3ES8C3p1gNZli6kkkjWX6WIOpc15bTmyBvVk3ww40uvivMhRQzrIo1LJzsREWSe1D7wul/NkBdk5U0mRy3Rq63HC8Gp5jKoBcPWEsAViaUdDOkH1W1ktDllXPCyFScGSlWzWJ3xve9+j7zbcvPmJbOZI1aF7e6a07MTSg6E0JCSbBwdDmUCx2OO4ZCN9TD+xpT0QMKsiNQisaZTFpVuusxr9w/xWgg9hEjRKA6lFLq+UyZ/SFOKsRSVWL0zVUnqJquR43004qh5C9gy/vQ4qI4+54y2DL8RBofRgtq0MmKLHbqjFNQfctT1zNYi1Ze/VkhSx7m7On8Kzkn4T0GiY0bzYZDBtXdsoMtEvRolmrsP3Xg5OFyNnTKUo7N21p3osl9oPCRsh/wWQ7Acdj1NdpWnJMHPBhvV0TEty54rWh2pLxI8v4gYXoqj76AkR/Q1hYp9qrnODWl+Tp4t6R04n6lqqCtHHQtVdEQPwTtCyfjSQdqzaCoWdSCSaQIsmsCsGmNWJ3W4zMGTgicHD8HjvWwsjd4THJLdRNWtYZyCl8DvSkQp9ermL6t6ZgPzzvI+a1okVeyE+ViqJIkgGYNsX/GyAq+MxHBJl5QNWabE4TTsrOJmSTLGzqkNJiV6zXePcxRNNuBDoG13kHsePbjHg/sXOJ8obs/1zdd8/vmnQE+MGn5kchzDFA+nuGQSokkdwtCnh9Kak4QyOYgtKZHo6c3H+vBQ7/G+73HDahhDj4znk1eUrrPi7+CTFdRxMYQhbK93biQdbdsxDExJYWh3GoPyI1SnDrqTyVmvT98N9dNPNL314/HhCTgVR52TJVvnHDmnYSMiB5LPeHyYXR3Cbcnow/BBXnjUacftkZWb6aCOjLgUcZq7xdzst6pn8le+ZYN0+M7hcQxWJzEDjJNBKoXdPvH16yuut1vZ24UntR19bqlqRx32+LRRopMMpjlnCb6PkzAjukUkhEioa1JfROIpEoq1hJrWVeRQ4UIl0QJ9AFfJX932gQba93oElVLwHhciTqNGyrQqHteyqVZibkveNbHXFEQ8dzgyiuiaVWQU6aWOpr7JKyZ9WO8d4pmUY5Kh9GPfa3A0tYl4S0Rp/9QNAFVTwXF575zInu31C7r+Cu875suaL796Qdf3nJ2e6zdHfDrE8qL1kHAr2dR1G3+d0Me6I2VpEWVQtQQHvbo5GBwLVa5I1IWke7xSSkOfBefHfGYFmcBJYmejALpYoPUY8NGY2lDl27zgLhhao+qX937Y/iHMZ1TRBrpQaWjoH29Oj+7DzEgOMTiNz9xVMeHoWfV+O+TJ0eZ0G953/S44QkY9pGgV44c63yFCHzOr6YAfzXZ3MZWDv0VF0DsY0PveO6iTQ6UEhMGR2HUdL99csd33OITBdKnjerfl+vqKmh0n84BDCLjgxFlSpQiJJil9XYqjaWbIRhKJIhhCgBjpXcDFijpWBBcgOzziXySMSCIZSoYRj/cRlAERhGlJYgGJpR2rSIjCkGRExPA8qCgDqJw+gKqEWmfvJPWxILKN69h/tuggkmempH7o/3HGl9WhGKOG9yjqEgBOCSUVWfN3FIKD6DMvv/wDm5uvgRZcTwiO7X7HzfU1fd9xdnZx4Ht0a8pVSdgY0UClIH05PDbignSHsIhBdXKotHj7HQOHhBgJsSJpXCbZOyhHr9lPijI5k0JEM7AtG9b9hyvABjZ23gnjs/oIzh8+IzC+O5SpzpPeS8LHrNKqDscgPfngCbV6YH+IGYHMTAedCIJyikj2e6iWcfqj5w3p5BmzKYlkZOfTo2hZdkXK0x+3QBD7gOCP4Y5BPTh/33t33JN5dnL+nndv94OAtE0O70Vvf3N1xZ/+8hXbfUddS6RGR2DXJapqDrljUUeiD3S7ltRnYi1pjkQ1lSXjrpPAV6VIGiTvHMEVUmrFNuEcpe9wuaP2nlAyLvWy+uY8JQR8NaNq5oR6TrGga64SqSgKgqFRGysNF5KSrCwF3d+Vs6xGme2olKxRmtSvJWcJIeLHMXe68iOShqg1SVNNC4HJzq9SxGfKVGLDOZmZVe1wk0yyatyez+d4Lym4o3c8uHdKdD27zWu876ijo+RE1dQE78mp582rN9T1mvX6lK7riVHC1pYiUmdGDOVC0JmRqwjCDjg54J/SwERZKTCsEJq0/D5wuktfjP06IdoEoHsWUZyTJfuBPIQZadXsG2Y+mNJOwbbXiKRa1D/omIYY+MAhTPHemGApYiuyrimqdTnvCc2zn/3SOcfPf/TooAADOX+fpCHnZoQ0seybiHQ8nzbAVKDbzx+CdPqIuuNhCGmzo3F6Ny3zA8xo2nl31eH42je10+B918uw9FsouQOfqBcLQtWQimPfdiIHOE8pFU29IKWett2xmtVU3mw1mRggDlIRRF8RYqSuKuazGWcnK9bLOavlguVyztnZmvPVnOeP7vPswT3O5g1nixlnqwV1lLxfVZCQFy5GiUyJqDUhVngfiMFTxUqkj6wB04pshI1hXIAIQdNLll6M28I5lWhHv5syxL3p6FM7xKKWJH8Go/TqnCNaWAskNMWAg07GxrmJD48XyVmcfwNVjDSV53Q9J/gWR0tTe+q6UqkqsN93dF1LDDW5BH70o5+KCpj6walTFjpGW5DWTg8wZgSCf0a4bkKUA5j5w0QHhUEaGQ4r+6gI0YZ1M7L0gWkrXtQGZe7poDhMMpvgay6a2bgUQBhKSvKeScB3MaK7zo0R2diMzdNvek+on33ySwr84sdP7iQauWadeSgJjffvIrixQgd9OHx+ynxUMtLnb5f17WGcmQQGxJwgwxSOJaMpHNfDHRgK1cB6BzO7BcWmpEOVLhfZJyaSQcZH8cydrU6Yr1Zcb7ZsdntRs0qgchV98mz3e2rXsqigjsKAquCIwRG9+K3UVcO8mbFcLJjNGxbzGXUVWS0qThYzHt0/4fJ0QZ1buuu31LnjpI7cP1nw6N4Jl+cLTueVbD5RRDYjcxUClQ/UPhCdw+VC6ZOs7uWWXHpdTespeU/WrKo5tZTckVNL6vf0aU/X7+j7HV0vDogpd5KKyZz7jnBnupfQJprZbCbOnknC1QnKFt1MzUEJzjmCE0ZTSqapPPfvrWgizGc1TV3rZt0KH2r6lCkFgg808xN+8P0fsW9bulay51IsYJu4TEyweMB01ObmtM6CQ4qTRyhTlMZu4eUh2o73j1FuounZhaAZbi10sEc3VYcgDNoWsI5w2JgISIwqu3ZAT0dQVD07WEHjsP7ugBnpNZGMRE37xY9FTTuG9zMbA5kVBuRRcfFDYGUNw/YNzMgNXHtkBndVRzpJQxKouH7M7f8aZnQMx98UBJsM+/EDRzBlZGh7RXcvYmD0jljXpFxoqoa6qtjt92y3e9K+FyJpGnap5+rN16zngfVyTh3EuFxcIQRJaT2rZ8yahuWyoZlVlLQn5w7vE1WE6Aq7m3dcvXnFbnMtOe/7lpw66spzcbrm46dPeHh5wdvXL3j19Rf07Y5ut2G/vaHdybHd3tC2W5yXMCWbmyu6do8vmZI6ur6j7zsJuaqG5aR/cxIVw3kJORJiVAKRhAHOjPLar4IlbmQq2vdt19EnyUNmntL25HR8xJbkmM1mlJLYba+pK8fDRw+YL2pmTYPD03fi/iDvJHyQsL7bXc/jR0+4f++S3W4v+8yciiIDI5GJ0Dn1n5pIacaIjKC9bpuZgsn81m47UJugPX7IjMZ6OCf2wRHddYFDQcobvaGNaVgtyvCMI2XZsuGDV2//0W5kf6dg5Ym8MkpMfsgiO0pfxowO1DRbTfvFj5/Ii1qRaeWk7NEeY+d2bwrW0VPCO6748Xs2pxzfL6rfWmcPnTcRNG7XQFBwesjMpe/YuR5HW3u+AYaayeHkmv27ndDx8BBvHvuHII+9p6uWqetFWuo7Fk1DHSLv3ryh63qJ0RjBR8f1zTU319fMQ+Z0WdGlnuIgR0k/tKwj63mF8z37dkOsClWVqaLDBUdJmZQy15sbtrsdvooUD818xr2L+6yXa5ra4/KG/fYVJ8vIDz9+wvOH9zlbz4h07HZXbHfX5FDoSCRfIHhqHwhFV1HUszgGTakUauqqpo41VVXLUr7XzCUlAGKcF+lENrM2dQO5UFU15KRezE5W4VIaR9plqugpWXOMqe2kFEkttF4vqevIvtuQdXXyo4+fcXn5gFjXNLMZpUCfJe6TD7DdbejTjqYRu9usnvPJz/47ui6z2YrUaquiOfcU86UaeJSMveHuYLC1IHZqizUaEXQUtXIoRJmRaWoOJBCaen7bN5wTFRnkQfP0HnBM/b+cMVlvq5iju47Zu4yJido75u0ot+jZGKben676IR0hv0e/Ig5W1qQ879SA7fCDZORsR/CEsw1gXFqv38VwjhnR9N774A67tY3KhLtaBx3X66iOfyV8EzP6UM2dznjT8w/BUa9If9o3VMpyOHwBkrjnLuYzHj68ZL6YkUtHlyQR5Ha7IfUdiyawmteQO3BJVtUKrKtAXWmdXCJWstTqvQS68kEYQJ962l6C9/ddh3eFebNgvVrRVI6rNy/o9tc8fnCPs9WSy3tn3D9f8fDynHv3lizXFYUiBuYSxUcoe2Tboy5Pa1gQUfWsxaMXbkHUnXECkd+uiH3DOd1YqQbwKdjkKUvHha7bq7uqbJ6tqsBsXrNaLajqSNe39H0LLjNfzHny5Anz+YL79x/wkx9/Qt8n9vt2WAgQA7zsGzxZn7LZbnn27Ducn93n+uZG1LjBvQIQxwVp14SOxIY5qjgjMR7T2OGpgeF9UYP1+JgQi+FekRl8EByEmdhzig/K1BjnU2F4Exzuu466qrV+BY4EhtswtguVUO3bOUlUBWvclE6Gd4BQqWT0tz8Rm9HAiIbGa4cdddK0E6fPFdN339Opd8OHH5ZOPRw8a8CA2++BacPvgg/fvQ1lukqIDagp6ofM6Rg+zIymlZFZ3xWooufRo3v86Aff4+LihHa7pdvucFnUIIfDk1mEQlU6PLItY93UNHXEBw2vGiQwl/gOBUnm6MUZMKkkJqtpjsp5Ku8gtbx7+5p2u2O1mJO6Dld6vM/UFSyXjrPTJV234/pqQ2oDkRlk2YM1NEqZkUO2swytdLLkLJtHZUaWN1RWdmKLcmTSQUqecfaqYoX3tgHXUdWe5XJB09Scnq45PT1hNqtJObHf7+j7llISdV1zefmQx4+f4L3nyZOn/OhHP2G/73j9+g1tu5d9eEUJsUCIFe0+cXn5hMePPyIlx83Njq6TUL7BO1ApaArCIBRnFHeGBZaDJxWHdOPvyICECU3LHmUV6YmpiUQkSgnAlnV5fVqnrKF/DZcLxuRNq5ENy15XRKVaH8JsQJ0pZQFC01qZynb0/ki7IyMqY9hZ+PkPH49qTxkZzFjC+NNguK/PK34M174JjHSPxu6ggnJB/pf1G4cNu7tuBt/UiR++exeMg2NH0T47ZkhmoB8OlbPH9mmJTjaW2ovOOYKPRBegZJom0tSB05M1l/fvs14sRW2JkT4VdtstZ6uKWSi4XAi5Z9k0agNxlCLMR7KBBAoBHyR3WkH8x5wu34pKlGl3e/bbLbvdFqd561Pfsdlu6Lodb9684M2bF3RpL4kJe8duk4m+Fl6hKmthHD/nbJKaIKEyqTLI9bLC5l0hADn3eFcoRcLKmhMkqnoES72EfDMEqOpA8I75fM58PhOJqd2zbzek1BGCp5nNePL0KWenFzg8Tx4/4+HlI3a7PV9+8aVIPb3G6BmIx+OIFCLfef59ZvMl1zc3tN1eQozolpWBfkyK1zF3ygAGRlREdbHr8hH5n7w3xZ5DcEfkxrB4o1cPDM1ybnUZyfZ2uVai13hUEjfcaFEOp3YgOGRiDokeIW0aVzW9xmBn8t4xlFJGyegX338oFbZUI0JX4rSoH7JBuQXukMsNRllrq7ZjkCDs8rDcZw2TF8oxI7TOm14zUJX6nwW3Bb73t/Ho+9Zee1oQS3+PVR5hemF4wAZXGK3lLQfZwa8TFPWspmkaKh+YVQ0nqzX3793j4eUj7j245PzsnNNFw6KOdNtrQu6JznF+ekKf0YDvSyDSdoWrTUfbS9D44oKkS4oVTd0Qg9hattstb99e8ebtNdvtnrbryWS6vmW32/LVi6+4un5HDJ7trmPfO66uO7yL+AiQJcWSJk90GhrXkNP6L5i3rtolghdJr66iRJ10ssetqipmM/H7oWRS7gje0ffmAtCTc0eoHPv9Fu8d81nDYjlnv9/Stju6bg+pp5k1rE9OeHj5GO8D6+UpP/7JT7m4uE9KmRcvXnJ1dU3f98NYlSLaz6xZ4HzNg8tHrFanNM2Mfbuna/fkvtOH70KAySRk5+qdDmYbRSTFUnBZ6GX4N2gdCG1ZoUdgDMfw0r44MqrxOdk/KtcO6FfTi+cjlRgr31RMPRcaNmakS/9a5lhTwWu7bmVNaX2wGf2b7z+4RWz2wgHo6YeIdiDQo+ugF8c+UHjPtyYg924fMjj/zGNi3Tf4ULuGlxQcymAn5UzfP/AN4Xb7hkd1BdB2SQviODKepF7U89mSqm5k1ck5PDCrG9brUy4uznnw4D7ewc3rF7huR3CFpqlxrqLrCzeblpubPX/+/Gt+++mf+N3nX/HFq7d89fVrXr+9IhWxRGy2O968ueblqze8e7dl2xZ2fabH0ZNoU0sujpubDfsu4asZhIY2Fd5d78BBcT3OJbwv+CB2m6YJNPOK2byiqj1VFahqub5Yzjg7O+H+gwsePDjn7GTJrI507Q4o9H1LzonZrOb8/IT9bkvX7fHeDdl2fYAQYDarcA4WizmnJyucd1zfXLHf78TAXXliVXF+fo/T03P6tnBx8YCPPvouVWyIoeLm+pqvX35N1+7FRlNkjGII5OxI2XF+do8HDx/jcLR9K1EA1BvceTPe64Tl3ES6sLFXzNHrBfRbk72hE2I1JmXXp4hleFRUmNBihYHqu86+OTBEFRaUwY2MSMsayp/g82CikC1hBs4cK4/owxig2Y+s+damaRshE+onn/wSB3/7Y9Gdp7OWNQSVigZCcyMR3gV257BqHyL0912fwtj5U3h/md8Ovi0zso4ea2DTJcN+nOmtbwOyk52xbTpaBdnI2RXIeOpmQaznEu5D7RIVjugcaMbQMJsRQmB/9Yp+847FoiF6sde8eXvNVy9e8vrNFV++eMUXr654cb3jy1dv+fyLl7Rd5vHTx5yenQPC/Jxv2LaZvnja4sje07tMj9ifbjZ7dl0mNAt8vSQTaHNisZ4zn1cslw2r1ZzT0xX3H5xx/8E5Dx/e48GDM84vVlzcW+txwsX9E84v1pydLzlZzVktGuazipx69ruN5J93UFeeRw8vmc0btpsbYhSGFqMeladpKpbLOaena5pZI3ai1CGG5UyMgdVqyYMHj3BEUnY8fPgRT59+zGq5xgHb3ZYXX71gt9sebHfIJROCqLZNveDJ448IVaRQuL5+R9+JZCSM5i48svEtQxykUrImXlTv8gkuHPwbnESPoUyY0WQlaHhfGII5fuacSb34cXkvuc0ksiSqIsv7IxkI/Rsc0EeRtnjdR5eziPKG/k6lYIv95JwDZ+0wG5h902kIEeAXP3g4GMzse2Jgk70pxhEPOM2EP0y73ilduaMb7yP09zOjb6bq95f57eCvYUYjsuiVIRCY9Ysi7jBzfQhGZsbEjgCyqRAnWytKztR1PWzpMJuKLNvKTOacGCmbuib3PVdX75jPKkru6PqeV29f8+r1Fa/fXXOz72izo02e1Gfms8jTJ5d87/sfcXFximYYIrvCrm3xMeKiI5VEVsSrY812uyMD1WxBdhJwvu0Sq9VSogPUkcW8ZjlvWM5roiviEJk6vEsEMsGrL1K7AzoqX6iDp46Bpq6o6iCxmVwhREeoHLjCxb0zNpsrWRmsxHmvqgIxeuomcnZ6KquPOUs4Xu1r7zwxRC4u7nN2dsF22+GoePjwKY8fPZMws4rUf/nLX7i5uZHgakoTOSf1t5FnLi8f0tQzqqpiv9+y2W6GLSu5WN42xQkZKFnnG4zNatcutkVD8cjwwjBlIkkMtKKn7hb1HLNBKcjw2hjr9L7RvBuktDKkFU8523KC3FOjuxsM5Faexh6z8rxTg/6Ip2h8o0OmKi1w3qlkBPzNjx4PFXUa1CznjBuWZLXTsE6wzrFlRuukw8ZaZ+nrwzvWwXIcdtLID2533F3wPgbyrcB4wt1F48y4aA1n/Gv6vN0vNqPoYYg9tnlacpnMDnJeFIlTSbL/qsiMGaNnPm+IUaTWYTnboQbdLCE+gic2c/ri6DZvyWnHbn/Nbr9js+npi8M1Nds20d50rBYNP/reMz75ycecnc7x9HT7Hdc3V7Ttnj6JDcYHaPuWXAqL+ZzoA+1+SzOvqWcN+7bDhYoXL97RtT3t5h3ddkO327LbipPk9uaa7c01+82Gbren3VkEyZacenwuVCFQ15EYPSE4FosZy/WcxXLGctlwerqmqiL3Ls4pJfPu6i1FbVExevElOllL7nqNKR1DoO96HI7FfMlstuT+/Uu8D2w3LbjA5eVT7t9/OCSeDN7x+vUr3r17S5+6gZnFGMmlI+ct+3bL6ekFFxf3iVXEO8fbN69IKdH1kgXYx0Auha7vdYJRTCgjF3Ho5GPXizntjnZUw4syUJkueCgODihmqHdgCx2Qcfz2APKiMSLD9XH7h31XGalufAb1I7IyJ4dIR+L7JWAR5BgJrRiRjxpX8SYZOT9IRlbJrLtrD2GUAN5LvR8Cywmu3HeYIZQZyWBIR4AQmvwe3zn+N8Jxt3yLoxyeT/tMvj+2X75vgykPGDMyGMOqvAeObt8tdis2MapwDpjPZ9RVLaq08+plKwZe5wq5a0k5E0LD2cmadvOKdvtONsamzM22Z7ZYkT3s9j2r+ZIffu853/n4MbPGkdOOdr9lu9mw2WzYbiVtj3OOru8oBWKsqOuaoumKq6aiS1mYnK/Z7BLtviUgMaVSL4SZ+0TX9fRdr7GxHX3f03YdXduJ2pAyfdfRd+2wCz3nzGq9YrVacnZ2qkv2DVUVWSzmXF1dUVyhqiIxVlR1xcn6lFIgJ3EvyAWCC8xnC5bLFev1KfPZjJvrDfu2p5mvOD+/5PLBI5qmAY1A2fctL19+TdvuoWT2+z1VFdU2JQNZiDx79py6nuG95+bmhu12oxlHRuzM6vmN4pTh1cAEbNwNr8zGpHiP0orhwoi7BkZHI24ewhSPD27cwnGQTLlGm9P6GlP+EFibBI4nYMFth0hWB+zFqZ+RA/7N9x/e8mWQ5TmrpLbpFoOyBt2+fgvcYUiJ0cA7cveBIQxMwmmdRAQcHrRj6Kjx+KvgG16w2WKE8fdtZjT8vKPcw3ofljnpY6TJRUM3FCQU63y+YNbMNY3QGOvGBj/3Pft2T+4TTQU+7bh691KCofmAczUZx9X2hpP1mkf3L3n+7BF1U+jaG/quZbvZstvt6TsxoDvn2e9bui7hY0VVNRqMbC+bcOc115s9XXGSE6xekfpE01S4EHRYPcXL/i2prDi/9SnRdj1d1w9zQrtv2Wy27PetbB9RKWO/37Pb7djvW5pGIhnM53Ocg81uq4kIKqqqFtcEZHtJXdU0zYxZM2e1WFLXDcvFgrZtefv2HVU1YzZbs1qdc/nwsbgBkAlOcO5Pf/oj767eknNi324l35vumyvZ0fWZjz76mPXqnFKg61vevXtL23aCN+jy/pDZRSagYtKCA4rgdi6ihQgOjf5HotZMJl6p2siUsElNyhlxS+4dTpDHNHqMpKJC6ZvD1SleS9kT+/ERmGf5wMBU2DAGaxOtSYoDTXg3hhARyWjMpABimB1ab5UaGjc25BYzOiKs4TLmpSpnpSgz0ufc5K91vpMRHFYYhmtatImzTGYifWh45kNweP941jp+e6wD8vSt8u18ZC7yjpyqhDdpyxTKJPTo9Fr0kZP1CXUlPjxeDaTOySZZqas4qPVdT9/uyd2GrtvKplXnSclzc7Ph7OKchw8ecO/slMW8IvVbUr+lbfe0u5auFbHcadSAtutwPhBjRYi1RBLoe+bzGW3q2Oz2EGtOzu6xXJ0xmy+p6kA1a/DBdvtPA6yJUSpnSQctzn3Q95ndbk/XdeIF3Xbs9nv2+46bzZbr6xt2+x1VXYm9ohTOz8958+YtfZ+IsaJpZtTKjGbNnPliQQwVi/mK+UyYV4yR6+trrq83zOdrmmbJcnXK5eVjFou5bgcQSebLF1/x8uULMTDnXuO6WygMRwg1q8UJl5dPAE/KHe/evaXrxRlVhl5wXFQx3cM52Ss2nYQs2oTTPZXFIpBOcX948RA/R7ySm9NyD2G8bng4lOOkvjJm02dGsFrcpg0D+baZeZiUMRVujK7tXsERqief/BIcP//eA9IkW8Doqn/cKGuAcQMhyilZOxic+A7eVhHtUMIxvdE6QyZP465lUI84UGtGpiEvyjOTjj167n1w9PTR8zZTSV2PB+a4a2TBXRtxxIDuet8QyI6cxdcoJQklKs/AfDZjvVoTfCT1ouYcMuRC9EFSSXvZr1VKR0l7tttrZk3DbtexXK14/PQx56cnNMFTyp6+u6HrdqIedYmcZEz6lDVbhKeqa5wLFByb7VYMxXXN2+t39KnQLNbcf/CQerZkvlwTQmA2n6srggb99xK0zXsJQeKQjZc+BIp3pCyrVegerK7v2bXtIB0J00oDTqWUWK1W5IyqUDXL5YoYaxaa2z6EiPeB5XIlqq3uZXv95g0pF2azJc1syXp9zuPHT5nPZ8PM7YNjs73hq6++oOs78AXvhEk5JGOHROKMPH/+fWKoKaXj+vqKthU1TTBT/pn0w3RVWnFAfig+KM56i3ypqpmVY2RyF14fXzumkdtwqIqZQ2mZaAMDHuaiXt3llje5gTO/IlMpnYQKRiU82+OWizBca68wQJmypBBlQraz+phw/mtBCO6Q0zrnxBFOK2zPgYRsMIZocDyIRsBmVLvrvh3vu374zPhXnx7fM+Y5tW8dSDqHYPcHMfuuQ78gDo/iRk8p+CD7yLQkoNCrQ11BVoiGHfDqdp91b1RVVcwWC5brcxan96hmC8lU6z337t+nqWoq70j9lr69IacdpJbSd7IfLhdyL/vAmqahriV2Ec7RteK9XFUV2+2WrhN1pK5r6rrR52uaxYJmvuT0/B73Hlxy/8FDLu494Oz8Hsv1CSHWhNjIUTXE2BCrmlg14CVjruI7eRLCNWfY7fa07Z7dbsvbt295+PCSi3vnLFcLTk7WzGdzZrMlVWxo6jnr1SkOkcTqumG327PdbGl0hXIKNhYyPnB6cspsNh8YmY2FsgO6tuXN29dsNlvQrSnCEOMtnJD6H+JKObLJeMtlpkHMxvvjbvn3gd238kYXnUMamsLAB63NebTjTutlcHz+YZjuT1OGpjg/kNVE2ACJ7UUZQkNqA6xRVu5/JdgAFIRxmPh2Z4OVMUmWhEkq4zsqIwM8CaKmdT4Y8Enbp+cHnWL3BgZzdP2oDVbA9Dkb0CncOj/+/vSeLQcrUjq1F4FImH0vGzaLLld3fU/XydJ9b0wp6T4k54mzJbPlGVWzoLjAcrEk6l60/X7LfntN227JGiRMss06+q7QdSKZ1XVFVddiyPaeru8kRG2BzWajHEOYUdOIgb1pGpbLJVVdE+ua5WrNarXm7Oyc+/cfcH5+wWp9ymp9wnJ9wnKxYrFYspgvBruYMDc9KmEaElrECwNUz+W2banqKMbtxYKmnjGbLYixJoaaKtaEGOi6jqauyCXx7t1bnHNUVS0+NsponBvFeJuPTk/PmM8Wamw1qXeEUjL7fcurVy8pmmJ7PmskBK+GaT0+5L3JVhEDNQt4L4H/hUYEpw982L4FjDQzMqSDbx/h6khHWi9dvHLGLIrgoDDq4bU7YeAd+r2puuZ0JVjtCof9IgH5fypq2g8u6TVhXYg6MzsRL6VTrBZ31UaQ0qCUMqh3t9S8wkTcVIZXRiHUrhW1X412LmECcu5wjMZBZ9e149Q6cXQohk18MxwM6XakEw+fleVT4TpOqzAi7JHx3Di84nTO1vKh0MN3j6AU/Y7TsCYFKOJjJGE2AvP5AuclI0ROsvTvBu9WNT5qP6VcCL7Qbd4QSmJZ15SkUlW3Z78Xo/W+62k7R18i2z1cb0UCqytPcUVXy8Smk9oeEqS+Z7PdEqqaWM958uw51WxF0YD+IQypiofwr1UVqKqaummoG93e0tTyu5brTVMTghsiVNa1MKEqRppGJK+qbvDeU1U1fZ+YNXMWiyW73Y4QamKcEUOlOCyd7ryjqSM3N1e8fvWSqm5oZnMa3dqxXJ3y6PETZjNJZ214Uii8u7ri9eu3dF1LCI6235OS9K/3Esx/fXLOo0eXujO9sNlsJBzuxBtawA2JG1HcmzLCQQIz+7YyElTNmxLvMQ7Z+ZQRCM2rqqTtGZDw4PcUBFmn9mWn7j2pT6PIOhglhH7ENc4pSWibnKNYaFyNbe68UKdS/lA+OLyseDj2bUvb9RTGPTNS1aMGDIRy3J7xgrGisfFyGE2KAXak0ePDiN+h4sdwbpWfVkm/lLM4nGVRdaTJ4zGWM7l2zLSGqhaJJ11kidpCMsi3DpmJPG650nuSxgnqU6LPZfKlD4AxSEXKYmpXQWL4uEJK4rwXgwbjV+OmMelsRv4irUrJUUolGT8csqG129DtN+rV3NGnQts59r1n1wdeXu15+W5L16shvOvUb0b2f4UQyKmna1uqumaxXDFfLDk5vSBWNaGqiEHClNR1RR0j3juqOjKbz2hmwmDmiznL9ZKTkzUnJyesT0440eP09Iyz0zNOT0850WO9XrNarViuVqzXa4mDFCtCiLRty6yZqfFaVtPMSVRW2QKzpiLlxPX1NeCIUWIogc38smI5jKuieV3X3Lv3gBjmUCr6vgCetu/xIdL1PTebDa9evaDr9+ChqmvmszkhxqNBNoO2jrdOwOrDOp4rUzKpTZI+HhX1DWDSjBxCFxZDXPnUezBSKMEhOCir3ZoFFzesfrsjRmRFyt+RsgoqAXkJnlYksCloHcXEIigs7ipaisw21TCI+oqoDBObzj8Hpp1jYNz7m+D4nYP33jNKh4NxWyQdrpW7n7WnixmVlcFM3RJulaV1E71f07T8FXUpR8Z322MUggPEeOuYiO3f0H9ODcFtD5t9x/XuLX25obCjTzu6lOiBVBx9Ktxcb7m+upZEj72jbWHfFtpOIjPmksj0EAvVPHJxecbZxQmrkzWxrqlqwZ2qitTB4mN7qhAGG4pzjrqK1FVkVkuCycV8zmKxYLGYs1jMOTk55ezsjNV6zXw+Z7lcslytmM3nNE1DjJHZbCZl1TXb7VZiDZ2cqLrYUFU1VYxUMRKjhFFp95JFNgRJWxQ0qSNFcrxh0uxkPGKsOTs9ZzFfUMWaUjxdm6hihQN6TcH+8tUL3rx9PUhC8/lcNppq+A6xw+jK0sEoKRT5nzGAEUe+aYw/fN/akSdZU6b4923AaTtSSgNee91aYvQ40OURPcn3xHBtNrdkeQanphXnyUVSbEHJxFgRh7xoZnRF1KBpp9zR/mkFvk1jj58/Po7h+L4M8ih/3QXH77zvuAsMIY6Rkzven96zfpqWOzxzVNboY8WdbbAyvLrd40RiHdL4HD9/qwxHLo62d2y7RJdbfCzEylFcoU2JPkMqsNvu2NzcUDnHvBGpo8uBza5jt5O9XX1qyWR8VXH28JJ7jx+zOD3n/uOHFLUnMIk6oPMiqLtB0jxmScPDhuAHVcwkmaqqmM/nLBYrZrO5SIVKEHVdM5/PKZr6XGxospK22+1wFgEgaOhatXMVXUTYtzucQ3OoyYQhDF3eGyTfSTe2bcvJyQlnZ2fUdaMbaWu6PtF1ko+tqis2myu++uoL2nZPTpkYoxLYXYsXk2vjp1Q6k+QDwsCO8Etx4pgB2b3p+fE1jpiKbVmZllvuMLAbFF29NEYkfyehWz6A53niH2jMuRy3XXmM+YWO3E2NTpMnx0oP1DMxvBzBtCK3DovAh4S/HNQfyuhwNbF93HVMB8kqYfWbfv8Y7Loroo7JlorjpywGUVHctG9JvY/rMv2W/EalqMPBHnp+0n2HMHamjYM5N1axEltYyhIqtkvSBidZMdp9y263I+fCbteRgLaVVDq5QPYVrp7T+wgxapzpiA81213H9fWNGHhjYLWYMasjfc7su148iXMvoTdcxsfA8uyC04uPqBdPaBYP8eGU/V6+vd/v2e827Pc72raj79UoWgrBB8kkEiS4GzhSUqR0DhckXK5leg2xppnNqZoGHyMZR58zVVXjfaRp5rp0LxJ90zQSUyiMDBtEwuy6bpD6jJAsD1iMgRDF/0WsRUIauYiKUc8aHjy6JNYV4PBe4mTbhJ1zy357zaef/pZPP/09r1+/pus6ckriJV8s3qUbBv4uFChHtAOKd2bD0vtuYi+yv1PaHcrTcqbSkLfl9CO8tXdFpRuft3Kt5Gy7MnS17wDPjxukYORt2ZTHfa52f2yvB0S/UzFSCOG29R219WQN0i0+A7cLtWfvBuvksaOnzGcUZ8fhKsog7Cjmr3HU+unZ9J1pvQ6OrOFCJ2WPz48DPS31WPqQOut7w7Xx3bvqPm3vFI4ZoyCCruLY4PeyjA+as6xIynFBfqlfTsLyb7Yb2pQIswXL0/vM15e4uMS5ihgaUva0XaLtJX1Q9I5ZLamvQVIrh+iZzSJnJyvOz09ZnZ5x/+FT4uyM7JeUsKKnos+enHXlZEgTdYgP9ndc2TH8mi6nq5OfOn16HwlqvBcihODFR8mkjxgjXdcB4tDoHLrYkikl0XUt282G3X4nz4QgfYf4PYU4Zr0oiL8LEwzMpXB5+UAy0rqI9xVVbHDOyaZiX3A+s7m+4urqHV9++aVsUymaLFELs+GVfrCwGnJV2mwGahlzwyM7RKq5rW7Z/SlDOsYtg+NnBJdGmje6P36u6N9et+2MEtbtCfr4OxSNGKDXit43sPdSzmozAnBZO9aGYSQQQQTpkBDCYNgykEoYI5ked3fKIRw+823e+G8BNtjix2KiqyQHlOOfA9IP3w4+3NJcxA4l9RTVMaUEmjZHVmG8LslL/WOI9KnDeyd2P+/ocqFNgRDPSWnFbive2FUzY75YsFqtxDi8mFGHQB0ds3kkNp5q5rh3/5Snzx6xXK05v/eQxck5OTqSz2Sfya6QXaE4WTHJdkx68sAvKif6nIdDUkGPqsMxXg3JGDVF9ZRImRAyOOLgNyS42utWkqvra7quJ1SR2NRDSmuvTpgUsf9YmUMNCpQEJydnLJcrQqwIdUOsqnHC1s3Mm+21qIztnqub66FtfZYQIUpRVjKmjchnjOaMOUkyzhgjVay0fWh8qomaNAFjDAeMQMHadTeMjMLKPrhrKnVdU1ViSz7wRZps/TgGr2ozCP7KueR08ZM02EEddr10QaFPaseQV/XvYUWFOKb7SgyO3/uvg2NJ5dtAOZJQvglGhB4Pu/Ztv/n/U5jaB5RppjSGQR3GpDhS1pkl+EFyFZsIZAptCYTmnGr2gLB4gF/cZ3nxmPWDx9y7fMr9R4+5uLzPxf1Tzi9OqecN9WrN+cOnrC4e4ZoT6uUFs/V9fLMmu0B2Mt1LHR2WSGis/tiXxoRMtJ9OANNZ3t4zEGQXBI5RPcyPiG27lb1pddWI468ifko9N5sbNlvZ+Ftw4gxZyTYVnKSB9iHK6mMWlXQ69G6yeHN+fq7ZTAIx1INE1u5atVtt2bd7Ts/OZCU1JQlYN+BlGTWAnIcElTiZXGQJX8Drd/tOpF50mb8UdC/fIZ4e4+xxHx2fy/PD2TAu4zGOiUm5RiYmEQlvONSOjsHG1jvL7itSvsDoZJlVIg6V7k37+PKEk7nMLM5p5gaNbjcwokFFkEKPO8HAO1v6my6hj8vot8FmiLvgmGkc3rND+tp0dClRjnH50R0h+/uhTCQ7PQoqoozH1E1ADv3nxCbmnfhfeHP2Ombuk+9NEctqEIJsCG0aMfDO50tibKii7N7v2o5SBLEdSLxo74e0NPv9jpvtlhAqUnHk2ODnK/xiTapnVPMVs9WKqqlxJeG8pNq5Lg158YDF2RNcdUoXVpRqTfYz2uTIRNkS4SQV9n7XjSuOKcuWEl09KUWYVgwShCwl2RLxPtzJYgcfJJ6+62XVqjdXBikXXWHs+47T03MonhAqKGJK2Oyu2W5uRF3tO2KcUcU5VT2X57KjqubMFyvWJ6fcv7jHbNYQvI2hHKUUXHBc3Vzz+ed/Zr/fiRSYE127o2v3xOAJseHk5IIf/ujHtHvZY5eLpkpSrUGGXJhS1vRA8g3BtVGzKCr1irQWNVOuqfhDX02cEw2fhFanqYLs96iCCm9Rtb6UCZXKucUqKk5R3X4DxemErxPRSCWy279M3GBKEjoI5omtvIEiYZZNwgIZVm8f+7vP3mpuKzmmO2+FOUlYVG/R4oZZbtQb/1vBh2wr7wOpw7dVkf7/H0rOtPs9b9++5d3VFZvtVmZFVdey7u+RwOlqOO97ctYEiUVm1ZvNlnc3W/YZdgS2vmEb5nRhSR/HI9Ur+ijH6uIJp/efU6pz2nBK79f0bklfKvrsKMUDgVw8uXhJtuiiGKYnEnRRiSDnzHa7Zb/bCxIOErjMtF3X6TEynaIShXg/357ZcxImXHTmdQRKNtwU/6g+9ZSSiaHC+UBVz3AEciqqclXgRuYzUJ59RzN0OOfEv0mdMAGc8wRXScxvCfrN9c0N7969w1kCRGUMQ3naJ86pGk2RzCJaT/u4PefV0G7yvtnITPURCeUQxn5HxsGuW79N+t7A6EbUVhU+tP1W3+FZLUe50Tg2wzPOElTJ0yq0HIicd4BzDllGAP7hs5f8uz+80rCQaTC42nJjQVZE3CAhTaFIqhk7/iqb0d0wGjoPrt5xTUA65VBV+HYwre9/Zb2d9sN/A7Dl7qurK168+Iq3b96w2+3EubKXSSCodzKIIVu2hfSk1LHvOrLLmlV2KXvfshCo+ExBcoHWNeTmnOr8u9SXn1BffsLy3ses1xfU9UzlSZNzFaHV4GhMwceAjwEXPS546UEvAbOK9qYGWR2kgikIct8GZ35btgqo/kpZA6cldRcQz16RJPq+FztU6ikT+91iscQFD97hQqSqG0lzNCEo955tF957Tk9PaWYNoRKDeimyUyGo+hhjRawrXPCcnJ+xXK9HGxqjkd7ggMDf036D1Cd2O8nU0rbGvOSdaTkDE9GIioOgMDgwjs8c04tN/GMZt8tH94zGWOF0MUsY/mg68DZmagv6EEnaOwD/6bMr3Ox/+H/IV291yOEsMXBt7nqWQwKWh27fu/Xa0YXh9PjB971v8J4bty7funAHfOCZD9z6v+D/gm+Eu+dRhQ/eVDh65r2vvOfGcPn4vp4fXz6+cOf7x/bjW4WIBDWeTK4fnv8fqPH+6NtCRYoAAAAASUVORK5CYII=", remindsOf:["ex-alli"], isSeedExample:true
      },
      {
        id: uid(), pinned:false, title:"Wasted Days And Wasted Nights", artists:["Freddy Fender"], album:"",
        year:"1974", genres:["Swamp Pop","Country","Tex-Mex"],
        tags:["longing","regret","nostalgic sadness","70s"],
        heard:"Waffle House",
        why:"loved to play this when i was working at Waffle House!", tier:"A",
        credit:"Jamie", lyricSnippet:"Why should I keep loving you?\nWhen I know that you're not true",
        coverArt:WDAWN_COVER, remindsOf:["ex-jamie"], isSeedExample:true
      }
    ];
    save();
  }
}

function hasExampleContent(){
  return songs.some(s=>s.isSeedExample) || people.some(p=>String(p.id||'').startsWith('ex-'));
}
function updateRemoveExamplesBtn(){
  const btn = document.getElementById('removeExamplesBtn');
  if(!btn) return;
  const gone = examplesRemoved();
  const hasAny = hasExampleContent();
  btn.style.display = (!gone && hasAny && !showArchived && !viewingWishlist) ? '' : 'none';
}
function removeExamples(){
  if(!hasExampleContent()){
    alert('No examples to remove!');
    return;
  }
  if(!confirm('Remove all example songs and people?')) return;
  trackEvent('remove_examples');
  const removedSongs = songs.filter(s=>s.isSeedExample).length;
  const removedPeople = people.filter(p=>String(p.id||'').startsWith('ex-')).length;
  songs = songs.filter(s=>!s.isSeedExample);
  people = people.filter(p=>!String(p.id||'').startsWith('ex-'));
  songs.forEach(s=>{
    if(Array.isArray(s.remindsOf)) s.remindsOf = s.remindsOf.filter(id=>!String(id||'').startsWith('ex-'));
  });
  setExamplesRemoved(true);
  save();
  savePeople();
  render();
  renderPeople();
  updateRemoveExamplesBtn();
  alert('Removed ' + removedSongs + ' example song' + (removedSongs !== 1 ? 's' : '') + ' and ' + removedPeople + ' example people');
}
document.getElementById('removeExamplesBtn').addEventListener('click', removeExamples);
