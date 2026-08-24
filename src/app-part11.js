
/* ---- NOTIFICATIONS FEED ---- */
const NOTIF_ICONS = { sotd_reaction:'🔥', friend_request:'👤', friend_accept:'🤝', badge:'🏆', message:'💬', song_recommend:'🎵', feed_reaction:'✨' };
let notifUnreadCount = 0;

function notifTimeAgo(ts){
  if(!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if(diff < 60000) return 'just now';
  if(diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  if(diff < 86400000) return Math.floor(diff/3600000) + 'h ago';
  return Math.floor(diff/86400000) + 'd ago';
}

function setNotifBadge(n){
  const el = document.getElementById('notifBadge');
  if(!el) return;
  notifUnreadCount = n;
  if(n > 0){ el.textContent = n > 99 ? '99+' : n; el.style.display = ''; }
  else { el.style.display = 'none'; }
}

async function loadNotifications(){
  if(!sb || !currentUserId) return;
  const { data, error } = await sb.from('notifications')
    .select('id, type, message, payload, created_at, read_at')
    .eq('user_id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(50);
  if(error){
    if(error.status === 404){ setNotifBadge(0); }
    return;
  }
  if(!data) return;
  const unread = data.filter(n=>!n.read_at).length;
  setNotifBadge(unread);
  const list = document.getElementById('notifList');
  if(!list) return;
  if(data.length === 0){
    list.innerHTML = '<div class="notif-empty">No notifications yet.</div>';
    return;
  }
  list.innerHTML = data.map(n=>{
    const icon = NOTIF_ICONS[n.type] || '🔔';
    const unreadCls = n.read_at ? '' : ' unread';
    const dot = n.read_at ? '' : '<span class="notif-dot"></span>';
    return `<div class="notif-item${unreadCls}" data-notif-id="${n.id}">
      <span class="notif-icon">${icon}</span>
      <div class="notif-body">
        <div class="notif-msg">${escapeHtml(n.message || '')}</div>
        <div class="notif-time">${notifTimeAgo(n.created_at)}</div>
      </div>
      ${dot}
    </div>`;
  }).join('');
}

async function markAllNotifsRead(){
  if(!sb || !currentUserId) return;
  const { data } = await sb.from('notifications')
    .select('id').eq('user_id', currentUserId).is('read_at', null);
  if(!data || data.length === 0) return;
  await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', data.map(n=>n.id));
  setNotifBadge(0);
  loadNotifications();
}

async function sendNotif(userId, type, message, payload){
  if(!sb || !userId) return;
  try{
    await sb.from('notifications').insert({ user_id: userId, type, message, payload: payload || {} });
  }catch(e){ console.warn('Notification failed:', e); }
}

document.getElementById('notifBtn').addEventListener('click', ()=>{
  trackEvent('open_notifications');
  document.getElementById('notifOverlay').classList.add('open');
  loadNotifications();
});
document.getElementById('notifCloseBtn').addEventListener('click', ()=>{
  document.getElementById('notifOverlay').classList.remove('open');
});
document.getElementById('notifOverlay').addEventListener('click', e=>{
  if(e.target.id === 'notifOverlay') document.getElementById('notifOverlay').classList.remove('open');
});
document.getElementById('notifMarkReadBtn').addEventListener('click', ()=>{ trackEvent('mark_all_read'); markAllNotifsRead(); });

/* ---- REALTIME NOTIFICATIONS (Supabase Realtime) ---- */
let notifChannel = null;
let notifPollTimer = null;
let lastNotifToastId = null;

async function refreshNotifBadge(){
  if(!sb || !currentUserId) return;
  try{
    const { count, error } = await sb.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', currentUserId).is('read_at', null);
    if(!error && typeof count === 'number') setNotifBadge(count);
  }catch(e){ /* ignore */ }
}

function startNotifPoll(){
  if(notifPollTimer || !currentUserId) return;
  notifPollTimer = setInterval(()=>{ refreshNotifBadge(); }, 30000);
}
function stopNotifPoll(){
  if(notifPollTimer){ clearInterval(notifPollTimer); notifPollTimer = null; }
}

function handleNotifChange(payload){
  const overlay = document.getElementById('notifOverlay');
  const open = overlay && overlay.classList.contains('open');
  if(open){ loadNotifications(); }
  else { refreshNotifBadge(); }
  if(payload && payload.eventType === 'INSERT' && payload.new){
    const n = payload.new;
    if(n.id && n.id !== lastNotifToastId){
      lastNotifToastId = n.id;
      const icon = NOTIF_ICONS[n.type] || '🔔';
      showToast(icon + ' ' + (n.message || 'New notification'), 5000);
    }
  }
}

function subscribeNotifications(){
  if(!sb || !currentUserId || notifChannel) return;
  refreshNotifBadge();
  try{
    notifChannel = sb.channel('notifications:' + currentUserId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.' + currentUserId
      }, (payload)=> handleNotifChange(payload))
      .subscribe((status)=>{
        if(status === 'SUBSCRIBED'){ stopNotifPoll(); }
        else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'){ startNotifPoll(); }
      });
  }catch(e){
    console.warn('Realtime subscribe failed, falling back to polling:', e);
    startNotifPoll();
  }
}

function unsubscribeNotifications(){
  stopNotifPoll();
  if(notifChannel){
    try{ sb.removeChannel(notifChannel); }catch(e){}
    notifChannel = null;
  }
}

/* ---- FRIEND ACTIVITY FEED ---- */
const FEED_REACTION_EMOJIS = ['🔥','❤️','🤯','😎','😭','💯'];
function feedImportCardHtml(clusterName, entries, who, profile, ownerId, when){
  const initial = who === 'you' ? 'You' : ((who || '?').charAt(0).toUpperCase());
  const avatar = (profile && profile.photo)
    ? `<span class="feed-card-avatar"><img loading="lazy" decoding="async" src="${escapeAttr(profile.photo)}" alt="Profile photo"></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const whoLabel = who === 'you'
    ? `<span class="feed-card-who"><b>You</b> imported a playlist</span>`
    : `<span class="feed-card-who"><b>@${escapeHtml(who)}</b> imported a playlist</span>`;
  const whenStr = when ? `<div class="feed-card-when">${new Date(when).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>` : '';
  const previewCovers = entries.slice(0,3).map(e=> e.song.coverArt ? `<img loading="lazy" decoding="async" src="${escapeAttr(e.song.coverArt)}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;" alt="Album cover">` : '').join('');
  const songList = entries.map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(var(--on-paper-rgb),0.08);">
    ${e.song.coverArt ? `<img loading="lazy" decoding="async" src="${escapeAttr(e.song.coverArt)}" style="width:28px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0;" alt="Album cover">` : ''}
    <span><b>${escapeHtml(e.song.title||'Untitled')}</b> <span style="opacity:0.6;">${escapeHtml(formatArtists(e.song.artists))}</span></span>
  </div>`).join('');
  return `
    <div class="feed-card feed-card-import" data-cluster-expand="${escapeAttr(entries[0].song.clusterId||'')}">
      <div class="feed-card-head">
        ${avatar}
        ${whoLabel}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin:8px 0;cursor:pointer;" onclick="this.closest('.feed-card-import').querySelector('.feed-import-songs').classList.toggle('open')">
        <div style="display:flex;gap:4px;">${previewCovers}</div>
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;">${escapeHtml(clusterName)}</div>
          <div style="font-size:12px;opacity:0.6;">${entries.length} song${entries.length!==1?'s':''} · click to ${entries.length<=5?'see':'expand'}</div>
        </div>
        <span style="font-size:18px;opacity:0.4;">›</span>
      </div>
      <div class="feed-import-songs" style="display:none;">${songList}</div>
      ${whenStr}
    </div>`;
}
function feedCardHtml(entry){
  const s = entry.song;
  const who = entry.who;
  const isMe = who === 'you';
  const p = entry.profile;
  const ownerId = entry.ownerId || null;
  const reactions = entry.reactions || [];
  const initial = isMe ? 'You' : ((who || '?').charAt(0).toUpperCase());
  const avatar = (p && p.photo)
    ? `<span class="feed-card-avatar"><img loading="lazy" decoding="async" src="${escapeAttr(p.photo)}" alt="Profile photo"></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const cover = s.coverArt
    ? `<img loading="lazy" decoding="async" class="feed-card-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">`
    : `<div class="feed-card-cover-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
  const tierBadge = s.tier ? renderTierBadge(s.tier) : '';
  const feedPreviewId = 'feed:' + (s.id || Math.random().toString(36).slice(2));
  feedSongCache[feedPreviewId] = { id: feedPreviewId, title: s.title || 'Untitled', artists: s.artists || [], previewUrl: s.previewUrl || '' };
  const previewBtn = s.source === 'itunes' ? `${s.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}<button type="button" class="preview-btn" data-preview="${escapeAttr(feedPreviewId)}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶</button>` : '';
  const why = s.why ? `<div class="feed-card-why">"${escapeHtml(s.why)}"</div>` : '';
  const reminds = (s.remindsOf && s.remindsOf.length)
    ? `<div class="feed-card-reminds">reminds me of <span>${s.remindsOf.map(id=>{
        const pp = people.find(x=>x.id===id);
        return pp ? escapeHtml(pp.name) : 'someone';
      }).join(', ')}</span></div>` : '';
  const when = s.createdAt ? `<div class="feed-card-when">${new Date(s.createdAt).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})} at ${new Date(s.createdAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</div>` : '';
  const edits = (s.edits && s.edits.length) ? `<div class="feed-card-edits">${s.edits.length} edit${s.edits.length!==1?'s':''}</div>` : '';
  const whoLabel = isMe
    ? `<span class="feed-card-who"><b>You</b> added a song</span>`
    : `<span class="feed-card-who"><b>@${escapeHtml(who)}</b> added a song</span>`;
  const reactionsHtml = isMe ? '' : `
    <div class="feed-card-reactions" data-owner-id="${ownerId||''}" data-song-id="${escapeAttr(s.id||'')}">
      ${FEED_REACTION_EMOJIS.map(emoji=>{
        const count = reactions.filter(r=>r.emoji===emoji).length;
        const mine = reactions.some(r=>r.emoji===emoji && r.reactor_id===currentUserId);
        return `<button type="button" class="feed-reaction-btn${mine?' active':''}" data-emoji="${emoji}" title="React ${emoji}">${emoji}${count>0?`<span class="feed-reaction-count">${count}</span>`:''}</button>`;
      }).join('')}
    </div>`;
  return `
    <div class="feed-card${isMe ? ' feed-card-mine' : ''}"${isMe ? ' data-mine="1"' : ''}>
      <div class="feed-card-head">
        ${avatar}
        ${whoLabel}
      </div>
      <div class="feed-card-body">
        ${cover}
        <div class="feed-card-info">
          <div class="feed-card-title">${escapeHtml(s.title || 'Untitled')}</div>
          <div class="feed-card-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · ' + escapeHtml(s.album) : ''}</div>
          <div class="feed-card-tier">${tierBadge}${previewBtn}</div>
          ${why}
          ${reminds}
          ${when}
          ${edits}
          ${isMe ? '' : '<button type="button" class="feed-add-btn" data-feed-add="1">+ Add to my library</button>'}
        </div>
      </div>
      ${reactionsHtml}
    </div>`;
}

async function loadFeed(){
  if(feedMode === 'discover') return loadDiscoverFeed();
  const list = document.getElementById('feedList');
  const countEl = document.getElementById('feedCount');
  if(!list) return;
  list.innerHTML = '<div class="feed-empty">Loading…</div>';
  const cutoff = Date.now() - mixtapeDays*86400000;
  const friendIds = [...myFriendIds];
  const results = await Promise.all(friendIds.slice(0,25).map(async id=>{
    try{
      const songs = (await fetchReadOnlySongs(id)) || [];
      const p = allProfilesCache.find(x=>x.user_id === id);
      return songs
        .filter(s=>!s.archived && s.createdAt && s.createdAt >= cutoff)
        .map(s=>({ song:s, who: p?.username || 'friend', profile: p }));
    }catch(e){ return []; }
  }));
  const all = [...results.flat()].sort((a,b)=>(b.song.createdAt||0)-(a.song.createdAt||0));
  const friendEntries = all;
  if(friendEntries.length > 0){
    try{
      const { data: rxData } = await sb.from('feed_reactions')
        .select('song_owner_id, song_id, reactor_id, emoji')
        .in('song_owner_id', [...new Set(friendEntries.map(e=>{
          const p = allProfilesCache.find(x=>x.username===e.who);
          return p ? p.user_id : null;
        }).filter(Boolean))]);
      if(rxData){
        friendEntries.forEach(e=>{
          const p = allProfilesCache.find(x=>x.username===e.who);
          const oid = p ? p.user_id : null;
          e.ownerId = oid;
          e.reactions = rxData.filter(r=>r.song_owner_id===oid && r.song_id===e.song.id);
        });
      }
    }catch(err){ console.warn('Could not load feed reactions:', err); }
  }
  const windowLabel = mixtapeDays === 7 ? 'week' : 'month';
  const friendCount = results.flat().length;
  const friendNote = friendCount === 0 ? ' · No friends have added songs yet' : ' · '+friendCount+' from '+friendIds.length+' friend'+(friendIds.length===1?'':'s');
  if(all.length === 0){
    if(countEl) countEl.textContent = `0 songs in the last ${windowLabel}${friendNote}`;
    list.innerHTML = '<div class="feed-empty">Nothing new in the last ' + (mixtapeDays===7?'7 days':'30 days') + ' yet. Add some music or tell a friend to!</div>';
    return;
  }
  const grouped = [];
  const clusterGroups = {};
  for(const e of all){
    const cid = e.song.clusterId;
    if(cid){
      if(!clusterGroups[cid]) clusterGroups[cid] = { entries:[], who:e.who, profile:e.profile, ownerId:e.ownerId, clusterName:e.song.clusterName||'Imported Playlist', when:e.song.createdAt };
      clusterGroups[cid].entries.push(e);
    } else {
      grouped.push(e);
    }
  }
  for(const [cid, g] of Object.entries(clusterGroups)){
    grouped.push({ _cluster:true, cid, clusterName:g.clusterName, entries:g.entries, who:g.who, profile:g.profile, ownerId:g.ownerId, when:g.when });
  }
  grouped.sort((a,b)=>{
    const ta = a._cluster ? (a.when||0) : (a.song?.createdAt||0);
    const tb = b._cluster ? (b.when||0) : (b.song?.createdAt||0);
    return tb - ta;
  });
  if(countEl) countEl.textContent = `${grouped.length} item${grouped.length===1?'':'s'} (${all.length} song${all.length===1?'':'s'}) in the last ${windowLabel}${friendNote}`;
  const displayed = grouped.slice(0, 80);
  list.innerHTML = displayed.map(e=> e._cluster ? feedImportCardHtml(e.clusterName, e.entries, e.who, e.profile, e.ownerId, e.when) : feedCardHtml(e)).join('');
  list.__feedData = all;
}
  
document.getElementById('feedList').addEventListener('click', e=>{
  if(e.target.closest('[data-preview]')) return;
  const discoverAddBtn = e.target.closest('[data-discover-add]');
  if(discoverAddBtn){
    e.stopPropagation();
    const listEl = document.getElementById('feedList');
    const card = discoverAddBtn.closest('[data-discover-row]');
    const idx = Array.from(document.querySelectorAll('#feedList [data-discover-row]')).indexOf(card);
    const row = (listEl.__discoverData || [])[idx];
    if(!row) return;
    document.getElementById('feedOverlay').classList.remove('open');
    openAddFromData({
      title: row.title || '',
      artists: row.artist ? [row.artist] : [],
      album: row.album || '',
      year: row.year || '',
      genres: row.genres || [],
      tags: [],
      coverArt: row.cover_art || null,
      why: '',
      credit: 'from Discover',
      tier: null
    });
    return;
  }
  const addBtn = e.target.closest('[data-feed-add]');
  if(addBtn){
    e.stopPropagation();
    const card = addBtn.closest('.feed-card');
    const idx = Array.from(document.querySelectorAll('#feedList .feed-card')).indexOf(card);
    if(idx < 0) return;
    const listEl = document.getElementById('feedList');
    const allData = listEl.__feedData || [];
    const entry = allData[idx];
    if(!entry) return;
    document.getElementById('feedOverlay').classList.remove('open');
    const s = entry.song;
    openAddFromData({
      title: s.title || '',
      artists: (s.artists||[]).slice(),
      album: s.album || '',
      year: s.year || '',
      genres: (s.genres||[]).slice(),
      tags: (s.tags||[]).slice(),
      coverArt: s.coverArt || null,
      why: s.why ? `${s.why} (from @${entry.who}'s feed)` : '',
      credit: `from @${entry.who}'s feed`,
      tier: s.tier || null
    });
    return;
  }
  const reactionBtn = e.target.closest('.feed-reaction-btn');
  if(reactionBtn){
    e.stopPropagation();
    handleFeedReaction(reactionBtn);
    return;
  }
});

async function handleFeedReaction(btn){
  const wrap = btn.closest('.feed-card-reactions');
  if(!wrap) return;
  const ownerId = wrap.dataset.ownerId;
  const songId = wrap.dataset.songId;
  const emoji = btn.dataset.emoji;
  if(!ownerId || !songId || !currentUserId) return;
  const isActive = btn.classList.contains('active');
  if(isActive){
    btn.classList.remove('active');
    const countEl = btn.querySelector('.feed-reaction-count');
    if(countEl){
      const n = parseInt(countEl.textContent,10) - 1;
      if(n <= 0) countEl.remove();
      else countEl.textContent = n;
    }
    trackEvent('feed_reaction_remove', { emoji });
    await sb.from('feed_reactions')
      .delete()
      .eq('song_owner_id', ownerId)
      .eq('song_id', songId)
      .eq('reactor_id', currentUserId);
  } else {
    btn.classList.add('active');
    let countEl = btn.querySelector('.feed-reaction-count');
    if(countEl){
      countEl.textContent = parseInt(countEl.textContent,10) + 1;
    } else {
      countEl = document.createElement('span');
      countEl.className = 'feed-reaction-count';
      countEl.textContent = '1';
      btn.appendChild(countEl);
    }
    trackEvent('feed_reaction', { emoji });
    await sb.from('feed_reactions')
      .upsert({ song_owner_id: ownerId, song_id: songId, reactor_id: currentUserId, emoji },
              { onConflict: 'song_owner_id,song_id,reactor_id' });
    try{
      const reactorName = (myProfile && myProfile.username) || 'Someone';
      await sb.from('notifications').insert({
        user_id: ownerId,
        type: 'feed_reaction',
        message: `${reactorName} reacted ${emoji} to your song`,
        payload: { emoji, song_id: songId, reactor: currentUserId }
      });
    }catch(e){}
  }
}

document.getElementById('feedBtn').addEventListener('click', ()=>{
  trackEvent('open_feed');
  document.getElementById('feedOverlay').classList.add('open');
  setFeedModeUI('friends');
  loadFeed();
});
document.getElementById('feedCloseBtn').addEventListener('click', ()=>{
  document.getElementById('feedOverlay').classList.remove('open');
});
document.getElementById('feedOverlay').addEventListener('click', e=>{
  if(e.target.id === 'feedOverlay') document.getElementById('feedOverlay').classList.remove('open');
});

/* ---- ANALYTICS CONSENT ---- */
const ANALYTICS_CONSENT_KEY = 'bayoutonefm-analytics-consent';
function getAnalyticsConsent(){ return localStorage.getItem(ANALYTICS_CONSENT_KEY); }
window.acceptAnalytics = function(){
  localStorage.setItem(ANALYTICS_CONSENT_KEY, 'accepted');
  document.getElementById('analyticsConsentBanner').style.display = 'none';
};
window.rejectAnalytics = function(){
  localStorage.setItem(ANALYTICS_CONSENT_KEY, 'rejected');
  analyticsLog = [];
  try{ localStorage.removeItem(ANALYTICS_KEY); }catch(e){}
  window.trackEvent = function(){};
  document.getElementById('analyticsConsentBanner').style.display = 'none';
};
window.saveConsentPrefs = function(){
  const analyticsOn = document.getElementById('consentAnalyticsToggle').checked;
  if(analyticsOn){ window.acceptAnalytics(); } else { window.rejectAnalytics(); }
};
function showAnalyticsBannerIfNeeded(){
  if(!getAnalyticsConsent()){
    const toggle = document.getElementById('consentAnalyticsToggle');
    if(toggle) toggle.checked = false;
    document.getElementById('analyticsConsentBanner').style.display = '';
  }
}
setTimeout(showAnalyticsBannerIfNeeded, 1500);

/* ---- DISABLE TRACKING IF OPTED OUT ---- */
const origTrackEvent = trackEvent;
if(getAnalyticsConsent() === 'rejected'){
  window.trackEvent = function(){};
}


/* ---- SITE LOGO + APP ICONS (inline so they can never fail to load) ---- */
(function(){
  var BRAND_LOGO = 'data:image/png;base64,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';
  var APP_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAC4pSURBVHhe7Z0HeJRV9v95/v/t+ytb1V1dV3d1i+6urqt06U2lgyiComBXVMSCWKhSApmUeacmIRAQFGkWUARUVkUXVBBSSDIl0zI9nV6+v+fcNxOSdxLSYWbec5/n8wSTtyQx53vPPfecc7t0iZMBrP9Bud1wVYVTP7TSZXym3GFIC9t1W4JW3Z6gTXcwZJOsIZvkD9l0YYbpDIJWQnKHrNLhkE33Tdiu2xW261eH7boF5Xb91Aqn7paqorRfK/92ebRhwJ79o0q7vnul2zizrES/qcyht4Xt+uPH/VlAxSrB6XA2TgSycMyXiSPeDFR7TKhyM0znUeMx46g3A/R3eDK4AmfKVoq/RfpY5TIhbNOXlzn031S6DFKF03jPMa/5auXfNo8mhsdj+kmly3B7hcuYVeHQ2+mXHTH0I6VmVDiNCNv1CNl0DBNzlJXohQgc92fWiUKZw3C8ymX8ospjmlVVarhO+TfPo0uXLhVOQ9cKpyGt0mW0k6rSL+9IaYb4hSp/yQwTT1Q4DTgRzAIqc+jfpytdht1VbuOjPmvGpUo7UNXIzZ3zg2qXcXKl2/hvct1lozcjbI/+JTJMIlDuMIhlA/2tV7qM4Wq3yVReYrxJaRsJPb42Pfz9KpfhoWq3Kf9s+UqcDK3gmZ5RHRRPqBWCszUe05sVDv2/lLaScKPabZhQ4zF9Rz/4MX9m1C+FYdQGeQVny2UhqHKZVlYUS9co7SbuR9Cqu6XabdxOQRGK2it/CQyjZoJWWQhQuQrVblN1tcc098D2mT9V2lHcjQMHlv202m1aUu0xnSbj5/U9wzQNCQHtIqAqh4QgP2zR3aG0qbgZvmJtjyq3KRfVq8X2Hf1wyh+YYZhoyFbIU6aAIeUT7Nkz48dK+4rpUWbXz6opNZ+iH4ANn2HaRnmJQfYGPOYDpZa02A8SWr9e8r+VLuNb9E1XunjWZ5j2QjZEiXDVpeajIYt2itLmYma48lKvrXKbDpHx81qfYTqOoFUSKcgUR6tw6Jcqbe+iD1rv13hMvjNl2eKbVf4ADMO0H7FTULUa5Q79mk8+mfM9pR1elBGwpN92pNRcQ0ELNn6G6VzIu6bAernD+KH3wLKLu1XoLUobccSbefKYL4ONn2EuIOQJVLgMu3Nzpf9S2uUFGb7C9EFHvBknqDSSjZ9hLiwUHCQRKHMYdiF3/Q+U9tmpw1uY3rXGbaqhOnw2foa5eNByIGzTb1baaKcN/6G0P1a5TX5e8zNMbEAiELRIGUpb7fABv/Rf5SWGXNqOYONnmNiAmuTQ9ru/SPui0mY7dISs0mZ6ERs/w8QWlU6jSB/2FqZ3Tv2A35L+AgUdOMmHYWIPCgpSTI4ajYSKzFco7bddI2STutV4zGcpvVf5YoZhYgPyzKnXRsgqfaq04TYP+ydzfhS26w5T5x7O7WeY2Ic8dX+x9jmlLbdp+Iq1SSLKyOt+hokLaluYHw9YtX9S2nOrht+WfkO1x3yG6vmVL2EYJjahyZrajAUs2h1Km27V8Fu0u+Utv+iXMAwTu9DWIDXd9Vul8Uq7btEI2LR3kopw1J9h4hPReNcq2Z3O5NZ1FMLXpu+HbLpCbuDJMPENBQQDVmmG0sbPO0JWaSqdZKJ8GMMw8QWdsBWy63xng5n/rbTzRgc+mfO9oEUqpPPNlA9jGCb+IC8g1FIvQF77r4x6CMMw8QllCAaskr2oKO2HSnuPGgGLtOdUaEXUQxiGiV8ooB+0aO9R2nuDESjW3kTNB/msPoZJLE6Fs6lk+PwpwiGLJHHwj2ESD2ooWuk0ngmVGK5T2r0Ynq9NPwlatN6aUnPUzQzDxD+ilN8mLVTavhgBi+4OWvtz4g/DJCaUGBSwSPnAnP+ntP8uQZsuS5QSNnIjwzDxD8X2qj0mUKyvgfEDpu8HLNqSI96MqJsYhkkcRIzPqp/dQACClrR/UQkhR/8ZJrGhZX7AqvukgQCE7Ppn2P1nmMSHJvqgVaqocOh/fs4DsEkbqexXeTHDMIkFlQlTMDBoSR8gjF/k/lslK53wo7yYYZjEA5WryAuYJQSg3G64KmSTTlY4DVEXMgyTeIgmPxZpvRAAf7F26HF/Fu//M4xKEJW+Vt0BWQBs2ukcAGQY9VAbCAyX21N+1iVolVJZABhGPVBdQNiuPxsqSruOBGDT6XB21EUMwyQmYifAR8uA9EFdQjbd59z7j2HUBU36AYs0kTyAPKEGjVzEMExiQl2/gnb9Y12CVl2JaBzYyEUMwyQmFPcLWvUzKQvQRxVCygsYhklc6gQgZNWFqt0sAAyjJuoLQJj2BZUXMAyTuLAAMIyKYQFgGBXDAsAwKoYFgGFUDAsAw6gYFgCGUTEsAAyjYlgAGEbFsAAwjIphAWAYFcMCwDAqhgWAYVQMCwDDqBgWAIZRMSwADKNiWAAYRsWwADCMimEBYBgVwwLAMCqGBYBhVAwLAMOoGBYAhlExLAAMo2JYABhGxbAAMIyKYQFgGBXDAsAwKoYFgGFUDAsAw6gYFgCGUTEsAAyjYlgAEpAyuw7ldvljuJGvM0wEFoAEosahwymXDhV2HXzFEkJWCSecOhxzRF/LMAQLQAJAszwZfm6+DvM+SsOotzQYsDoZt63V4PF3UrF7vxZHWQSYRmABiHPKbDoxy2d9lo6/ZGrw0/Rk/EKXjN+bNfiDWYPfGJLFxw++1uKYM/p+Rt2wAMQ5p1x6GHan4+dSMq7N0ODBLal4aEsq/r5Cg2syNLg+S4PLDOQJpOAkCwCjgAUgjqG1/ecHtLjSmIwbVmjw2X4tTrv0OOvWY8c3WmH8f87U4LfGZEx/N5UFgImCBSBOoXX/MaceD29JFW5/0q40oFT+PC0LTrt0eGBzCn5n0uBSQzLe+ELLAsBEwQIQp1SV6GA5LOHmlRpcok9G9ufpwujpa7I46DBpYwp+mLYc07akoqJE3hZUPodRNywAcQpF9b/8Tos/ZSSLQN+rH6bWCQBBW4JrvkjHU++lImCVBSPYyHMYdcMCEKeQAOw5oMWfM5NxlUmDwW9o4LdKIgEock11iewJUF4AGz/TGCwAcQrN8N/lSvh7lgZ/ytTg9yYN3tunFVuC9a/jTEDmfLAAxCk0q7uLdeizWt7uo0j/89tSRUKQ8lqGaQoWgDiFZnZy8SduSBGz/9VmDYatSxFf42Af01JYAOKYky4dXtiWisuNyWIZcGO2Bvn5khAG5bVM6whS4NShx2m/Gad9Zpzym3G01IjyEn3UtfFMYgmAXY9wiQGhVkDXi3vsehnlM2MYSvpJ/ThNuP9/ydLg2oxkfHaA8/47giqnHoXfJuPZOU/gxQXTkbPmVez5dAmCFgkVDn3CBFUTRwDsegSL0hDIT0aoKK3FBAtTxX1UOUdCUOYyo8yTibA7QxYG5XtiCPIAVn6ehiuMyfhrlgZXmTXY9rUWxznhp92c8ZvwyuKn8aMbhuGSniNwWa+RuKLvKNz9xFQEiqWE8QQSRgDIWAOHU1CUMQ4FywbicOrQWoahIHkw8pf2jyZpAPKXDRBfP5x+O4pMY2DNmQTHO4/B88UrCBSmoIyEwGWOel8sQBH/DV9pcaVJFgCKBWz5T/ROANM6wnY9qp0GjHvkAVx+6yj8acg4wR8GjsWlPUdgx7YFOOGNX1upT8IIAEGG6t07H3kLeyNv4a3Ie/1W5C3oJUTA+sa9sK6eJJND3ANL9l0oMo4RX89b1AeHXu2KQy/fjEOvdUXugl5CGGzrpsD79QJZCBzGqHdeTGimf3+fVuQBRARg83/SWQDaSaXTAPvBFNw8+i5cPWBMnQAQl/QciefnT8eZQGxOCq0loQSAIEMl486d3xP5S/ohb35PWN+cgvLAKvG1CCQWghIjghYt/IeS4P50ljB4MvzcuT2EeOTO6yHEhD4fKEwVSwPlOy8WJABU5nu1WY4BsAB0DMe8Rnz60ev4fb/RuHbwOeMXXsCAMbhu2Djk7lsugoLKe+ONxBMATyYc7z8pDLdOANbe27Th1gb/aHYX4uDJRPBwKhxbpyN/2UBZSBb3Re7c7ihIGQrf/kXiuqjnXARYADqH04EMGDNmCXe/vvETfx4yDpf2HIlHZz2G0z5T3G+5JqQAuLbPaLkANIIQg9IsBPKWo8g8Vn7W0v7Ind9LxA183y2JibgACcCHQgA0LAAdyEm/CU+9+rgwdKUAEOQVUFAwa+VsIJSBkDX6GfFCggrAs8idV28J0EoBiCCM3G5Acdad8vOECPREoW4EQjZJ3kps5L4LBQtAxyOaqdp0uO3++3BF39FRxh/hqgFj8IeBY7B960KcDcSvCCSmAHxEAtB2D6A+YadJbBWS+09BRXpm7pxucGx7SrxLef2FhAWg46lxGZC/Lxl/u328MHCl4Uf489Bx+F3f0fjrsHH4fNdigIKCcSgCLAAtgJYDro/qLSsW9sZh7R0id+BiJg+xAHQ8J3wmvPfOPFzeZ1RUAFAJxQOu6DMKf7tjPHbvWASQJ9DIM2MZFoAWQDEBSjCioGD+oj4iKEjegPebhcJDUF5/oWAB6HjOBExYlj5TbPcpDb4xyBOgBKFrB4/F5k1zcTZgjqsKTBaAliB2CgwoMowWs79YBszvCfenL7bvuZRN5tC32XVkAehg7DocKzVi2syH8ZveLROAiAhc2W80ruw7CjlrXhGeQLzsDrAAtASxTWhCceZ4kRsQEQDXrufb/twSPYK5qQh8tAAhV9v2k1kAOpZyhx6+Qi36TZwkDFpp6OeDROCq/mPw21tHwpj5ovAEyi7i8rClsAC0hNpcgSLDqHMewIKe8Hw2u23PpRk/nAl/ytPwL5+OULANz2AB6HCOeIz4+oskYdB/HDQ2ysibg2IClCh0Wa8RSNG9gFM+Y8x7AiwALUDEAAo0KFg+6FwMYFEfkRTUphiA2yhmf2+3QQhoZ7AAxAinfGase/O1Vrn/jUE1A5f0GIHsnNminFj5nliCBaAF0DNptq9LL17YuzYXoNY7aOSe8xLKhP/FB+G9sgcC5udaLABUglpVoheHgZxw6QCvThz7RVWAJABXmjRCEOjz9PUIVDVI+9uJUsLaWZzxmTFnydONZgC2lt/3H4M/Dx6LA3uScMzTtiXehYAFoDlo/e8yy8lAkfX/nO5wfvB06/MArDqEQ5kIbnwN3hv6w3tdXwRMLReAyhId9h9Kx+ov0vHWl+nYsleLRTvSREswKgb6o1kjzgakAqGNX2lFpSDx1pdaWAol0UZM+UxGJmzXocZpxITHp+K39SoAI9CW4DWDxuKawWOb3R4kKCbw6x4j8ODzj+BEqUk8X/nOWIAFoBnKvCvg2vlcg+KiQmk4gpQD0NpMQI8JIXL9hwyH758D4P1bv1YJwGm3HvpdGvxSSsYfzTLUBOS6LI2ATgKicwB/ISXjMoPcLZh6BfwobbkQgpOuNngrKqHSYYAjNxVdx94tsvzqGzJVBFJQkASA1vi/6ztKeAmUDnxV/6aDhRRH+OPAMdj32VIRX1C+MxZgAWgKu14Yf+meV5G3SF7zizLjJf3g+/b11tcC0Haf1wT/o5Phvb4vfD2HtFoAKKDkLJJwME9Cbp4EW6GEtXvS8Qez3A+AYgErPk/Hpr1adFslxwSoV8Br29NQSk0sYnQWigWOlZqwe9ciYezX1Jvhr+gzGhMen4bPdi3Cl7uX4LOdi7DtvXkwZLyIh198FLeMuQu/6TUSv+09SngHShEgLyAp/bmYjQWwACihrkDUEchhFG6+MPzXb5VrAZIGwrt3Xutdf4Ki/sumw3tdH/h6DBG0VgBoDU9GTC3Bqe8fPDrs+vZcEJBiAO/vSwcCeuw9SH0CkjFveyrglpcPHANomlMBMzKyZ0et/8mAdaYXgOoVOOoxihLg414TTgfMoilIyaFUrH/rNUx8Yhqu6DMyavnw294jcc/0B3HUZRA1Bsr3XmzUIQDr7kO4NCu6H6DDgLDTKGZzuo/KfIPF6aIvADUKyZ3XXTyHoBwAf+6ytpUCl2Uh8MZLYt3v6zq4zQKgpMldAJd8cAj9210sCeNX3ss05KTPJPr/1RcAWutf2Xc0dmxbiOPeaBeeMv4ijUMp0Ldz2wKMmDZFPCPiDfy+3xj0nXgPvIVaVMRgG7GEFwBau1vemCwMnnr/1VGYKrb2/AeXovSruXB+NEN4CgWpw8Q9JBz5SweIFmMkCOQRtGnLL5yJ4NZ58HYdBN/Ng+qMXwjA9f0QyH4RoSMrEfKZz4/TEJUx2KQA1G4DHnFw9L8l0NKKfk/Dp04Ruf0RAbh6wFj8c+RdsBxIQVUz8RNK+jnlMwlBoCaiJAKUHkzJQd3HTYQzN110GlLed7FJeAGQ6Y+CpIEoSBogPopegEsHyB5CrXtPDT/oo6j4W9RHtAlzfvg0Qhat3E2I3P5WBv3CZPzbF8Dbc4gI+tU3fiEAN/SHf/6jCH2yCMFt85vm3bkIfZMsi0C95zcnAEzLoP5/hd9qcMPwCWIPPyIAJAajHrofVbQsbMF2r9imdRqER/DigieFCJAAdIsIgKN1fz8XgoQXAFrDH067DdY1k0WrMMGq2n6A5jEiok+lvhFvge4T6b6L+yI/qb/cT3DNZJH3T55DJD6gfG8UbiMCa2fL231/uhW+f/SH7+aBIvhXJwK9hsL7j37wXtMbvr/1g++mgfD9S8E/B8J7RXf4n5uKEDWfqPcOFoCOgdbyH76/QBh8/S0+6gb8/PwnxZkAynvOB4kAdQ0eNuU+EUPocedEuPLSWAAuBEoBIKOWewKuRNhFvQDP9QMM1RpysCgVvgOL4fn3SyjZ/AiKM8bJzT+EVyDHAMg7IKEoeedRBApSZI+gqVmBPm+RhAAEVr6AwLrZCGx+Db5n74fvxnqeABn4w5Pgf/UR+MaMEWJQ5ylQrOD6vvDSNRPGI7DiBSEq9d/DAtAxUEAvVfeCyN6rH8C7tNcIZK16udUCQJ7AmWAG3l4/Bz/vegcG33uvOE8gFluJJ7wAnHcXINIPkAKCTlNdT0Ca4f0Hk8QuQKFhpBwTWNBLXi5Qb8Dlg8TXqKHoeeMCXjNCVCNOHF+FoDQDvuv71YsB9EVg1SyET+SISrTA26/Ad/tIeP/SB95/DYB/xv0I7looGz7FAVoZA2BaxvFSEx56/hFcVi8FmIJ41BDki48X42jpef4fN0GlUy9m/etuG4dJTz2I4x5jTJYJq1sAmoJEgQShdt3v+exlUQosnhnZFpzTXewMUJ+AFu0MBDMQ1Dwlu/qN7QLQ7FCWheBXy+CbOhHBd+fInyfDb8LTYAFoP1QB6C+W0H/S5AYVgLR27zG+1nV3Nv77Px9k7EecRgydci/mJj0jvAzlNbEAC0BzUEJQrRA4tz8jPzOSEjyvBwo0Q0RiULO5Ac0JAF1DMzwF+ihrrAUHT7AAtJ8jbgP2f7kMfxnasAKQ9vMnTp+GI25jm9J4SQCOuY2Y8uxDeP/d+aLPgPKaWIAFoKWQEJRmwXdgCQ5rh8vPX9pfFoOlA+Db//r539ESAaj3rqj7G4EFoP3Q1t3bb88RCTvX1lv/X9JjJOYte6bNGXxhuyTOm1iufQ7ugvQW7SJcDFgAWgk9J1isFceInROBnsIToLyCJmMCrRGAFtJeAaCZrbnZLVyiQ4VbQmWpTLmLzlCMvq4x6NllTgkVnrbdfyE44zdj/rIZIuIfMX4Sgt/0HoX1618Tvf+V97QMCYFiLUrz02O6CIsFoA2EXSaRH0AlwaJISOwY9IAle4IsAI2pfYwJgDBGt4QyhxT1NQpIVnolVAe0CFp0sH9lRP4uPQ5/YoDja9rKkr9GwhB1r00WjJqgVhh76SEDLJ8bkb9Tj8JPDXB9a0BZia7u68p7LyQkULQEIFe/fgovLQX+MmQsvt2zTCwBlPe1FFoGxGL2X31YANoIPc9/aJlIKqprFz63B1w7ZzYeD4gFAbDqUObQoSasFUa95uF1+HLlClT7tXXXkDBUeSUc3mHGu6+tgXH8emgGbERSnw1Y3n8D0oZtQNakt/DB4hyU7DOeu9eqEwZNwlCy14iP01YhZ9o6aO94G8v7bsTS3huwvN8GpN+2AdlT3sROzSq4DxjE9VHf5wWC9uWdeWnoPv5uEfSLCAAFA/vdM0kEBylIqLwvkWABaAeiXfjOmefeRe3CU4eJeoKorMEYEAAyfm+eHh+nr0Tq4A1YeNMWGMa8Dd9hHcqd8qxMwrD28XVYcONmvH7zZqQO2SCMWDNwIxZ334wl3Tdj2a2bsKjrZqQM2oC9b2ShyqdFlV8L/2E9ti7IwdJeGzHnr+9g0S2bkDp4I6QRb0N7+wYs77MRi26Rn0H3kxjsW5cli8hFcJOpsOfzTxaL7L/6lXxU5vvQC4+Ioh/lPYkGC0B7qD1TkOIBdTsDc7vDuX1GtBcQAwJQWarFd+9mYNHNm7G8j2yci7ttxjfrs3DySBr2rMzC4q6bhcHvNmTD8pkJnoN6eA4ahDB8sz4Tax5Zi6U9NiFl0EYs67NJ/Dt/u1l8XTv8bcz7+xbkPLgOn2dm4/BOM5zfGOA5pBezfeEnJnycthLpt29AUu9N4ntY3G0TvspZcVE8AaoAzM55WRh8xPhFALDnCGh0zyfMCcDngwWgndD7PLtfOtcwZEEvFBlHi+SiBrGAGBAAgmZ5MsIl3WUjptl4+9IcfKpbifk3yP8W14XS5TiBUyayrq/yavHB66uxhERgsCwCpjvlZYJh7HrkfZiBSo98LcURaFlAgUD6SM87WpYO+14jjOPWC09ied9N4l7bl0YRLFR+v53JKV+GKNxpEAAcLNcAbHtvvkgRVt6TaLAAtBcydItW1BuIWECkYSg1Dam/IxAjAkCG7P7OgPTb30Zy/43CtSdPILnfRhzYmIkj4XRhsMr7IpAh0zNW3v+mmMVJBEhE1j6xTgQHyfCb21k4EtYib1sGkm6VRYiWA++8sqZBLKKzoW056q846sH7G1QAUvbfP4ZPwOFvNKJISHlfosEC0AHQO21vPVD3TgoGUiVhg2VAjAgAbcER2fe9JWZgEoHUIW8jb7tZGL/y+saoCWmxJ3uFMHwyYIoN0Fr+aJk2Kl25MUggKjxarH5onbwU6LsJ+tHr4c3XiziF8vrOgAp2ig9o8M+RE0QXoIgAkBhQWTDl7cfq3n1HwgLQAYh37nq+7kRiUYC0RvHOWBEAqn13Slj9kDyDJ/XcjLWPr0V1IL3ZmTsCufJFu011HgTFEXamrERNK9bx5CnQTgDdS89I7rcBRZ+axLOV13YGFODb8cFC/K5fwwpAKuGlxiAn25gAFG+wAHQAVFlIrcLqlgALe4s4QKTYSFwXawLwYK0A9NqMNY+uRQXtybdQAGgZ4P5OL4J+yf0okLcZHy7KaVUgj9x98hqW9tiMlIEbsbTXJhzYkokqX+sEQHgTJXpUOQyodurFzE7be83N3pSbn258ocH6PyIAGSteEgFC5T2JCAtAByCqB79bKhKCIgeHFqQNQ6AoTQ4G0nUJJACUPOTL18M4lvb4N4mlwNYFq1slAGToB9/NRFKvTbIA9NyEbzdkotrX/DPoZ6D+fGTE1G3XXyTBfjAVRd8uF917qICHOvzQSb9Uylvtis7npwDfYy89hkvr7QDQVuDVA0bj3zsWxWzufkfDAtABCAHIXYb8ZQPkk4OI5MHwF6QkqADo4Dush2n8+joBeH9e64J4JACHtsqBQFoCkADs39i8AJDhHnUb8dXupUhKn4lJT00TZ/lRd94bRtyJm0bdJar4aB3/5MuPIXPlbOTtTRbluKe8JuEZlNG5jBYdhtw7WfT8iwgAtQPvOuYu0egzFtt3dQYsAB1ApH+AaDNGnYSEAAxJcAHQwTSuHQLglZC7LUMEIpsTgKBVdvOpMOejbQtw1+NTRbSeuu3QMV6UuUfGSwk9FNCjrD46spvceeL6YeMxZcZDeO+duSL1F6EMHPxqOa4bNg5/rNcCjNKB73x8Ko441REAJFgAOgCqDfB+vVBs/0WWACIjsCjtXEYgC0ADZAEwt0gAaH1/xGnAvGUzRJT+Muq624rDO0kYKNmHxOLuJ6ahcL8GH26dL07yrR8A/HXPEXh16dOiQEj5PSQqLAAdADUEaZAMREFAw0iEbIkZBOwoAcj7wCwSic4nANSxl1z+mXOfxM+7DscfWmH4SsjYL+05EjeNmoA7HrhPnPJz7utj8ZveI7DurVdVswNAsAB0APTOki2PnssDoFbkOfc0PD2IBaABJAD5H5IAyFuJTQkAuf1684v4RdfhDU7saSviqK/+Y8Tan/4d+bxoBjJ4HPZ9nhSzx3h1BiwA7SZSDzC2Xj1ADzjefzI2E4FiRAAoTZgEgOoBmhIACsTZD6WKwF79dl2dwZX9xqDP3ZNQSgd4JHgFYH1YANoJzfK+/YuQt1he/+cvlpcA3n3zm/UA6N+qFoDt5xcAcsVXr30l6riuzoAagDww82Fxwo9yyzCRYQFoJ1QSbHt72rn3LewtGoUIY2qmGEgIgFG9AlDwkVkuBmpCACgZZ97yGbikx/Aog+1oLuk5EklpM2O2eWdnwQLQDmiGpwQgOjFYbP0t6YdDc7vD8cFTDd1/ojEBoLbgqc+oWAAymhWAVxY/0/kCMHgcLr91FN7dMhcnGzkDMJFhAWgr1AvAZUbxigl1NQD1G4LU7f9HIAFIVsYA+sL/6sPqFIBSCQU7zu8B0Gy8UPOs2O+PMtoOhHIK/nb7eOTtXY4alzoSgCKwALQFyibzroDjvSdwaK78Hlr/07/pCLGo2Z8IZsCf9oww+joBoFOAJo6XD/5oQ++4eBcAahhC7cKaEgBK5d28aa7Yv1cabUdyRd/RGDplsujhF4un93QmLACtRRh/Flw7ZiJ3fu0ZguT6z+kG25v3I+xu4iAPf4Y4Isz793pLgO6D4b1pgDj8M1yxIvoegv4g6XAQmpk64GSgmBOAfhtFQ5DGBICi8RSVv3XCPfhdvZTdjobqAZ6Y/ThO0u+5ke81kWEBaAXU4IOe49g2Hbl0VFjtup/agBVn3SkvC5SufwSXEcFvk+HtMxS+W+odE04Hgg4ZjuCOhfIRYqFMhIJEBkKUkGKVEHh/HoJ0OrDCPZUFQMLV5uRWCQA1/MiJlAP32oQ3HmmjAChrAVpRDEQCUPixWVQTRgTg242Zordg/esoD8Cc9RJ+2e2OKMPtKGiJYcicpboAIJHAAlC7Lu8AASCjpmg/9f2nBB8hLmLLry9y53SDZeVEYahhZzMBpEAG/LOmwffXPudOCaaPNw2At9tg+B+ZBP/iJxDQPgv/kifgf+YB+MaOgfdPveEbN1YcOBqqt0dNArB1XzquMiXjr1kaXGnSYCMJgKuRd0d+FuEB6M71AyAP4JG1KHc138knQl0xUD0P4L25q6OM93wID2CXSXQiigjANxuiBYBccirxvWf6NPyq+4gGyTsdAWUWUlrx/i+S2tUCPF5JSAGgI7za7QGUyEG+stJMBApT4dg6HfnLB9UZvzgwdOGtKHnnMZEI1NIjw0MHU+AbfId8XHj9o8K7DYaPjhKnE4EJChbScuHa3vAOuB2B9S/Ly4F6RnrKpcO6Pem4wigLAH3M/jwdp1yNLEFqER2B7DrRmpsq8UgEVk19U5T4tlgAnBJKcw3Qj34by/ttwpIem7HxhTWiO7Dy2qao9GpF/8BIKjD1GPzPmqwoL4JO2iXDdOalYuDkSfhVBwYE/zxkHH7ZbTiefu1xVfT/a4wEFICsBmm5QgDW3SdmcHEKsJJa421wOjCJhUWCd+982Dc+KE79oew+ivKT4RN0hLh33wI54NeU26+E1vB+M4KfLoZ34O3wXtdXNvyICNSn22B4yVO4/24ED2gQCkUL2Bm3Dkt2puG3hmRcl6XB5cZkzNmehtPnEYAypw6+Aj0MY+TZmzCOXS8+19J2XNS8k5p4UltwcWZA703IefBN+dSfFooIdQ/6zxv12op12yzOEqBOQcprqRrweKlRZAWOfvgB/LL7CFHgQwasNOoWM5SO/xqBvnffI/oHVKss+h8hsQRAtOk2ocg4RhirWJ+TAKyZJK+lD2vqCB5OEdDpvr6DS0U1H50CTOt765rJOJx+u1jnH3r1FuHmC0FZ2h+WVRNR+sUrsmjUz/RrKbUiENqfDN8T94kgIOUD+G4cAN+/BsJ38yDZE7ihP/yvPy57DXQ8tSIASEUyVSU6jHorFVeZNUIAKBh427oUlNsl0RAj6t2iDl+L/I/OVeFRM45lt25E3ofmFgfxqCfgf97IqjNeag2WNnSjaAHe1GlBSsjQN89eI7wHeoa8FFknxKUxESERoMM26ZituUkzROMOyhCsf6BnS6ESYJr5B0+ejIKvk3Gi1CSer3ynGkgoAaBZXGzNvXKzMNgIco4+rdkpXTeCvIYXR33P7ymi+IdevhkHZ9+Egy//C7nzuiN/SX8c1t4By+rJcO14Fv5DScLohYfQWKS/pdAfGxWc+EwIfrQQgbmPwjdpAny3j5SXB6NGI/DWy3JA0NH4zETr/4x/p+F/tcuFB3C5IVl8/B/tcmg/SRNfV94j1v8uCWufWCv691NrcDJi+jc16BTLgGbO7SMvIVCkg3nCeiy4gZ5BB31swtzrt+D9eavlZUAjBlwfMvKCnSZxX+SgEPIAFvyTzijIFIVCynsIMtJKh9wX4KtPl+DB5x/BNbV9AaiW/+oBYxuU90ags/5IKGgn4Vc9huOagWMxa8F0+Aq1wrMIWht/nxpIHAEoMYjZ3PbW/bC9OQX29Q+cgz63bor4fFPY109FyaaH4dj6JFy7nkPpl6/Bf3ApghZJjgXQ0qAl6/zWQIZCa0+K+DsNCB5ORzA3Vf7aebakaL+6zKbD6s9SkbpTA8PHGug/ThGk7dRg1e4U0aJbOZOS8ZfsNeCdV1fj/bmrsXWeDBnuOy+vEW59c+f10Qxf+LEJW2avEfdFnkHHiG17PUd09g03s5SgMwm/zMnC5pfWYOv82mfMXy2eSQeSiPMKmxGRE6VGYbxUvbcs/TmMe2wqbhxxJ37fb5TIG6CtPSr9JS/h8t4jxXJh8L2T8crip8U9p31m0UOQPEPls9VE4ghALbKxZsjr+RZCM7q4x5NZh5jpyeDbM9O3BnoPzfbUiqoFySgUHDvm1OG0Wy+CfhHov+nzyuvPvUcnIu0UbCOXX1D7b6VgNIpVDiTW3VvvGVXeli0haCaPnCOofAZ5By11x+n7pd6AdIIP9fAv2q/Bzg9fxxtrX0HWypeQtfJl0RJsw4bX8O3nSQhb5NOA6R7ls9RKwgkAo05ETMRlwDGvSVQRUh2BwG8WGYU1bqPqsvxaAgsAw6gYFgCGUTEsAAyjYlgAGEbFsAAwjIphAWAYFcMCwDAqhgWAYVQMCwDDqBgWAIZRMSwADKNiWAAYRsWwADCMimEBYBgVwwLAMCqGBYBhVAwLAMOoGBYAhlExLAAMo2JYABhGxbAAMIyKYQFgGBXDAsAwKoYFgGFUDAsAw6gYFgCGUTEsAAyjYlgAGEbFsAAwjIphAWAYFcMCwDAqhgWAYVQMCwDDqBgWAIZRMSwADKNiWAAYRsWwADCMimEBYBgVwwLAMCqGBYBhVAwLAMOoGBYAhlExLAAMo2LOCYBNF6hmAWAYVVEnAAGr5KnxmKMuYBgmcRECYNM9Rx5A0RFvRtQFDMMkLmfLV9HHp7sErdr9x/2ZURcwDJO4nClbiZBdP5WCgDtPhlZEXcAwTOJyimzebhjTJWTV5pwtXxl1AcMwiUlZiR7VHjPCxdoetASYTwEB5UUMwyQmFU4jglbpRJnHdGWXoFU3WawHGrmQYZjEo6bUTALgLCpK+2GXkNXQlfIAyC1QXsgwTOJxMrgCQZv07y403PnaXwasUiVnAzKMOhBLfotOLwSARsgm7T0RyIq6kGGYxEME/S26B+oLgMSBQIZJfMpKDCgvMZwNW/R/qxOAsE2acDrMgUCGSXQo6zdolWzAnO+d8wAKDZeHbLpjlU5j1A0MwyQOlAIcsOjW1Bl/ZASt0p6TQY4DMEwiQ+v/oFWapLT/LiG7fjYqc6JuYBgmMah0CQ//iD9Xukxp/11Cdt1fyx2GsxQkUN7IMEz8c7osm2b/bUrbrxsBi/YrShJQ3sgwTPyDcuoBIN2rtPu6EbRLj/EygGESDyr+CVl1oVBR2v8o7b5uVDgzfhG26zgrkGESDJrYA1bJoLT5qBGw6ox0cbCRhzAME3+UOwyocpnO+qy6fyjtPWoE7el/qXAaz9BNygcxDBN/yFt/2q1KW29yBCzSBrlraPTDGIaJH8J2PajOJ1Ck66u08yaH3y7dWO0xnWUvgGHiF1rGU68Pv0X7sdLGmx1Bq24tKtkLYJh4hXp8HPNnIlyi66m072ZHeUn61ZUu47EqOXuIYZg4ImiVRN1/wKJdr7TtFg9/sXY+qlezF8AwcQZt5Ve6jEe9BSlXKe26xcPpTP5x2KazUhCBRYBh4geauP3F2peUNt3qESrSDqb04HKuEWCYmIcm6tOhbIRtuv0Nav7bM/zF6QZ5KSBFvZBhmNih0mVCtcd0mnbylHbc5uH52vSTcIm+gE4TYRFgmNgFVTnwW6TnlTbc7uEvTL+h2mM6QScJc5oww8QWIupflYOgRXpPabsdNkoLU6dQYgEnCDFM7EDGfyqUTXZZ7Dio/7nSbjt0BCy6xRQPoBRD5TfCMMyFhYz/mC+T1v1V3mLpeqW9dsoI2XRrSQSU3wzDMBcOivjTkvyIN+O0p0A7VGmnnTawfv3/LyvRbUMVJwkxzMWA7I6SfU4Es+CzpE9U2minD0oSKi8x7KbAg/KbYxim8xDG7zLidDgbPov0iNI2L9goKFj63xUOw6e8HGCYCwOt+am9lzjg06p7XGmTF3zY7dk/qnAat3BgkGE6FzL+o75MHCk1n/YXn6e558UYFQ69mWICdLoQxwUYpmMh4yeXv6bUXOkvThumtL+YGGV2/WzakiCV4oxBhukYwna5qWdNqbnAnZf2T6XdxdQIWHR31HjMAT5tmGHaB02iVS6TyPCrdBk3HTy4uHOTfDpqUA1ylcv4IX3jtFXBSwKGaT3k8ld7zCfL7fqZShuLi1Feonux2mM+Sl1JyY1R/oAMwzQksr9Pk2e127TPW5jSTWlXcTXCxdL1VW7jNqohOO7PjPqBGYaRG3jSuZy0dK52m6qrXKZZn8zpoHr+WBgVDuNd1W5jAQUzjpRmRP0CGEat0PY5TZBHvRmocZtW+4ula5T2kxBjz57kH1e6DDOqXCYnuTj0Ayt/GQyjFmjGP1OWjeOBLHL7PyhzSn2UNpOQw74/5WdVTtMLlS6jjeIDtaWMUb8ghklEKJOPWu5Xu01k+FsrHLohShtRxfAeWPbTGpfp3iqXcQcdR0bLA+pjTv3Mlb80holnKmtz92nCq3AZSitdRl2FU3eL0iZUO6qdxr9Xe8zzKp3GA7JC5oh8Z/rFcYoxE2/QJHak1CzW9sLoHYaqCqfxnUqX6d7y8uyfKf/+edQbFc6MrlVu02sVTsO/y0v0FbR7QNFR+mWSh0DbJLRkYGFgLjZldj0qnAZRl08TFv2dCoN3GsnobZUuw7pKt3FKyJV2hfLvnEcLhs+acWm12zSowmF4ucyufzNs1x0I2XTlZPzH/Vl1Cku/eIa5IJTLk1Ftbj7luJwoK9E7yxyGXZUug1TuNEwrt0s3nj2b9kPl3zOPDhhVHtOvKL8gbNMPDTuN9wQt+seCNt0LQbt+Vtime5FhOosyu35WyG6YEbLrp4as0vhKt6lnudd89Vln8o+Vf6fxMP4PLq8MreRgweUAAAAASUVORK5CYII=';
  function applySiteIcons(){
    document.querySelectorAll('img.brand-logo').forEach(function(el){ el.src = BRAND_LOGO; });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(function(l){ l.href = APP_ICON; });
  }
  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', applySiteIcons); } else { applySiteIcons(); }
})();