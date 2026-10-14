
/* ---- SITE WALKTHROUGH ---- */
(function(){
  const TOUR_SEEN_KEY = 'bayt-tour-seen-';
  let idx = 0;
  let slides = [];
  let currentOverlay = null;
  let active = false;
  let repoTimer = null;

  const TOUR_SLIDES = [
    { target:'#notifBtn', title:'Notifications', body:'The <b>bell</b> is your notifications — when friends like your songs, comment on them, or send a friendship request, it shows up here.' },
    { target:'#messagesBtn', title:'Messages', body:'Chat with friends and trade song recommendations. Your conversations and reactions all live here.' },
    { target:'#feedBtn', title:'Feed', body:'A stream of what your friends are adding to their cataloguex — flip to <b>🌐 Discover</b> to see songs from everyone on bayoutonefm.' },
    { target:'#sotdBtn', title:'Song of the Day', body:'A daily spotlight pick for you and your crew. See today\u2019s song, vote on tomorrow\u2019s, and compare what everyone\u2019s playing.' },
    { target:'#leaderboardBtn', title:'Leaderboards', body:'Weekly rankings for you and your friends — points, tiers, and bragging rights for the best ears.' },
    { target:'#statsBtn', title:'Stats', body:'Your listening stats and breakdowns — how you rate, what you replay, and where your taste lives.' },
    { target:'#songDbBtn', title:'Song Database', body:'Every song anyone adds builds the shared <b>Song Database</b> — it unlocks once you\u2019ve added your first song. 🚧 <b>We\u2019re currently working on it</b> — it\u2019s not fully functional yet, but it\u2019s being built up for the future.' },
    { target:'#toggleTierBoard', title:'Tier board', body:'Rate a song and it lands on your tier board — your personal ★ to C ranking of everything you love.' },
    { target:'#toggleTimeline', title:'Timeline', body:'Your music story in the order you added it — scroll through the journey from first song to latest.' },
    { target:'#viewClustersBtn', title:'Stacks', body:'Group songs into stacks — mixtapes, moods, eras. Hit <b>+ Create Stack</b> to start one, then pull it up anytime from View Stacks.' },
  ];

  const ADD_MUSIC_SLIDES = [
    { target:'#openAddMusic', title:'Add your first song!', body:'This is where your cataloguex begins. When you\u2019re ready, open the Add Music menu to bring in your first song.' },
    { overlay:'addMusicOverlay', target:'#addMusicSongBtn', title:'Add your first song!', body:'Choose <b>+ Song</b> for a single track, <b>+ Album</b> / <b>+ Playlist</b> to add a whole project at once — paste an Apple Music, Spotify, YouTube, or Tidal link — or <b>+ Live Listen</b> to identify a song playing nearby.' },
    { overlay:'overlay', target:'#f-song-search', title:'Add your first song!', body:'Search a title or artist and tap a result — we\u2019ll fill in title, artist, album, year, genre, and cover art automatically.' },
    { overlay:'overlay', target:'#f-title', title:'Add your first song!', body:'The song title goes here. You can edit any field if the search didn\u2019t know it.' },
    { overlay:'overlay', target:'#f-score', title:'Add your first song!', body:'Drop in a score from <b>30–100</b> and the tier sets itself — 95+ is <b>★</b>, 85+ is <b>S</b>, 70+ is <b>A</b>, 50+ is <b>B</b>, and below is <b>C</b>.' },
    { overlay:'overlay', target:'#tierPicker', title:'Add your first song!', body:'Tiers power your tier board and leaderboards. Pick a tier by hand here and the score fills itself in — either way works.' },
    { overlay:'overlay', target:'#f-stars-lyrics', title:'Category ratings', body:'Give it up to <b>5 stars</b> for <b>🎤 Lyrics</b>, <b>🎶 Vocals</b>, and <b>🔁 Replay-ability</b> — friends see them on the back of your song cards.' },
    { overlay:'overlay', target:'#f-vibe-energy', title:'Song vibes', body:'Slide <b>⚡ Energy</b> (chill ↔ electric), <b>🌗 Mood</b> (stormy ↔ sunny), and <b>🕰️ Nostalgia</b> (new ↔ familiar) — they show a song\u2019s feel at a glance.' },
    { overlay:'overlay', target:'#f-why', title:'Add your first song!', body:'The opinions are the heart of it — write why you love it, how it hits, what it reminds you of. That part only comes from you.' },
    { overlay:'overlay', target:'#saveBtn', title:'Add your first song!', body:'Hit <b>Save song</b> and your cataloguex has its first entry. Welcome — now make it yours.' },
  ];

  const AFTER_FIRST_SLIDES = [
    { overlay:'songDbInfoOverlay', target:'#songDbInfoOverlay h3', title:'Song Database', finish:true, body:'Your song is now part of the <b>Song Database</b> — the shared library built by everyone on bayoutonefm. 🚧 <b>We\u2019re still working on it</b>, so it isn\u2019t fully functional yet — but your songs are seeding it for the future. That\u2019s it — happy cataloging!' },
  ];

  function el(id){ return document.getElementById(id); }
  function setPane(id, l, t, w, h){
    const p = el(id);
    p.style.left = Math.max(0, l) + 'px';
    p.style.top = Math.max(0, t) + 'px';
    p.style.width = Math.max(0, w) + 'px';
    p.style.height = Math.max(0, h) + 'px';
  }
  function closeTourOverlays(){
    ['overlay','addMusicOverlay','spotifyImportOverlay','listenOverlay','messagesOverlay','notifOverlay','feedOverlay','statsOverlay','sotdOverlay','leaderboardOverlay','songDbInfoOverlay'].forEach(id=>{
      const ov = el(id);
      if(ov) ov.classList.remove('open');
    });
    currentOverlay = null;
  }
  function refresh(){
    if(!active) return;
    const s = slides[idx] || {};
    const vw = window.innerWidth, vh = window.innerHeight;
    el('wtTitle').textContent = s.title || '';
    el('wtBody').innerHTML = s.body || '';
    el('wtStep').textContent = 'Step ' + (idx + 1) + ' of ' + slides.length;
    el('wtPrev').style.display = idx === 0 ? 'none' : '';
    el('wtNext').textContent = s.finish ? 'Finish' : 'Next';
    let m = null;
    let t = null;
    if(s.target){
      try{ t = document.querySelector(s.target); }catch(e){ t = null; }
    }
    if(t && t.offsetParent !== null){
      const r = t.getBoundingClientRect();
      if(r.width > 0 && r.height > 0){
        m = { r, vw, vh };
        if(s.target === '#f-song-search'){
          const resEl = el('songSearchResults');
          if(resEl && resEl.children.length && resEl.offsetHeight > 0){
            const rr = resEl.getBoundingClientRect();
            const top = Math.min(r.top, rr.top), bottom = Math.max(r.bottom, rr.bottom);
            const left = Math.min(r.left, rr.left), right = Math.max(r.right, rr.right);
            m.r = { top, bottom, left, right, width: right - left, height: bottom - top };
          }
        }
      }
    }
    if(m){
      setPane('wtPaneTop', 0, 0, vw, m.r.top);
      setPane('wtPaneBottom', 0, m.r.bottom, vw, vh - m.r.bottom);
      setPane('wtPaneLeft', 0, m.r.top, m.r.left, m.r.height);
      setPane('wtPaneRight', m.r.right, m.r.top, vw - m.r.right, m.r.height);
      const ring = el('wtRing');
      ring.style.display = 'block';
      ring.style.left = (m.r.left - 6) + 'px';
      ring.style.top = (m.r.top - 6) + 'px';
      ring.style.width = (m.r.width + 12) + 'px';
      ring.style.height = (m.r.height + 12) + 'px';
    } else {
      setPane('wtPaneTop', 0, 0, vw, vh);
      setPane('wtPaneBottom', 0, 0, 0, 0);
      setPane('wtPaneLeft', 0, 0, 0, 0);
      setPane('wtPaneRight', 0, 0, 0, 0);
      el('wtRing').style.display = 'none';
    }
    placeTooltip(m);
  }
  function placeTooltip(m){
    const tip = el('wtTooltip');
    tip.style.left = '0';
    tip.style.top = '0';
    const tw = tip.offsetWidth || 340;
    const th = tip.offsetHeight;
    const pad = 14;
    const vw = window.innerWidth, vh = window.innerHeight;
    const freeTop = th + 70;
    let x, y;
    if(m){
      if(vh - m.r.bottom > freeTop){ y = m.r.bottom + 18; x = Math.min(m.r.left, vw - tw - pad); }
      else if(m.r.top > freeTop){ y = m.r.top - th - 18; x = vw - tw - pad; }
      else { y = (vh - th) / 2; x = (vw - tw) / 2; }
    } else {
      y = (vh - th) / 2;
      x = (vw - tw) / 2;
    }
    x = Math.max(pad, Math.min(x, vw - tw - pad));
    y = Math.max(pad, Math.min(y, vh - th - pad));
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function enterSlide(i){
    idx = i;
    const s = slides[i];
    if(s.overlay){
      if(currentOverlay && currentOverlay !== s.overlay){
        const ov = el(currentOverlay);
        if(ov) ov.classList.remove('open');
      }
      if(s.overlay === 'overlay'){
        const ov = el('overlay');
        if(ov && !ov.classList.contains('open')){
          if(typeof openModal === 'function'){ try{ openModal(null); }catch(e){} }
          else if(ov) ov.classList.add('open');
        }
      } else {
        const ov = el(s.overlay);
        if(ov && !ov.classList.contains('open')) ov.classList.add('open');
      }
      currentOverlay = s.overlay;
    } else {
      closeTourOverlays();
    }
    refresh();
    let t = null;
    if(s.target){
      try{ t = document.querySelector(s.target); }catch(e){ t = null; }
    }
    if(t && t.offsetParent !== null){
      try{ t.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){}
    }
    setTimeout(refresh, 430);
  }
  function endTour(){
    if(!active) return;
    active = false;
    closeTourOverlays();
    const wt = el('walkthrough');
    if(wt){ wt.classList.remove('open'); wt.setAttribute('aria-hidden', 'true'); }
    try{ localStorage.setItem(TOUR_SEEN_KEY + (window.currentUserId || 'anon'), '1'); }catch(e){}
    if(typeof trackEvent === 'function'){ try{ trackEvent('tour_done'); }catch(e){} }
  }
  function startTour(){
    if(active) return;
    if(!window.currentUserId) return;
    const wt = el('walkthrough');
    if(!wt) return;
    closeTourOverlays();
    showArchived = false;
    viewingWishlist = false;
    viewingTierBoard = false;
    viewingTimeline = false;
    if(typeof updateViewUI === 'function'){ try{ updateViewUI(); }catch(e){} }
    if(typeof render === 'function'){ try{ render(); }catch(e){} }
    slides = TOUR_SLIDES.concat(ADD_MUSIC_SLIDES).concat(AFTER_FIRST_SLIDES);
    idx = 0;
    active = true;
    currentOverlay = null;
    wt.classList.add('open');
    wt.setAttribute('aria-hidden', 'false');
    try{ trackEvent('tour_start'); }catch(e){}
    enterSlide(0);
  }
  function maybeStartTour(){
    if(!el('walkthrough')) return;
    const key = TOUR_SEEN_KEY + (window.currentUserId || 'anon');
    try{ if(localStorage.getItem(key)) return; }catch(e){ return; }
    // Tour disabled by user preference
    return;
  }

  window.startTour = startTour;
  window.maybeStartTour = maybeStartTour;

  // tour button removed per request
  window.syncTourButton = function(){};
  syncTourButton();
  document.getElementById('wtNext').addEventListener('click', ()=>{
    const s = slides[idx];
    if(s && s.finish){ endTour(); return; }
    if(idx < slides.length - 1) enterSlide(idx + 1);
  });
  document.getElementById('wtPrev').addEventListener('click', ()=>{
    if(idx > 0) enterSlide(idx - 1);
  });
  document.getElementById('wtSkip').addEventListener('click', endTour);

  const onReposition = ()=>{
    if(!active) return;
    clearTimeout(repoTimer);
    repoTimer = setTimeout(refresh, 60);
  };
  window.addEventListener('scroll', onReposition, true);
  window.addEventListener('resize', onReposition);
  const searchResultsEl = document.getElementById('songSearchResults');
  if(searchResultsEl && typeof MutationObserver !== 'undefined'){
    new MutationObserver(()=>{
      if(!active) return;
      clearTimeout(repoTimer);
      repoTimer = setTimeout(refresh, 60);
    }).observe(searchResultsEl, { childList:true, subtree:true });
  }
})();