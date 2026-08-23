
/* ================= SONG OF THE DAY =================
   Backend setup — run once in the Supabase dashboard (SQL Editor):

     create table if not exists public.song_of_the_day (
       song_date date primary key,
       song jsonb not null,
       picked_by uuid references auth.users(id) on delete set null,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     );
     alter table public.song_of_the_day enable row level security;
     drop policy if exists "sotd_select" on public.song_of_the_day;
     create policy "sotd_select" on public.song_of_the_day for select to authenticated using (true);
     drop policy if exists "sotd_insert" on public.song_of_the_day;
     create policy "sotd_insert" on public.song_of_the_day for insert to authenticated with check (true);
     drop policy if exists "sotd_update" on public.song_of_the_day;
     create policy "sotd_update" on public.song_of_the_day for update to authenticated using (true);

     create table if not exists public.sotd_reactions (
       song_date date not null references public.song_of_the_day(song_date) on delete cascade,
       user_id uuid not null references auth.users(id) on delete cascade,
       emoji text not null,
       created_at timestamptz not null default now(),
       primary key (song_date, user_id)
     );
     alter table public.sotd_reactions enable row level security;
     drop policy if exists "sotdr_select" on public.sotd_reactions;
     create policy "sotdr_select" on public.sotd_reactions for select to authenticated using (true);
     drop policy if exists "sotdr_upsert" on public.sotd_reactions;
     create policy "sotdr_upsert" on public.sotd_reactions for insert to authenticated with check (true);
     drop policy if exists "sotdr_update" on public.sotd_reactions;
     create policy "sotdr_update" on public.sotd_reactions for update to authenticated using (true);
     drop policy if exists "sotdr_delete" on public.sotd_reactions;
     create policy "sotdr_delete" on public.sotd_reactions for delete using (true);

     create table if not exists public.notifications (
       id uuid primary key default gen_random_uuid(),
       user_id uuid not null references auth.users(id) on delete cascade,
       type text not null default 'sotd_reaction',
       message text not null default '',
       payload jsonb,
       created_at timestamptz not null default now(),
       read_at timestamptz
     );
     alter table public.notifications enable row level security;
     drop policy if exists "notifications_select_own" on public.notifications;
     create policy "notifications_select_own" on public.notifications for select to authenticated using (user_id = auth.uid());
     drop policy if exists "notifications_insert" on public.notifications;
     create policy "notifications_insert" on public.notifications for insert to authenticated with check (user_id <> auth.uid());
       drop policy if exists "notifications_update_own" on public.notifications;
       create policy "notifications_update_own" on public.notifications for update to authenticated using (user_id = auth.uid());

       -- Realtime: required so postgres_changes events fire for this table
       alter publication supabase_realtime add table public.notifications;
       alter table public.notifications replica identity full;


      create table if not exists public.feed_reactions (
        id uuid primary key default gen_random_uuid(),
        song_owner_id uuid not null references auth.users(id) on delete cascade,
        song_id text not null,
        reactor_id uuid not null references auth.users(id) on delete cascade,
        emoji text not null,
        created_at timestamptz not null default now(),
        unique(song_owner_id, song_id, reactor_id)
      );
      alter table public.feed_reactions enable row level security;
      drop policy if exists "feedr_select" on public.feed_reactions;
      create policy "feedr_select" on public.feed_reactions for select to authenticated using (true);
      drop policy if exists "feedr_insert" on public.feed_reactions;
      create policy "feedr_insert" on public.feed_reactions for insert to authenticated with check (reactor_id = auth.uid());
      drop policy if exists "feedr_delete" on public.feed_reactions;
      create policy "feedr_delete" on public.feed_reactions for delete using (reactor_id = auth.uid());
*/
(function(){
  const SOTD_EMOJIS = ['👍','👎','❤️','🔥','😮','😂','😢','🎉','💯'];
  const SOTD_RANDOM_TERMS = ['summer','love','forever','night','heart','dream','stars','golden','honey','waves','midnight','highway','shine','wild','city'];
  let sotdSong = null;
  let sotdPickedBy = null;
  let sotdReactions = [];
  let sotdProfiles = [];
  let sotdPollTimer = null;
  let sotdLoading = false;
  let sotdOpen = false;
  let sotdCurrentStreak = 0;
  let sotdBestStreak = 0;
  let sotdNotifTimer = null;

  window.sotdPreviewSong = function(){
    if(!sotdSong) return null;
    return {
      id: 'sotd',
      title: sotdSong.title || '',
      artists: sotdSong.artist ? [sotdSong.artist] : [],
      previewUrl: sotdSong.previewUrl || ''
    };
  };
  window.sotdPersistPreview = function(url){
    if(!sotdSong || !url || sotdSong.previewUrl === url) return;
    sotdSong.previewUrl = url;
    try{
      if(sb) sb.from('song_of_the_day').update({ song: sotdSong, updated_at: new Date().toISOString() }).eq('song_date', sotdToday()).then(()=>{});
    }catch(e){}
  };

  function sotdToday(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function sotdStreakFromDates(dateSet, todayStr){
    const fmt = d => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const prevDay = s => {
      const d = new Date(s + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return fmt(d);
    };
    let current = 0;
    let cursor = dateSet.has(todayStr) ? todayStr : prevDay(todayStr);
    while(dateSet.has(cursor)){
      current++;
      cursor = prevDay(cursor);
    }
    const sorted = [...dateSet].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for(const s of sorted){
      run = (prev && prevDay(s) === prev) ? run + 1 : 1;
      if(run > best) best = run;
      prev = s;
    }
    return { current, best };
  }
  window.sotdStreakFromDates = sotdStreakFromDates;
  async function sotdLoadStreaks(){
    if(!currentUserId) return;
    try{
      const { data, error } = await sb.from('sotd_reactions').select('song_date').eq('user_id', currentUserId);
      if(error || !data) return;
      const set = new Set(data.map(r=>String(r.song_date || '').slice(0,10)).filter(Boolean));
      const s = sotdStreakFromDates(set, sotdToday());
      sotdCurrentStreak = s.current;
      sotdBestStreak = s.best;
    }catch(e){}
  }
  function sotdNotifRows(emoji, date){
    if(!currentUserId || !sotdSong) return [];
    const title = sotdSong.title || 'today\'s song';
    const me = (typeof myProfile !== 'undefined' && myProfile && myProfile.username) ? '@' + myProfile.username : 'Someone';
    return (typeof myFriendIds !== 'undefined' && myFriendIds && myFriendIds.size > 0 ? [...myFriendIds] : [])
      .filter(id => id !== currentUserId)
      .map(id => ({
        user_id: id,
        type: 'sotd_reaction',
        message: me + ' reacted to "' + title + '" ' + (emoji || ''),
        payload: { song_date: date, emoji: emoji || '', title: title }
      }));
  }
  async function sendSotdReactionNotifs(emoji, date){
    if(!sb) return;
    const rows = sotdNotifRows(emoji, date);
    if(rows.length === 0) return;
    try{
      await sb.from('notifications').insert(rows);
    }catch(e){
      console.error('Error notifying friends about SOTD reaction:', e);
    }
  }
  function showSotdToast(n){
    const wrap = document.getElementById('toastWrap');
    if(!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="toast-icon">🔥</span><div class="toast-body"><b>${escapeHtml(n.message || 'Someone reacted to the song of the day')}</b></div>`;
    el.addEventListener('click', ()=>{
      if(el.parentNode) el.remove();
      if(!sotdOpen) sotdToggle();
    });
    wrap.appendChild(el);
    setTimeout(()=>{ if(el.parentNode) el.remove(); }, 8000);
  }
  let notifTableMissing = false;
  async function checkSotdNotifs(){
    if(!currentUserId || !sb || notifTableMissing) return;
    try{
      const { data, error } = await sb.from('notifications').select('*').eq('user_id', currentUserId).is('read_at', null).order('created_at', { ascending: false }).limit(10);
      if(error){
        if(error.status === 404 || (error.message && (error.message.includes('404') || error.message.includes('Not Found'))) || (error.code && error.code === 'PGRST205')){
          notifTableMissing = true;
          clearInterval(sotdNotifTimer);
          sotdNotifTimer = null;
        }
        return;
      }
      if(!data || data.length === 0) return;
      const seen = new Set(JSON.parse(localStorage.getItem('bayoutonefm-sotd-notif-seen') || '[]'));
      const fresh = data.filter(n => !seen.has(n.id));
      const toMark = [];
      for(const n of fresh){
        seen.add(n.id);
        toMark.push(n.id);
        showSotdToast(n);
      }
      localStorage.setItem('bayoutonefm-sotd-notif-seen', JSON.stringify([...seen].slice(-100)));
      if(toMark.length > 0){
        const { error: e2 } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', toMark);
        if(e2) console.error('Error marking notifications read:', e2);
      }
    }catch(e){}
  }
  async function sotdRandomSong(){
    const term = SOTD_RANDOM_TERMS[Math.floor(Math.random() * SOTD_RANDOM_TERMS.length)];
    let rows = [];
    try{ rows = await deezerSearch(term, 8); }catch(e){ rows = []; }
    if(rows.length === 0) try{ rows = await itunesSearch(term, 'song', 8); }catch(e2){}
    if(rows.length === 0) return null;
    const r = rows[Math.floor(Math.random() * rows.length)];
    return sotdMapItunes(r);
  }
  function sotdMapItunes(r){
    return {
      title: r.trackName || 'Unknown song',
      artist: r.artistName || '',
      album: r.collectionName || '',
      year: (r.releaseDate && parseInt(String(r.releaseDate).slice(0,4), 10)) || null,
      genre: r.primaryGenreName || '',
      cover: upscaleArtwork(r.artworkUrl100),
      url: r.trackViewUrl || '',
      previewUrl: r.previewUrl || '',
      explicit: r.explicit || false
    };
  }
  let sotdMigrationDone = false;
  async function migrateSotdLinks(){
    if(sotdMigrationDone || !sb) return;
    sotdMigrationDone = true;
    const { data, error } = await sb.from('song_of_the_day').select('song_date, song').order('song_date');
    if(error || !data){
      if(error) console.warn('SOTD migration: could not read songs (' + error.message + ')');
      return;
    }
    const rows = (data || []).filter(r => r && r.song && !/itunes\.apple\.com|music\.apple\.com/i.test(r.song.url || ''));
    console.log('SOTD migration: found ' + rows.length + ' song(s) to re-link to Apple Music');
    for(const row of rows){
      const old = row.song;
      const term = [old.title, old.artist].filter(Boolean).join(' ');
      let hits = [];
      if(term){
        try{ hits = await deezerSearch(term, 5); }catch(e){ hits = []; }
        if(!hits || hits.length === 0) try{ hits = await itunesSearch(term, 'song', 5); }catch(e2){}
      }
      let best = null;
      const wantTitle = String(old.title || '').trim().toLowerCase();
      const wantArtist = String(old.artist || '').trim().toLowerCase();
      best = hits.find(r=> r.previewUrl && String(r.trackName||'').trim().toLowerCase() === wantTitle);
      if(!best) best = hits.find(r=> r.previewUrl && wantArtist && String(r.artistName||'').trim().toLowerCase() === wantArtist);
      if(!best) best = hits.find(r=> r.previewUrl);
      if(!best){
        console.warn('SOTD migration: no Apple Music match for "' + (old.title || '?') + '" — leaving link as-is');
        continue;
      }
      const fresh = sotdMapItunes(best);
      fresh.oldUrl = old.url || '';
      const res = await sb.from('song_of_the_day').update({ song: fresh, updated_at: new Date().toISOString() }).eq('song_date', row.song_date);
      if(res.error){
        console.error('SOTD migration: error re-linking song of the day:', res.error);
      } else {
        console.log('SOTD migration: re-linked ' + row.song_date + ' → ' + fresh.title + ' (Apple Music + preview)');
      }
      await new Promise(r2 => setTimeout(r2, 1100));
    }
    sotdLoad();
  }
  async function sotdLoad(){
    if(!currentUserId) return;
    const date = sotdToday();
    const { data, error } = await sb.from('song_of_the_day').select('*').eq('song_date', date).maybeSingle();
    if(error){ console.error('Error loading song of the day:', error); }
    sotdSong = (data && data.song) || null;
    sotdPickedBy = (data && data.picked_by) || null;
    sotdReactions = [];
    sotdProfiles = [];
    if(sotdSong){
      const { data: rx, error: rxErr } = await sb.from('sotd_reactions').select('user_id, emoji').eq('song_date', date);
      if(!rxErr) sotdReactions = rx || [];
      const ids = [...new Set(sotdReactions.map(r=>r.user_id))];
      if(ids.length > 0){
        const { data: profs, error: pErr } = await sb.from('profiles').select('user_id, username, photo').in('user_id', ids);
        if(!pErr) sotdProfiles = profs || [];
      }
    }
    await sotdLoadStreaks();
    renderSotdDock();
  }
  async function sotdPick(){
    if(!currentUserId || sotdLoading) return;
    sotdLoading = true;
    renderSotdDock({ picking: true });
    const date = sotdToday();
    const existing = await sb.from('song_of_the_day').select('song_date').eq('song_date', date).maybeSingle();
    if(existing && existing.data && existing.data.song_date){
      sotdLoading = false;
      await sotdLoad();
      return;
    }
    let song = null;
    try{ song = await sotdRandomSong(); }catch(e){ song = null; }
    sotdLoading = false;
    if(!song){
      renderSotdDock({ error: "Couldn't find a song right now — try again in a moment." });
      return;
    }
    const { error } = await sb.from('song_of_the_day').upsert(
      { song_date: date, song, picked_by: currentUserId, updated_at: new Date().toISOString() },
      { onConflict: 'song_date' }
    );
    if(error){ console.error('Error saving song of the day:', error); renderSotdDock({ error: "Couldn't save today's song." }); return; }
    sotdSong = song;
    sotdPickedBy = currentUserId;
    renderSotdDock();
  }
  async function sotdReact(emoji){
    if(!currentUserId || !sotdSong) return;
    trackEvent('sotd_react', { emoji });
    const date = sotdToday();
    const mine = sotdReactions.find(r=>r.user_id === currentUserId);
    if(mine && mine.emoji === emoji){
      const { error } = await sb.from('sotd_reactions').delete().eq('song_date', date).eq('user_id', currentUserId);
      if(error){ console.error('Error removing reaction:', error); return; }
      sotdReactions = sotdReactions.filter(r=>r.user_id !== currentUserId);
    } else {
      const { error } = await sb.from('sotd_reactions').upsert(
        { song_date: date, user_id: currentUserId, emoji },
        { onConflict: 'song_date,user_id' }
      );
      if(error){ console.error('Error saving reaction:', error); return; }
      sotdReactions = sotdReactions.filter(r=>r.user_id !== currentUserId);
      sotdReactions.push({ user_id: currentUserId, emoji });
      await sendSotdReactionNotifs(emoji, date);
    }
    const ids = [...new Set(sotdReactions.map(r=>r.user_id))];
    if(ids.length > 0){
      const { data, error } = await sb.from('profiles').select('user_id, username, photo').in('user_id', ids);
      if(!error) sotdProfiles = data || [];
    }
    await sotdLoadStreaks();
    renderSotdDock();
  }
  function sotdProfileFor(id){
    return sotdProfiles.find(p=>p.user_id === id) || null;
  }
  function sotdAvatarHtml(p){
    if(p && p.photo) return `<span class="sotd-avatar"><img src="${escapeAttr(p.photo)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;"></span>`;
    return `<span class="sotd-avatar">${escapeHtml(((p && p.username) || '?').charAt(0).toUpperCase())}</span>`;
  }
  function renderSotdDock(extra){
    const dock = document.getElementById('sotdDock');
    if(!dock) return;
    if(extra && extra.picking){
      if(sotdOpen){
        dock.style.display = '';
        dock.innerHTML = '<div class="sotd-empty">Picking today\'s song…</div>';
      }
      return;
    }
    if(extra && extra.error){
      if(sotdOpen){
        dock.style.display = '';
        dock.innerHTML = `<div class="sotd-empty">${escapeHtml(extra.error)}</div>`;
      }
      return;
    }
    if(!sotdSong){
      dock.style.display = 'none';
      return;
    }
    const mine = sotdReactions.find(r=>r.user_id === currentUserId);
    const emojiHtml = SOTD_EMOJIS.map(e=>{
      const on = (mine && mine.emoji === e) ? ' on' : '';
      return `<button type="button" class="sotd-emoji-btn${on}" data-sotd-emoji="${e}" title="React with ${e}">${e}</button>`;
    }).join('');
    let reactionsHtml;
    if(sotdReactions.length > 0){
      reactionsHtml = sotdReactions.map(r=>{
        const p = sotdProfileFor(r.user_id);
        return `<span class="sotd-reactor" data-sotd-reactor="${r.user_id}" title="View profile">
          ${sotdAvatarHtml(p)}
          <span class="sotd-emoji">${r.emoji}</span>
        </span>`;
      }).join('');
    } else {
      reactionsHtml = '<span class="sotd-empty">No reactions yet — be the first!</span>';
    }
    const cover = sotdSong.cover
      ? `<img class="sotd-cover" src="${escapeAttr(sotdSong.cover)}" alt="Album cover">`
      : `<span class="sotd-cover" style="display:flex;align-items:center;justify-content:center;font-size:20px;">🎵</span>`;
    const link = sotdSong.url ? `<a class="sotd-link" href="${escapeAttr(sotdSong.url)}" target="_blank" rel="noopener">Open ↗</a>` : '';
    const streakHtml = (sotdCurrentStreak > 0 || sotdBestStreak > 0)
      ? `<div class="sotd-streak${mine ? '' : ' at-risk'}" title="${mine ? 'Streak for reacting to the song of the day' : 'React today to keep your ' + sotdCurrentStreak + '-day streak going'}">🔥 <b>${sotdCurrentStreak}</b>-day streak${sotdBestStreak > sotdCurrentStreak ? ` <span class="sotd-streak-best">best ${sotdBestStreak}</span>` : ''}</div>`
      : '';
    dock.innerHTML = `
      <div class="sotd-dock-head">
        ${cover}
        <div class="sotd-meta">
          <div class="sotd-label">Song of the Day</div>
          <div class="sotd-title">${escapeHtml(sotdSong.title || 'Unknown song')}</div>
          <div class="sotd-artist">${escapeHtml(sotdSong.artist || '')}</div>
        </div>
        <div class="sotd-preview">
          ${sotdSong.explicit ? '<span class="explicit-badge" title="Explicit content">E</span>' : ''}
          <button type="button" class="preview-btn" data-preview="sotd" title="Play a 30-second preview" aria-label="Play 30-second preview">▶</button>
          <span class="preview-hint">30-sec preview</span>
        </div>
        ${link}
      </div>
      ${streakHtml}
      <div class="sotd-emojis">${emojiHtml}</div>
      <div class="sotd-reactions"><span class="sotd-reactions-label">Reactions</span>${reactionsHtml}</div>
      <button type="button" class="sotd-prev-btn" data-sotd-history>📜 Previous SOTDs</button>
      ${(myProfile && myProfile.username === 'samannleblanc') ? '<button type="button" class="theme-btn sotd-schedule-inline-btn" data-sotd-schedule style="margin-top:10px;width:100%;">📅 Schedule Week</button>' : ''}`;
    dock.style.display = sotdOpen ? '' : 'none';
  }
  function sotdToggle(){
    if(!currentUserId) return;
    const dock = document.getElementById('sotdDock');
    if(!dock) return;
    if(sotdOpen){
      sotdOpen = false;
      dock.style.display = 'none';
    } else {
      sotdOpen = true;
      if(!sotdSong){ sotdPick(); }
      else { renderSotdDock(); }
    }
  }
  async function sotdOpenProfile(userId){
    if(!userId) return;
    if(userId === currentUserId){
      if(typeof renderMyProfileView === 'function'){
        renderMyProfileView();
        const ov = document.getElementById('myProfileOverlay');
        if(ov) ov.classList.add('open');
      }
      return;
    }
    if(typeof openOtherProfile !== 'function') return;
    const cache = (typeof allProfilesCache !== 'undefined') ? allProfilesCache : null;
    let p = cache ? cache.find(x=>x.user_id === userId) : null;
    if(!p){
      const { data, error } = await sb.from('profiles').select('user_id, username, bio, photo').eq('user_id', userId).maybeSingle();
      if(!error && data && data.username && cache) cache.push(data);
    }
    openOtherProfile(userId);
   }

   let sotdHistoryData = null;
   let sotdHistoryLoading = false;

   async function sotdLoadHistory(){
     if(!sb || sotdHistoryLoading) return;
     sotdHistoryLoading = true;
     try{
        const { data: songs, error } = await sb.from('song_of_the_day')
          .select('song_date, song, picked_by')
          .lte('song_date', sotdToday())
          .order('song_date', { ascending: false })
          .limit(200);
       if(error){ console.error('Error loading SOTD history:', error); return; }
       if(!songs || songs.length === 0){ sotdHistoryData = []; return; }
       const dates = songs.map(s => s.song_date);
       const { data: rxns, error: rErr } = await sb.from('sotd_reactions')
         .select('song_date, user_id, emoji')
         .in('song_date', dates);
       const reactionMap = {};
       if(!rErr && rxns){
         for(const r of rxns){
           const d = String(r.song_date).slice(0,10);
           if(!reactionMap[d]) reactionMap[d] = [];
           reactionMap[d].push({ user_id: r.user_id, emoji: r.emoji });
         }
       }
       const userIds = [...new Set(Object.values(reactionMap).flat().map(r => r.user_id))];
       let profileMap = {};
       if(userIds.length > 0){
         const { data: profs, error: pErr } = await sb.from('profiles')
           .select('user_id, username, photo')
           .in('user_id', userIds);
         if(!pErr && profs){
           for(const p of profs) profileMap[p.user_id] = p;
         }
       }
       sotdHistoryData = songs.map(s => ({
         date: String(s.song_date).slice(0,10),
         song: s.song,
         pickedBy: s.picked_by,
         reactions: (reactionMap[String(s.song_date).slice(0,10)] || []).map(r => ({
           ...r,
           profile: profileMap[r.user_id] || null
         }))
       }));
     }catch(e){ console.error('SOTD history error:', e); }
     finally{ sotdHistoryLoading = false; }
   }

   function sotdFormatDate(dateStr){
     const d = new Date(dateStr + 'T00:00:00');
     return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
   }

   function sotdRenderHistory(){
     const listEl = document.getElementById('sotdHistoryList');
     const countEl = document.getElementById('sotdHistoryCount');
     if(!listEl) return;
     if(!sotdHistoryData){
       listEl.innerHTML = '<div class="sotd-history-empty">Loading…</div>';
       countEl.textContent = '';
       return;
     }
     if(sotdHistoryData.length === 0){
       listEl.innerHTML = '<div class="sotd-history-empty">No songs of the day yet. Come back tomorrow!</div>';
       countEl.textContent = '';
       return;
     }
     const searchEl = document.getElementById('sotdHistorySearch');
     const fromEl = document.getElementById('sotdHistoryFrom');
     const toEl = document.getElementById('sotdHistoryTo');
     const q = (searchEl ? searchEl.value.trim().toLowerCase() : '');
     const from = fromEl ? fromEl.value : '';
     const to = toEl ? toEl.value : '';
     let filtered = sotdHistoryData;
     if(q){
       filtered = filtered.filter(item => {
         const title = (item.song && item.song.title || '').toLowerCase();
         const artist = (item.song && item.song.artist || '').toLowerCase();
         return title.includes(q) || artist.includes(q);
       });
     }
     if(from){ filtered = filtered.filter(item => item.date >= from); }
     if(to){ filtered = filtered.filter(item => item.date <= to); }
     countEl.textContent = filtered.length + ' song' + (filtered.length === 1 ? '' : 's') + ' of the day';
     if(filtered.length === 0){
       listEl.innerHTML = '<div class="sotd-history-empty">No songs match your filters.</div>';
       return;
     }
     listEl.innerHTML = filtered.map(item => {
       const song = item.song || {};
       const cover = song.cover
         ? `<img class="sotd-history-cover" src="${escapeAttr(song.cover)}" alt="Album cover">`
         : `<span class="sotd-history-cover-fallback">🎵</span>`;
       const link = song.url
         ? `<a class="sotd-history-link" href="${escapeAttr(song.url)}" target="_blank" rel="noopener">Open ↗</a>`
         : '';
       let reactionsHtml;
       if(item.reactions.length > 0){
         reactionsHtml = item.reactions.map(r => {
           const p = r.profile;
           const avatar = (p && p.photo)
             ? `<span class="sotd-avatar"><img src="${escapeAttr(p.photo)}" alt="Profile photo" style="width:100%;height:100%;object-fit:cover;"></span>`
             : `<span class="sotd-avatar">${escapeHtml(((p && p.username) || '?').charAt(0).toUpperCase())}</span>`;
           return `<span class="sotd-history-reactor" data-sotd-history-reactor="${r.user_id}" title="${escapeAttr(p && p.username ? '@' + p.username : 'View profile')}">${avatar}<span class="sotd-emoji">${r.emoji}</span></span>`;
         }).join('');
       } else {
         reactionsHtml = '<span class="sotd-history-no-react">No reactions</span>';
       }
       return `<div class="sotd-history-item">
         <div class="sotd-history-date">${sotdFormatDate(item.date)}</div>
         <div class="sotd-history-song">${cover}
           <div class="sotd-history-info">
             <div class="sotd-history-title">${escapeHtml(song.title || 'Unknown song')}</div>
             <div class="sotd-history-artist">${escapeHtml(song.artist || '')}</div>
           </div>
           ${link}
         </div>
         <div class="sotd-history-reactions"><span class="sotd-history-reactions-label">Reactions</span>${reactionsHtml}</div>
       </div>`;
     }).join('');
   }

   async function sotdOpenHistory(){
     const ov = document.getElementById('sotdHistoryOverlay');
     if(!ov) return;
     trackEvent('open_sotd_history');
     ov.classList.add('open');
     if(!sotdHistoryData){
       sotdRenderHistory();
       await sotdLoadHistory();
     }
     sotdRenderHistory();
   }

   function sotdCloseHistory(){
     const ov = document.getElementById('sotdHistoryOverlay');
     if(ov) ov.classList.remove('open');
   }

   function initSotdHistoryEvents(){
     document.getElementById('sotdHistoryCloseBtn').addEventListener('click', sotdCloseHistory);
     const ov = document.getElementById('sotdHistoryOverlay');
     if(ov) ov.addEventListener('click', e=>{ if(e.target === ov) sotdCloseHistory(); });
     const searchEl = document.getElementById('sotdHistorySearch');
     if(searchEl) searchEl.addEventListener('input', sotdRenderHistory);
     const fromEl = document.getElementById('sotdHistoryFrom');
     if(fromEl) fromEl.addEventListener('change', sotdRenderHistory);
     const toEl = document.getElementById('sotdHistoryTo');
     if(toEl) toEl.addEventListener('change', sotdRenderHistory);
     const clearBtn = document.getElementById('sotdHistoryClearBtn');
     if(clearBtn) clearBtn.addEventListener('click', ()=>{
       if(searchEl) searchEl.value = '';
       if(fromEl) fromEl.value = '';
       if(toEl) toEl.value = '';
       sotdRenderHistory();
     });
     const listEl = document.getElementById('sotdHistoryList');
     if(listEl) listEl.addEventListener('click', e=>{
       const reactor = e.target.closest('[data-sotd-history-reactor]');
       if(reactor){ sotdOpenProfile(reactor.dataset.sotdHistoryReactor); }
     });
     document.addEventListener('keydown', e=>{
       if(e.key === 'Escape'){
         const ov2 = document.getElementById('sotdHistoryOverlay');
         if(ov2 && ov2.classList.contains('open')) sotdCloseHistory();
       }
     });
   }

   function initSotdEvents(){
     document.getElementById('sotdBtn').addEventListener('click', ()=>{ trackEvent('open_sotd'); sotdToggle(); });
     document.getElementById('sotdDock').addEventListener('click', e=>{
       const btn = e.target.closest('[data-sotd-emoji]');
       if(btn){ sotdReact(btn.dataset.sotdEmoji); return; }
       const reactor = e.target.closest('[data-sotd-reactor]');
       if(reactor){ sotdOpenProfile(reactor.dataset.sotdReactor); return; }
       const historyBtn = e.target.closest('[data-sotd-history]');
       if(historyBtn){ sotdOpenHistory(); return; }
       const scheduleBtn = e.target.closest('[data-sotd-schedule]');
       if(scheduleBtn && typeof window.openSotdSchedulerFromDock === 'function'){ window.openSotdSchedulerFromDock(); }
     });
     initSotdHistoryEvents();
   }
  function startSotdPolling(){
    clearInterval(sotdPollTimer);
    sotdPollTimer = setInterval(()=>{
      if(currentUserId){ sotdLoad(); migrateSotdLinks(); }
    }, 10000);
    clearInterval(sotdNotifTimer);
    sotdNotifTimer = setInterval(()=>{
      if(currentUserId){ checkSotdNotifs(); }
    }, 4000);
  }
  function sotdOnAuth(event){
    if(event === 'SIGNED_IN' || event === 'INITIAL_SESSION'){
      sotdOpen = false;
      sotdReactions = [];
      sotdProfiles = [];
      sotdLoad();
      migrateSotdLinks();
      checkSotdNotifs();
    }
    if(event === 'SIGNED_OUT'){
      sotdOpen = false;
      sotdSong = null;
      sotdPickedBy = null;
      sotdReactions = [];
      sotdProfiles = [];
      clearInterval(sotdNotifTimer);
      sotdNotifTimer = null;
      const wrap = document.getElementById('toastWrap');
      if(wrap) wrap.innerHTML = '';
      const dock = document.getElementById('sotdDock');
      if(dock) dock.style.display = 'none';
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initSotdEvents);
  } else {
    initSotdEvents();
  }
  startSotdPolling();
  if(sb && sb.auth){
    sb.auth.onAuthStateChange((event)=>{ sotdOnAuth(event); });
  }
})();
