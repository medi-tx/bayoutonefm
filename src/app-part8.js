
/* ================= FRIENDS-ONLY MESSAGING =================
   Backend setup — run once in the Supabase dashboard (SQL Editor).
   Safe to re-run anytime: it never drops the table (dropping it DELETES
   every message), and it drops policies before recreating them.
     create table if not exists public.messages (
       id uuid primary key default gen_random_uuid(),
       sender_id uuid not null references auth.users(id) on delete cascade,
       recipient_id uuid not null references auth.users(id) on delete cascade,
       content text default '',
       song jsonb,
       created_at timestamptz not null default now()
     );
     alter table public.messages enable row level security;
     drop policy if exists "messages_select_friends_only" on public.messages;
     create policy "messages_select_friends_only" on public.messages for select
       to authenticated using (
         (sender_id = auth.uid() or recipient_id = auth.uid())
         and exists (
           select 1 from public.friends f
           where f.status = 'accepted'
             and (
               (f.requester_id = auth.uid() and f.addressee_id = (case when sender_id = auth.uid() then recipient_id else sender_id end))
               or (f.addressee_id = auth.uid() and f.requester_id = (case when sender_id = auth.uid() then recipient_id else sender_id end))
             )
         )
       );
     drop policy if exists "messages_insert_friends_only" on public.messages;
     create policy "messages_insert_friends_only" on public.messages for insert
       to authenticated with check (
         sender_id = auth.uid()
         and exists (
           select 1 from public.friends f
           where f.status = 'accepted'
             and (
               (f.requester_id = auth.uid() and f.addressee_id = recipient_id)
               or (f.addressee_id = auth.uid() and f.requester_id = recipient_id)
             )
         )
       );
*/
(function(){
  const MSG_LAST_READ_KEY = 'bayoutonefm-msg-last-read';
  let msgLastRead = {};          // friendId -> ISO timestamp
  let msgFriendProfiles = [];    // [{ user_id, username, bio, photo }]
  let msgActiveFriend = null;
  let msgPendingSong = null;
  let msgUnreadCache = {};       // friendId -> unread count
  let msgSongResultsCache = [];
  window.msgPreviewSong = function(id){
    const idx = parseInt(String(id).slice(7), 10);
    const r = msgSongResultsCache[idx];
    if(!r) return null;
    return { id: id, title: r.trackName || '', artists: [r.artistName || ''], previewUrl: r.previewUrl || '' };
  };
  let msgThreadSongCache = {};
  window.msgThreadPreviewSong = function(msgId){
    const song = msgThreadSongCache[msgId];
    if(!song) return null;
    return { id: 'msg:' + msgId, title: song.title || 'Unknown song', artists: [song.artist || ''], previewUrl: song.previewUrl || '' };
  };
  let msgSongSearchDebounce = null;
  let msgPollTimer = null;
  let msgRefreshInflight = false;

  function loadMsgLastRead(){
    try{ msgLastRead = JSON.parse(localStorage.getItem(MSG_LAST_READ_KEY) || '{}') || {}; }
    catch(e){ msgLastRead = {}; }
  }
  function saveMsgLastRead(){
    try{ localStorage.setItem(MSG_LAST_READ_KEY, JSON.stringify(msgLastRead)); }catch(e){}
  }
  function msgQueryFor(friendId){
    return `and(sender_id.eq.${currentUserId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${currentUserId})`;
  }
  function msgAvatarHtml(p){
    if(p.photo) return `<span class="msg-friend-avatar"><img loading="lazy" decoding="async" src="${escapeAttr(p.photo)}" alt="Profile photo"></span>`;
    return `<span class="msg-friend-avatar">${escapeHtml((p.username || '?').charAt(0).toUpperCase())}</span>`;
  }
  function setMsgBadge(total){
    const el = document.getElementById('msgBtnBadge');
    if(!el) return;
    if(total > 0){ el.textContent = total > 99 ? '99+' : total; el.style.display = ''; }
    else { el.textContent = ''; el.style.display = 'none'; }
  }
  async function refreshMsgUnread(){
    if(!currentUserId){ msgUnreadCache = {}; setMsgBadge(0); return; }
    if(!myFriendIds || myFriendIds.size === 0){ msgUnreadCache = {}; setMsgBadge(0); return; }
    if(msgRefreshInflight) return;
    msgRefreshInflight = true;
    try{
    const friendIds = [...myFriendIds];
    let seeded = false;
    friendIds.forEach(fid=>{
      if(!msgLastRead[fid]){ msgLastRead[fid] = new Date().toISOString(); seeded = true; }
    });
    if(seeded) saveMsgLastRead();
    msgUnreadCache = {};
    const { data, error } = await sb
      .from('messages')
      .select('sender_id, created_at')
      .eq('recipient_id', currentUserId)
      .in('sender_id', friendIds);
    if(error){ console.error('Error loading unread count:', error); setMsgBadge(0); return; }
    (data || []).forEach(m=>{
      const lastRead = msgLastRead[m.sender_id];
      if(!lastRead || new Date(m.created_at).getTime() > new Date(lastRead).getTime()){
        msgUnreadCache[m.sender_id] = (msgUnreadCache[m.sender_id] || 0) + 1;
      }
    });
    setMsgBadge(Object.values(msgUnreadCache).reduce((a,b)=>a+b, 0));
    }finally{ msgRefreshInflight = false; }
  }
  function renderMsgFriendList(){
    const list = document.getElementById('msgFriendList');
    list.innerHTML = msgFriendProfiles.map(p=>{
      const unread = msgUnreadCache[p.user_id] || 0;
      const active = p.user_id === msgActiveFriend ? ' active' : '';
      return `<button type="button" class="msg-friend-item${active}" data-msg-friend="${p.user_id}" aria-current="${p.user_id === msgActiveFriend ? 'true' : 'false'}">
        ${msgAvatarHtml(p)}
        <span class="msg-friend-name">${escapeHtml(p.username)}</span>
        ${unread > 0 ? `<span class="msg-friend-unread">${unread}</span>` : ''}
      </button>`;
    }).join('');
  }
  async function openMessagesModal(){
    document.getElementById('messagesOverlay').classList.add('open');
    document.getElementById('msgFriendList').innerHTML = '<div class="msg-no-friends">Loading…</div>';
    const now = new Date().toISOString();
    const rows = await fetchMyFriendRows();
    processFriendRows(rows);
    const ids = [...myFriendIds];
    if(ids.length === 0){
      document.getElementById('msgFriendList').innerHTML = '<div class="msg-no-friends">No friends yet.<br>Add friends in 🔎 Discover to start messaging.</div>';
      document.getElementById('msgConvHeader').textContent = 'No friends yet';
      document.getElementById('msgThread').innerHTML = '';
      return;
    }
    const { data, error } = await sb.from('profiles').select('user_id, username, bio, photo').in('user_id', ids);
    msgFriendProfiles = (error ? [] : (data || [])).filter(p=>p.username);
    msgFriendProfiles.forEach(p=>{ if(!msgLastRead[p.user_id]) msgLastRead[p.user_id] = now; });
    saveMsgLastRead();
    await refreshMsgUnread();
    renderMsgFriendList();
    if(msgFriendProfiles.length > 0 && !msgFriendProfiles.some(p=>p.user_id === msgActiveFriend)){
      openMsgConversation(msgFriendProfiles[0].user_id);
    } else if(msgActiveFriend){
      loadMsgThread(msgActiveFriend);
    }
  }
  async function openMsgConversation(friendId){
    msgActiveFriend = friendId;
    const p = msgFriendProfiles.find(x=>x.user_id === friendId);
    document.getElementById('msgConvHeader').textContent = p ? '@' + p.username : 'Conversation';
    msgLastRead[friendId] = new Date().toISOString();
    saveMsgLastRead();
    await refreshMsgUnread();
    renderMsgFriendList();
    await loadMsgThread(friendId);
  }
  window.btfOpenChatWith = async function(friendId){
    await openMessagesModal();
    if(msgFriendProfiles.some(p=>p.user_id === friendId)) openMsgConversation(friendId);
  };
  window.btfOpenMessages = function(){ return openMessagesModal(); };
  function renderMsgBubble(m){
    const mine = m.sender_id === currentUserId;
    const cls = mine ? 'msg-bubble mine' : 'msg-bubble';
    const t = new Date(m.created_at);
    const timeStr = t.toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    const song = m.song ? msgSongCardHtml(m.song, m.id) : '';
    const content = m.content ? `<div>${escapeHtml(m.content)}</div>` : '';
    return `<div class="${cls}">${content}${song}<span class="msg-time">${timeStr}</span></div>`;
  }
  function msgSongCardHtml(song, msgId){
    if(song.cardImage){
      const backFace = song.cardBackImage
        ? `<div class="msg-flip-face msg-flip-back"><img loading="lazy" decoding="async" src="${escapeAttr(song.cardBackImage)}" alt="Card back"></div>`
        : '';
      const flipHint = song.cardBackImage ? '<span class="msg-flip-hint">Tap to flip</span>' : '';
      const cardEl = song.cardBackImage
        ? `<div class="msg-flip-card" data-flip-msg-card="${escapeAttr(msgId)}" role="button" tabindex="0" title="Click to flip the card" aria-label="Cataloguex song card — tap to flip">
          <div class="msg-flip-inner">
            <div class="msg-flip-face msg-flip-front"><img loading="lazy" decoding="async" src="${escapeAttr(song.cardImage)}" alt="${escapeAttr((song.title||'Song')+' card')}">${flipHint}</div>
            ${backFace}
          </div>
        </div>`
        : `<div class="msg-flip-card msg-flip-static">
          <div class="msg-flip-face msg-flip-front"><img loading="lazy" decoding="async" src="${escapeAttr(song.cardImage)}" alt="${escapeAttr((song.title||'Song')+' card')}"></div>
        </div>`;
      return `<div class="msg-song-share">
        ${cardEl}
        ${song.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
        <span class="preview-btn" data-preview="msg:${escapeAttr(msgId)}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</span>
        <button type="button" class="msg-song-save" data-save-msg-song="${escapeAttr(msgId)}" title="Add this song to your cataloguex">＋ Add to cataloguex</button>
      </div>`;
    }
    const cover = song.cover ? `<img loading="lazy" decoding="async" src="${escapeAttr(song.cover)}" alt="Album cover">` : '';
    return `<a class="msg-song-card" href="${escapeAttr(song.url || '#')}" target="_blank" rel="noopener">
      ${cover}
      <span class="msg-song-meta">
        <span class="msg-song-title">${escapeHtml(song.title || 'Unknown song')}</span>
        <span class="msg-song-artist">${escapeHtml(song.artist || '')}</span>
        <span class="msg-song-album">${escapeHtml(song.album || '')}</span>
      </span>
      ${song.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
      <span class="preview-btn" data-preview="msg:${escapeAttr(msgId)}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</span>
      <button type="button" class="msg-song-save" data-save-msg-song="${escapeAttr(msgId)}" title="Add this song to your cataloguex">＋ Add to cataloguex</button>
    </a>`;
  }
  async function loadMsgThread(friendId){
    const thread = document.getElementById('msgThread');
    thread.innerHTML = '<p class="msg-empty">Loading…</p>';
    const { data, error } = await sb
      .from('messages')
      .select('id, sender_id, content, song, created_at')
      .or(msgQueryFor(friendId))
      .order('created_at', { ascending: false })
      .limit(100);
    if(error){ console.error('Error loading messages:', error); thread.innerHTML = '<p class="msg-empty">Could not load messages.</p>'; showMsgError('Could not load your messages: ' + error.message); return; }
    showMsgError('');
    const msgs = (data || []).slice().reverse();
    if(msgs.length === 0){ thread.innerHTML = '<p class="msg-empty">No messages yet — send a song recommendation!</p>'; return; }
    msgThreadSongCache = {};
    msgs.forEach(m=>{ if(m.song) msgThreadSongCache[m.id] = m.song; });
    thread.innerHTML = msgs.map(renderMsgBubble).join('');
    thread.scrollTop = thread.scrollHeight;
  }
  document.addEventListener('click', function(e){
    const flipCard = e.target.closest('[data-flip-msg-card]');
    if(flipCard){
      e.preventDefault();
      e.stopPropagation();
      flipCard.classList.toggle('flipped');
      return;
    }
    const btn = e.target.closest('[data-save-msg-song]');
    if(!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const song = msgThreadSongCache[btn.getAttribute('data-save-msg-song')];
    if(!song || typeof openAddFromData !== 'function') return;
    trackEvent('msg_song_save_to_cataloguex');
    openAddFromData({
      title: song.title || '',
      artists: song.artist ? [song.artist] : [],
      album: song.album || '',
      year: song.year ? String(song.year) : '',
      genres: song.genre ? [song.genre] : [],
      coverArt: song.cover || null,
      explicit: !!song.explicit,
      source: 'message'
    });
  });
  function setMsgPendingSong(song){
    msgPendingSong = song;
    const wrap = document.getElementById('msgPendingSongWrap');
    if(!song){ wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
    const cover = song.cover ? `<img loading="lazy" decoding="async" src="${escapeAttr(song.cover)}" alt="Album cover">` : '';
    wrap.style.display = '';
    wrap.innerHTML = `<div class="msg-pending-song">
      ${cover}
      <div class="msg-pending-meta">
        <div class="msg-pending-title">${escapeHtml(song.title || 'Unknown song')}</div>
        <div class="msg-pending-artist">${escapeHtml(song.artist || '')}</div>
        <div class="msg-pending-album">${song.album ? escapeHtml(song.album) : ''}</div>
      </div>
      <button type="button" class="msg-pending-x" id="msgPendingX" title="Remove">✕</button>
    </div>`;
    document.getElementById('msgPendingX').addEventListener('click', ()=>{ setMsgPendingSong(null); });
  }
  function showMsgError(msg){
    const el = document.getElementById('msgError');
    if(!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? '' : 'none';
  }
  async function sendMsg(){
    if(!msgActiveFriend) return;
    trackEvent('send_message');
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    if(!content && !msgPendingSong) return;
    const btn = document.getElementById('msgSendBtn');
    btn.disabled = true;
    const { error } = await sb.from('messages').insert({
      sender_id: currentUserId,
      recipient_id: msgActiveFriend,
      content,
      song: msgPendingSong
    });
    btn.disabled = false;
    if(error){
      console.error('Error sending message:', error);
      showMsgError('Could not send your message: ' + error.message + ' — the message was not saved.');
      return;
    }
    showMsgError('');
    input.value = '';
    setMsgPendingSong(null);
    await loadMsgThread(msgActiveFriend);
  }
  async function openMsgSongPicker(){
    document.getElementById('msgSongSearch').value = '';
    document.getElementById('msgSongResults').innerHTML = '<p class="msg-empty">Search to find a song to recommend.</p>';
    document.getElementById('msgSongOverlay').classList.add('open');
    document.getElementById('msgSongSearch').focus();
  }
  async function renderMsgSongResults(query){
    const wrap = document.getElementById('msgSongResults');
    if(!query.trim()){ wrap.innerHTML = '<p class="msg-empty">Search to find a song to recommend.</p>'; return; }
    wrap.innerHTML = '<p class="msg-empty">Searching…</p>';
    let results = [];
    try{ results = await deezerSearch(query, 8); }catch(e){ results = []; }
    if(!results || results.length === 0){
      try{ results = await itunesSearch(query, 'song', 8); }catch(e2){ results = []; }
    }
    msgSongResultsCache = results || [];
    if(msgSongResultsCache.length === 0){ wrap.innerHTML = '<p class="msg-empty">No songs found.</p>'; return; }
    wrap.innerHTML = msgSongResultsCache.map((r, i)=>{
      const cover = r.artworkUrl100 ? `<img loading="lazy" decoding="async" src="${escapeAttr(upscaleArtwork(r.artworkUrl100))}" alt="Album cover">` : '';
      const artist = r.collectionName ? `${escapeHtml(r.artistName || '')} · ${escapeHtml(r.collectionName)}` : escapeHtml(r.artistName || '');
      return `<button type="button" class="msg-song-result" data-msg-song-index="${i}">
        ${cover}
        <span class="msg-song-result-meta">
          <span class="msg-song-result-title">${escapeHtml(r.trackName || 'Unknown')}</span>
          <span class="msg-song-result-artist">${artist}</span>
        </span>
        ${r.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
        <span class="preview-btn" data-preview="msgrec:${i}" title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</span>
      </button>`;
    }).join('');
  }
  function selectMsgSong(index){
    const r = msgSongResultsCache[index];
    if(!r) return;
    setMsgPendingSong({
      title: r.trackName || 'Unknown song',
      artist: r.artistName || '',
      album: r.collectionName || '',
      year: r.releaseDate ? parseInt(r.releaseDate.slice(0, 4), 10) : null,
      genre: r.primaryGenreName || '',
      cover: r.artworkUrl100 ? upscaleArtwork(r.artworkUrl100) : null,
      url: r.trackViewUrl || '',
      previewUrl: r.previewUrl || '',
      explicit: r.explicit || false
    });
    document.getElementById('msgSongOverlay').classList.remove('open');
  }
  function initMsgEvents(){
    document.getElementById('messagesBtn').addEventListener('click', ()=>{ trackEvent('open_messages'); openMessagesModal(); });
    document.getElementById('messagesCloseBtn').addEventListener('click', ()=>{ document.getElementById('messagesOverlay').classList.remove('open'); });
    document.getElementById('msgFriendList').addEventListener('click', e=>{
      trackEvent('switch_thread');
      const btn = e.target.closest('[data-msg-friend]');
      if(btn) openMsgConversation(btn.dataset.msgFriend);
    });
    document.getElementById('msgSendBtn').addEventListener('click', sendMsg);
    document.getElementById('msgInput').addEventListener('keydown', e=>{
      if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMsg(); }
    });
    document.getElementById('msgSongBtn').addEventListener('click', ()=>{ trackEvent('open_msg_song_picker'); openMsgSongPicker(); });
    document.getElementById('msgSongCancelBtn').addEventListener('click', ()=>{ document.getElementById('msgSongOverlay').classList.remove('open'); });
    document.getElementById('msgSongSearch').addEventListener('input', e=>{
      clearTimeout(msgSongSearchDebounce);
      const q = e.target.value;
      msgSongSearchDebounce = setTimeout(()=> renderMsgSongResults(q), 350);
    });
    document.getElementById('msgSongResults').addEventListener('click', e=>{
      trackEvent('msg_attach_song');
      if(e.target.closest('[data-preview]')) return;
      const btn = e.target.closest('[data-msg-song-index]');
      if(btn) selectMsgSong(parseInt(btn.dataset.msgSongIndex, 10));
    });
    document.addEventListener('keydown', e=>{
      if(e.key === 'Escape'){
        document.getElementById('msgSongOverlay').classList.remove('open');
        if(e.target.id !== 'msgInput') document.getElementById('messagesOverlay').classList.remove('open');
      }
    });
  }
  function startMsgPolling(){
    clearInterval(msgPollTimer);
    msgPollTimer = setInterval(()=>{ refreshMsgUnread(); }, 15000);
  }

  /* ---- LIVE INCOMING MESSAGES (Supabase Realtime) ---- */
  let msgRealtimeChannel = null;
  let msgRealtimeFor = null;
  function senderUsername(senderId){
    if(msgFriendProfiles){
      const p = msgFriendProfiles.find(x=>x.user_id === senderId);
      if(p) return p.username;
    }
    if(typeof allProfilesCache !== 'undefined' && allProfilesCache){
      const p = allProfilesCache.find(x=>x.user_id === senderId);
      if(p) return p.username;
    }
    return null;
  }
  async function handleIncomingMessage(m){
    if(!m || !m.sender_id || m.sender_id === currentUserId) return;
    const overlay = document.getElementById('messagesOverlay');
    const overlayOpen = overlay && overlay.classList.contains('open');
    if(overlayOpen && msgActiveFriend === m.sender_id){
      msgLastRead[m.sender_id] = new Date().toISOString();
      saveMsgLastRead();
      msgUnreadCache[m.sender_id] = 0;
      renderMsgFriendList();
      loadMsgThread(m.sender_id);
      return;
    }
    const uname = senderUsername(m.sender_id);
    const body = (m.content && m.content.trim()) ? m.content : 'Sent you a song recommendation';
    showToast('💬 New message from @' + (uname || 'a friend'), 5000);
    if(window.btfBrowserNotify) window.btfBrowserNotify('💬 New message from @' + (uname || 'a friend'), body);
    await refreshMsgUnread();
  }
  function subscribeMsgRealtime(){
    if(!sb || !currentUserId) return;
    if(msgRealtimeChannel){
      if(msgRealtimeFor === currentUserId) return;
      try{ sb.removeChannel(msgRealtimeChannel); }catch(e){}
      msgRealtimeChannel = null;
    }
    msgRealtimeFor = currentUserId;
    try{
      msgRealtimeChannel = sb.channel('messages:' + currentUserId)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: 'recipient_id=eq.' + currentUserId
        }, (payload)=> handleIncomingMessage(payload && payload.new))
        .subscribe();
    }catch(e){
      console.warn('Message realtime subscribe failed:', e);
      msgRealtimeChannel = null;
    }
  }
  function stopMsgRealtime(){
    if(msgRealtimeChannel){
      try{ sb.removeChannel(msgRealtimeChannel); }catch(e){}
      msgRealtimeChannel = null;
    }
    msgRealtimeFor = null;
  }
  window.startMsgRealtime = subscribeMsgRealtime;
  window.stopMsgRealtime = stopMsgRealtime;

  loadMsgLastRead();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initMsgEvents);
  } else {
    initMsgEvents();
  }
  startMsgPolling();
  try{
    sb.auth.getSession().then(({ data: { session } })=>{
      if(session && session.user) subscribeMsgRealtime();
    });
  }catch(e){}
  if(sb && sb.auth){
    sb.auth.onAuthStateChange(event=>{
      if(event === 'SIGNED_IN'){ loadMsgLastRead(); msgActiveFriend = null; msgPendingSong = null; refreshMsgUnread(); subscribeMsgRealtime(); }
      if(event === 'SIGNED_OUT'){ msgActiveFriend = null; msgPendingSong = null; msgUnreadCache = {}; setMsgBadge(0); stopMsgRealtime(); }
    });
  }
})();
