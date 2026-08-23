
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
    ? `<span class="feed-card-avatar"><img src="${escapeAttr(profile.photo)}" alt="Profile photo"></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const whoLabel = who === 'you'
    ? `<span class="feed-card-who"><b>You</b> imported a playlist</span>`
    : `<span class="feed-card-who"><b>@${escapeHtml(who)}</b> imported a playlist</span>`;
  const whenStr = when ? `<div class="feed-card-when">${new Date(when).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</div>` : '';
  const previewCovers = entries.slice(0,3).map(e=> e.song.coverArt ? `<img src="${escapeAttr(e.song.coverArt)}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;" alt="Album cover">` : '').join('');
  const songList = entries.map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;border-bottom:1px solid rgba(var(--on-paper-rgb),0.08);">
    ${e.song.coverArt ? `<img src="${escapeAttr(e.song.coverArt)}" style="width:28px;height:28px;border-radius:3px;object-fit:cover;flex-shrink:0;" alt="Album cover">` : ''}
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
    ? `<span class="feed-card-avatar"><img src="${escapeAttr(p.photo)}" alt="Profile photo"></span>`
    : `<span class="feed-card-avatar">${escapeHtml(initial)}</span>`;
  const cover = s.coverArt
    ? `<img class="feed-card-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">`
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

