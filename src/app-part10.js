
/* ================= SONG OF THE DAY: WEEKLY SCHEDULER =================
   Admin-only tool (samannleblanc) to set the song of the day for the
   next 7 days ahead of time. Uses the same song_of_the_day table as
   the main Song of the Day feature — no new backend setup needed. */
(function(){
  let scheduleDays = [];       // [{date, song, pickedBy}]
  let searchState = {};        // date -> { term, results, loading, error }

  function schedDateStr(offset){
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function schedDateLabel(dateStr, offset){
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' });
    return offset === 0 ? label + ' (Today)' : label;
  }
  function schedMapItunes(r){
    return {
      title: r.trackName || 'Unknown song',
      artist: r.artistName || '',
      album: r.collectionName || '',
      year: (r.releaseDate && parseInt(String(r.releaseDate).slice(0,4), 10)) || null,
      genre: r.primaryGenreName || '',
      cover: (typeof upscaleArtwork === 'function') ? upscaleArtwork(r.artworkUrl100) : r.artworkUrl100,
      url: r.trackViewUrl || '',
      previewUrl: r.previewUrl || ''
    };
  }

  async function openSotdScheduler(){
    if(!currentUserId || !sb) return;
    trackEvent('open_sotd_scheduler');
    const overlay = document.getElementById('sotdScheduleOverlay');
    if(!overlay) return;
    overlay.classList.add('open');
    scheduleDays = [];
    searchState = {};
    for(let i=0;i<7;i++){ scheduleDays.push({ date: schedDateStr(i), song: null, pickedBy: null }); }
    renderScheduler({ loading: true });
    const dates = scheduleDays.map(d=>d.date);
    try{
      const { data, error } = await sb.from('song_of_the_day').select('song_date, song, picked_by').in('song_date', dates);
      if(!error && data){
        data.forEach(row=>{
          const day = scheduleDays.find(d=>d.date === row.song_date);
          if(day){ day.song = row.song; day.pickedBy = row.picked_by; }
        });
      }
    }catch(e){}
    renderScheduler();
  }

  function closeSotdScheduler(){
    const overlay = document.getElementById('sotdScheduleOverlay');
    if(overlay) overlay.classList.remove('open');
  }

  function renderScheduler(opts){
    const list = document.getElementById('sotdScheduleList');
    if(!list) return;
    if(opts && opts.loading){
      list.innerHTML = '<div class="sotd-empty">Loading the weekly schedule…</div>';
      return;
    }
    list.innerHTML = scheduleDays.map((day, idx)=>{
      const st = searchState[day.date] || {};
      const song = day.song;
      const currentHtml = song
        ? `<div class="sotd-dock-head" style="margin-bottom:8px;">
            ${song.cover ? `<img class="sotd-cover" src="${escapeAttr(song.cover)}" alt="Album cover">` : '<span class="sotd-cover" style="display:flex;align-items:center;justify-content:center;font-size:18px;">🎵</span>'}
            <div class="sotd-meta">
              <div class="sotd-title">${escapeHtml(song.title || 'Unknown song')}</div>
              <div class="sotd-artist">${escapeHtml(song.artist || '')}</div>
            </div>
            <button type="button" class="btn-cancel" data-sched-clear="${day.date}" style="padding:6px 10px;font-size:12px;">Clear</button>
          </div>`
        : '<div class="sotd-empty" style="margin-bottom:8px;">No song set for this day yet.</div>';
      let resultsHtml = '';
      if(st.loading){
        resultsHtml = '<div class="sotd-empty">Searching…</div>';
      } else if(st.error){
        resultsHtml = `<div class="sotd-empty">${escapeHtml(st.error)}</div>`;
      } else if(st.results && st.results.length){
        resultsHtml = '<div class="discover-list">' + st.results.map((r, ri)=>{
          const mapped = schedMapItunes(r);
          return `<div class="discover-row" data-sched-pick="${day.date}" data-sched-idx="${ri}" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:6px 0;">
            ${mapped.cover ? `<img src="${escapeAttr(mapped.cover)}" alt="Album cover" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">` : ''}
            <div>
              <div style="font-weight:600;">${escapeHtml(mapped.title)}</div>
              <div style="font-size:12px;opacity:0.75;">${escapeHtml(mapped.artist)}</div>
            </div>
          </div>`;
        }).join('') + '</div>';
      }
      return `<div class="field" style="border-bottom:1px solid rgba(var(--on-paper-rgb),0.15);padding-bottom:14px;margin-bottom:14px;">
        <label>${escapeHtml(schedDateLabel(day.date, idx))}</label>
        ${currentHtml}
        <div style="display:flex;gap:8px;">
          <input type="text" placeholder="Search for a song…" data-sched-input="${day.date}" value="${escapeAttr(st.term || '')}">
          <button type="button" class="btn-save" data-sched-search="${day.date}" style="white-space:nowrap;">Search</button>
        </div>
        ${resultsHtml}
      </div>`;
    }).join('');
  }

  async function schedSearch(date){
    const input = document.querySelector(`[data-sched-input="${date}"]`);
    const term = input ? input.value.trim() : '';
    if(!term) return;
    searchState[date] = { term, loading: true };
    renderScheduler();
    try{
      let results = await deezerSearch(term, 6);
      if(!results || results.length === 0){
        results = await itunesSearch(term, 'song', 6);
      }
      searchState[date] = { term, results: results || [] };
      if(!results || results.length === 0){
        searchState[date].error = 'No songs found — try a different search.';
      }
    }catch(e){
      searchState[date] = { term, error: "Couldn't search right now — try again." };
    }
    renderScheduler();
  }

  async function schedPick(date, idx){
    const st = searchState[date];
    if(!st || !st.results || !st.results[idx]) return;
    const song = schedMapItunes(st.results[idx]);
    trackEvent('sotd_schedule_pick', { date });
    const { error } = await sb.from('song_of_the_day').upsert(
      { song_date: date, song, picked_by: currentUserId, updated_at: new Date().toISOString() },
      { onConflict: 'song_date' }
    );
    if(error){
      searchState[date] = { term: st.term, error: "Couldn't save that song — try again." };
      renderScheduler();
      return;
    }
    const day = scheduleDays.find(d=>d.date === date);
    if(day){ day.song = song; day.pickedBy = currentUserId; }
    delete searchState[date];
    renderScheduler();
    if(date === sotdTodayForScheduler() && typeof sotdLoad === 'function'){ sotdLoad(); }
  }

  async function schedClear(date){
    trackEvent('sotd_schedule_clear', { date });
    const { error } = await sb.from('song_of_the_day').delete().eq('song_date', date);
    if(error) return;
    const day = scheduleDays.find(d=>d.date === date);
    if(day){ day.song = null; day.pickedBy = null; }
    renderScheduler();
  }

  function sotdTodayForScheduler(){
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  window.openSotdSchedulerFromDock = openSotdScheduler;
  function initSotdSchedulerEvents(){
    const btn = document.getElementById('sotdScheduleBtn');
    if(btn) btn.addEventListener('click', openSotdScheduler);
    const closeBtn = document.getElementById('sotdScheduleCloseBtn');
    if(closeBtn) closeBtn.addEventListener('click', closeSotdScheduler);
    const overlay = document.getElementById('sotdScheduleOverlay');
    if(overlay){
      overlay.addEventListener('click', e=>{ if(e.target.id === 'sotdScheduleOverlay') closeSotdScheduler(); });
      overlay.addEventListener('click', e=>{
        const searchBtn = e.target.closest('[data-sched-search]');
        if(searchBtn){ schedSearch(searchBtn.dataset.schedSearch); return; }
        const clearBtn = e.target.closest('[data-sched-clear]');
        if(clearBtn){ schedClear(clearBtn.dataset.schedClear); return; }
        const pickRow = e.target.closest('[data-sched-pick]');
        if(pickRow){ schedPick(pickRow.dataset.schedPick, parseInt(pickRow.dataset.schedIdx, 10)); return; }
      });
      overlay.addEventListener('keydown', e=>{
        if(e.key === 'Enter' && e.target.matches('[data-sched-input]')){
          e.preventDefault();
          schedSearch(e.target.dataset.schedInput);
        }
      });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', initSotdSchedulerEvents);
  } else {
    initSotdSchedulerEvents();
  }
})();
