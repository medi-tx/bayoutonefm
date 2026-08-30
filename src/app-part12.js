/* ---- MY CD COLLECTION (certified testers) ---- */
let cdList = [];
let cdScanActive = false;
let cdScanDetector = null;
let cdZxReader = null;
let cdScanStream = null;
let cdScanRaf = 0;
let cdAudio = null;
let cdPendingAlbum = null;
let cdPendingBarcode = '';

function syncCDButton(){}
window.syncCDButton = syncCDButton;
window.openCDCollection = function(){
  if(!(typeof isCertifiedTester === 'function' && isCertifiedTester())){
    showToast('My CDs is for certified testers only for now', 3200);
    return;
  }
  trackEvent('open_my_cds');
  document.getElementById('cdOverlay').classList.add('open');
  loadCDCollection();
  document.getElementById('cdBarcodeInput').value = '';
  document.getElementById('cdBarcodeInput').focus();
};

function cdEscapeAttr(v){ return escapeAttr(v); }
function cdEscape(v){ return escapeHtml(v); }

document.getElementById('cdCloseBtn').addEventListener('click', ()=>{
  stopCDScan();
  document.getElementById('cdOverlay').classList.remove('open');
});
document.getElementById('cdOverlay').addEventListener('click', e=>{
  if(e.target === document.getElementById('cdOverlay')) stopCDScan();
});
document.getElementById('cdScanBtn').addEventListener('click', ()=>{
  trackEvent('cd_start_scan');
  startCDScan();
});
document.getElementById('cdScanStopBtn').addEventListener('click', ()=>{
  stopCDScan();
});
document.getElementById('cdLookupBtn').addEventListener('click', ()=>{
  trackEvent('cd_manual_lookup');
  const val = String(document.getElementById('cdBarcodeInput').value || '').trim();
  if(val) lookupCD(val);
});
document.getElementById('cdBarcodeInput').addEventListener('keydown', e=>{
  if(e.key === 'Enter'){
    const val = String(document.getElementById('cdBarcodeInput').value || '').trim();
    if(val){ trackEvent('cd_manual_lookup'); lookupCD(val); }
  }
});

async function loadCDCollection(){
  const grid = document.getElementById('cdGrid');
  const empty = document.getElementById('cdEmpty');
  grid.innerHTML = '<div class="cd-loading">Loading your CDs…</div>';
  cdList = [];
  let rows = [];
  try{
    const { data, error } = await sb
      .from('cd_collection')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });
    if(error) throw error;
    rows = data || [];
  }catch(err){
    console.error('Error loading CD collection:', err);
    showToast('Could not load your CDs — check your connection', 4000);
  }
  cdList = rows;
  grid.style.display = rows.length ? '' : 'none';
  empty.style.display = rows.length ? 'none' : '';
  if(rows.length){
    grid.innerHTML = cdCardsHtml(rows);
  }
}

function cdCardsHtml(list){
  return list.map(cd=>{
    const cover = cd.cover_art
      ? `<img loading="lazy" decoding="async" class="cd-cover-img" src="${cdEscapeAttr(cd.cover_art)}" alt="" data-initial="${cdEscapeAttr(cd.title ? cd.title.charAt(0).toUpperCase() : '♪')}" onerror="cdCoverFallback(this)">`
      : `<span class="cd-cover-initial">${cdEscape(cd.title ? cd.title.charAt(0).toUpperCase() : '♪')}</span>`;
    return `<button type="button" class="cd-card" data-cd-id="${cdEscapeAttr(cd.id)}" aria-label="View ${cdEscapeAttr(cd.title || 'album')}">
      <span class="cd-cover">${cover}</span>
      <span class="cd-card-info">
        <b class="cd-card-title">${cdEscape(cd.title || 'Unknown album')}</b>
        <span class="cd-card-artist">${cdEscape(cd.artist || 'Unknown artist')}</span>
        <span class="cd-card-year">${cdEscape(cd.year || '')}</span>
      </span>
    </button>`;
  }).join('');
}
window.cdCoverFallback = function(img){
  const cover = img.closest('.cd-cover') || img.parentElement;
  const initial = cover.getAttribute('data-initial') || '♪';
  cover.classList.add('no-cover');
  cover.innerHTML = `<span class="cd-cover-initial">${cdEscape(initial)}</span>`;
};
window.cdVinylFallback = function(img){
  const wrap = img.parentElement;
  const initial = img.getAttribute('data-initial') || '♪';
  if(wrap && wrap.classList.contains('cd-detail-hero')){
    img.replaceWith(`<div class="cd-vinyl cd-vinyl-fallback"><span class="cd-cover-initial">${cdEscape(initial)}</span></div>`);
  }else{
    img.replaceWith(`<div class="cd-vinyl-fallback"><span class="cd-cover-initial">${cdEscape(initial)}</span></div>`);
  }
};
document.getElementById('cdGrid').addEventListener('click', e=>{
  const card = e.target.closest('.cd-card');
  if(!card) return;
  trackEvent('cd_open_detail');
  openCDDetail(card.dataset.cdId);
});

function openCDDetail(id){
  const cd = cdList.find(c=>c.id === id);
  if(!cd) return;
  stopCDScan();
  const body = document.getElementById('cdDetailBody');
  const cover = cd.cover_art
    ? `<img loading="lazy" decoding="async" class="cd-vinyl" src="${cdEscapeAttr(cd.cover_art)}" alt="${cdEscapeAttr(cd.title || 'Album cover')}" data-initial="${cdEscapeAttr((cd.title || '♪').charAt(0).toUpperCase())}" onerror="cdVinylFallback(this)">`
    : `<div class="cd-vinyl cd-vinyl-fallback"><span class="cd-cover-initial">${cdEscape(cd.title ? cd.title.charAt(0).toUpperCase() : '♪')}</span></div>`;
  const meta = [cd.year, cd.country, cd.label].filter(Boolean);
  const tracklist = (cd.tracklist && cd.tracklist.length)
    ? `<div class="cd-tracklist">
        <h4>Tracklist</h4>
        ${cd.tracklist.map(t=>{
          const dur = t.duration ? cdFmtDuration(t.duration) : '';
          const preview = t.preview
            ? `<button type="button" class="cd-track-preview-btn" data-url="${cdEscapeAttr(t.preview)}" title="Play 30s preview">▶</button>`
            : '';
          return `<div class="cd-track-row">
            <span class="cd-track-num">${t.position || '·'}</span>
            <span class="cd-track-name">${cdEscape(t.title || 'Untitled')}</span>
            <span class="cd-track-dur">${dur}</span>
            ${preview}
          </div>`;
        }).join('')}
      </div>`
    : '';
  body.innerHTML = `
    <div class="cd-detail-hero">
      ${cover}
      <div class="cd-detail-info">
        <h3>${cdEscape(cd.title || 'Unknown album')}</h3>
        <p class="cd-detail-artist">${cdEscape(cd.artist || 'Unknown artist')}</p>
        ${meta.length ? `<p class="cd-detail-meta">${cdEscape(meta.join(' · '))}</p>` : ''}
        ${cd.barcode ? `<p class="cd-detail-barcode">UPC/EAN: ${cdEscape(cd.barcode)}</p>` : ''}
        <div class="cd-stream-links">${cdStreamLinks(cd)}</div>
      </div>
    </div>
    ${tracklist}`;
  document.getElementById('cdDetailDeleteBtn').dataset.cdId = cd.id;
  document.getElementById('cdDetailOverlay').classList.add('open');
}
function cdStreamLinks(cd){
  const u = cd.stream_urls || {};
  const q = encodeURIComponent(((cd.artist || '') + ' ' + (cd.title || '')).trim());
  const links = [];
  if(u.deezer) links.push({ label: 'Listen on Deezer', url: u.deezer });
  links.push({ label: 'Spotify', url: 'https://open.spotify.com/search/' + q });
  links.push({ label: 'Apple Music', url: 'https://music.apple.com/search?term=' + q });
  links.push({ label: 'YouTube Music', url: 'https://music.youtube.com/search?q=' + q });
  return links.map(l=>`<a class="cd-stream-link" href="${cdEscapeAttr(l.url)}" target="_blank" rel="noopener noreferrer">${cdEscape(l.label)}</a>`).join('');
}
function cdFmtDuration(ms){
  if(!ms) return '';
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
document.getElementById('cdDetailBody').addEventListener('click', e=>{
  const btn = e.target.closest('.cd-track-preview-btn');
  if(!btn) return;
  cdPlayTrack(btn);
});
function cdPlayTrack(btn){
  const url = btn.dataset.url;
  if(!url) return;
  if(!cdAudio) cdAudio = new Audio();
  if(cdAudio.dataset.url === url && !cdAudio.paused){
    cdAudio.pause();
    cdResetPreviewBtns();
    cdAudio.removeAttribute('src');
    cdAudio.dataset.url = '';
    btn.textContent = '▶';
    return;
  }
  cdResetPreviewBtns();
  cdAudio.dataset.url = url;
  cdAudio.src = url;
  btn.textContent = '⏸';
  btn.classList.add('playing');
  cdAudio.play().catch(()=>{
    btn.textContent = '▶';
    btn.classList.remove('playing');
    showToast('Preview unavailable', 2400);
  });
  cdAudio.onended = ()=>{
    cdResetPreviewBtns();
    cdAudio.removeAttribute('src');
    cdAudio.dataset.url = '';
  };
}
function cdResetPreviewBtns(){
  document.querySelectorAll('#cdDetailBody .cd-track-preview-btn').forEach(b=>{
    b.textContent = '▶';
    b.classList.remove('playing');
  });
}
document.getElementById('cdDetailCloseBtn').addEventListener('click', ()=>{
  if(cdAudio) cdAudio.pause();
  document.getElementById('cdDetailOverlay').classList.remove('open');
});
document.getElementById('cdDetailOverlay').addEventListener('click', e=>{
  if(e.target === document.getElementById('cdDetailOverlay')){
    if(cdAudio) cdAudio.pause();
    document.getElementById('cdDetailOverlay').classList.remove('open');
  }
});
document.getElementById('cdDetailDeleteBtn').addEventListener('click', async ()=>{
  const id = document.getElementById('cdDetailDeleteBtn').dataset.cdId;
  if(!id) return;
  trackEvent('cd_delete');
  const cd = cdList.find(c=>c.id === id);
  const name = cd && cd.title ? cd.title : 'this CD';
  if(!confirm('Remove ' + name + ' from your CDs?')) return;
  try{
    const { error } = await sb.from('cd_collection').delete().eq('user_id', currentUserId).eq('id', id);
    if(error) throw error;
    if(cdAudio) cdAudio.pause();
    document.getElementById('cdDetailOverlay').classList.remove('open');
    showToast('Removed from your CDs', 2400);
    loadCDCollection();
  }catch(err){
    console.error('Error deleting CD:', err);
    showToast('Could not remove that CD', 3200);
  }
});

function startCDScan(){
  const viewport = document.getElementById('cdScanViewport');
  const hint = document.getElementById('cdScanHint');
  viewport.style.display = '';
  hint.textContent = 'Starting camera…';
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    hint.textContent = 'Camera not supported here — type the barcode number above instead.';
    return;
  }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).then(stream=>{
    cdScanStream = stream;
    const video = document.getElementById('cdScanVideo');
    video.srcObject = stream;
    return video.play();
  }).then(()=>{
    if(window['BarcodeDetector']){
      try{
        cdScanDetector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'] });
      }catch(e){ cdScanDetector = null; }
      if(cdScanDetector){
        cdScanActive = true;
        hint.textContent = 'Point the camera at the barcode on the back of the CD case…';
        cdScanLoop(document.getElementById('cdScanVideo'));
        return;
      }
      cdScanDetector = null;
    }
    cdLoadZXingFallback();
  }).catch(err=>{
    console.warn('Camera failed:', err);
    hint.textContent = 'Camera unavailable — type the barcode number above instead.';
  });
}
function cdLoadZXingFallback(){
  const hint = document.getElementById('cdScanHint');
  hint.textContent = 'Loading scanner…';
  if(window['ZXing']){ cdStartZXingScan(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  s.async = true;
  const done = ()=>{ s.onload = s.onerror = null; };
  s.onload = ()=>{ done(); cdStartZXingScan(); };
  s.onerror = ()=>{ done(); hint.textContent = 'Camera is on, but this browser can\u2019t auto-read barcodes — find the number under the barcode and type it above.'; };
  document.head.appendChild(s);
}
function cdStartZXingScan(){
  if(!cdScanStream) return;
  const hint = document.getElementById('cdScanHint');
  if(!window['ZXing'] || !window['ZXing'].BrowserMultiFormatReader){
    hint.textContent = 'Camera is on, but this browser can\u2019t auto-read barcodes — find the number under the barcode and type it above.';
    return;
  }
  hint.textContent = 'Point the camera at the barcode on the back of the CD case…';
  cdScanActive = true;
  try{
    cdZxReader = new window.ZXing.BrowserMultiFormatReader();
    const handles = { tried: 0 };
    const tick = ()=>{
      if(!cdScanActive || !cdZxReader) return;
      cdZxReader.decodeOnceFromStream(cdScanStream, document.getElementById('cdScanVideo')).then(result=>{
        if(!cdScanActive) return;
        const val = String(result && (result.getText ? result.getText() : result.text) || '').replace(/[^0-9]/g, '');
        if(val.length >= 8 && val.length <= 14){
          stopCDScan();
          document.getElementById('cdBarcodeInput').value = val;
          lookupCD(val);
          return;
        }
        handles.tried++;
        if(handles.tried > 20){
          stopCDScan();
          hint.textContent = 'Couldn\u2019t read that barcode — type the number under it above instead.';
          return;
        }
        setTimeout(tick, 250);
      }).catch(()=>{
        if(!cdScanActive) return;
        handles.tried++;
        if(handles.tried > 20){
          stopCDScan();
          hint.textContent = 'Couldn\u2019t read that barcode — type the number under it above instead.';
          return;
        }
        setTimeout(tick, 250);
      });
    };
    tick();
  }catch(e){
    cdScanActive = false;
    console.warn('ZXing scan failed:', e);
    hint.textContent = 'Camera is on, but this browser can\u2019t auto-read barcodes — find the number under the barcode and type it above.';
  }
}
async function cdScanLoop(video){
  if(!cdScanActive) return;
  try{
    const codes = await cdScanDetector.detect(video);
    for(const code of codes){
      const val = String(code.rawValue || '').replace(/[^0-9]/g, '');
      if(val.length >= 8 && val.length <= 14){
        stopCDScan();
        document.getElementById('cdBarcodeInput').value = val;
        lookupCD(val);
        return;
      }
    }
  }catch(e){}
  if(cdScanActive) cdScanRaf = requestAnimationFrame(()=>cdScanLoop(video));
}
function stopCDScan(){
  cdScanActive = false;
  if(cdScanRaf){ cancelAnimationFrame(cdScanRaf); cdScanRaf = 0; }
  if(cdZxReader){ cdZxReader.reset(); cdZxReader = null; }
  if(cdScanStream){
    cdScanStream.getTracks().forEach(t=>t.stop());
    cdScanStream = null;
  }
  const video = document.getElementById('cdScanVideo');
  if(video) video.srcObject = null;
  const viewport = document.getElementById('cdScanViewport');
  if(viewport && viewport.style.display !== 'none') viewport.style.display = 'none';
}

function cdSetStatus(msg, isError){
  const el = document.getElementById('cdLookupStatus');
  el.style.display = msg ? '' : 'none';
  el.textContent = msg || '';
  el.classList.toggle('error', !!isError);
}

async function lookupCD(barcode){
  stopCDScan();
  document.getElementById('cdPreview').style.display = 'none';
  document.getElementById('cdPreview').innerHTML = '';
  cdSetStatus('Looking up barcode ' + barcode + ' on MusicBrainz…');
  try{
    const album = await mbLookupBarcode(barcode);
    if(!album){
      cdSetStatus('No album found for that barcode yet. Double-check the number and try again.', true);
      return;
    }
    cdSetStatus('Found it — adding stream links…');
    await enrichWithDeezer(album);
    cdPendingAlbum = album;
    cdPendingBarcode = barcode;
    cdRenderedLookup(album, barcode);
    cdSetStatus('');
  }catch(err){
    console.error('lookupCD error:', err);
    cdSetStatus('Couldn\u2019t look that up right now — check your connection and try again.', true);
  }
}

async function mbLookupBarcode(barcode){
  const url = 'https://musicbrainz.org/ws/2/release/?query=barcode:' + encodeURIComponent(barcode) + '&fmt=json&inc=artists+labels+recordings&limit=25';
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if(!res.ok) throw new Error('mb_' + res.status);
  const json = await res.json();
  const norm = v => String(v || '').replace(/[^0-9]/g, '');
  const releases = (json.releases || []).filter(r=>r && norm(r.barcode) === norm(barcode));
  if(!releases.length) return null;
  const r = releases[0];
  let artist = '';
  (r['artist-credit'] || []).forEach(c=>{
    artist += ((c.artist && c.artist.name) || c.name || '');
    if(c.joinphrase) artist += c.joinphrase;
  });
  const media = (r.media || []).flatMap(m=> (m.tracks || []).map(t=>({
    position: t.position || 0,
    title: t.title || 'Untitled',
    duration: t.length || 0
  })));
  return {
    mb_id: r.id,
    title: r.title || 'Unknown album',
    artist: artist || 'Unknown artist',
    year: r.date ? String(r.date).slice(0, 4) : '',
    country: r.country || '',
    label: (r['label-info'] && r['label-info'][0] && r['label-info'][0].label && r['label-info'][0].label.name) || '',
    cover_art: 'https://coverartarchive.org/release/' + r.id + '/front-500',
    genres: [],
    tracklist: media,
    stream_urls: {}
  };
}

async function enrichWithDeezer(album){
  const q = ((album.artist || '') + ' ' + (album.title || '')).trim();
  try{
    const data = await cdDeezerAlbumSearch(q);
    const hits = (data.data || []).filter(a=>a && a.title);
    if(!hits.length){
      album.stream_urls.deezer = 'https://www.deezer.com/search/' + encodeURIComponent(q);
      return;
    }
    const lc = album.title.toLowerCase();
    const hit = hits.find(a=>{
      const at = String(a.title || '').toLowerCase();
      return at === lc || at.indexOf(lc) > -1 || lc.indexOf(at) > -1;
    }) || hits[0];
    album.stream_urls.deezer = hit.link || null;
    if(!album.cover_art && hit.cover_medium) album.cover_art = hit.cover_medium || null;
    if(hit.id){
      try{
        const tracks = await cdDeezerAlbumTracks(hit.id);
        const dt = (tracks.data || []);
        album.tracklist.forEach(t=>{
          const m = dt[t.position - 1] || dt.find(x=>Number(x.track_position) === Number(t.position));
          if(m && m.preview) t.preview = m.preview;
        });
      }catch(e){}
    }
  }catch(err){
    console.warn('Deezer enrichment failed:', err);
    album.stream_urls.deezer = 'https://www.deezer.com/search/' + encodeURIComponent(q) || null;
  }
}

function cdDeezerAlbumSearch(q){
  return new Promise((resolve, reject)=>{
    const cbName = 'dzAlb_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('dz_alb_failed')); } };
    script.src = 'https://api.deezer.com/search/album?q=' + encodeURIComponent(q) + '&limit=5&output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('dz_alb_timeout')); } }, 6000);
  });
}
function cdDeezerAlbumTracks(id){
  return new Promise((resolve, reject)=>{
    const cbName = 'dzTr_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;
    const cleanup = ()=>{ delete window[cbName]; script.remove(); };
    window[cbName] = (d)=>{ settled = true; cleanup(); resolve(d); };
    script.onerror = ()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('dz_tr_failed')); } };
    script.src = 'https://api.deezer.com/album/' + encodeURIComponent(id) + '/tracks?output=jsonp&callback=' + cbName;
    document.body.appendChild(script);
    setTimeout(()=>{ if(!settled){ settled = true; cleanup(); reject(new Error('dz_tr_timeout')); } }, 6000);
  });
}

function cdRenderedLookup(album, barcode){
  const preview = document.getElementById('cdPreview');
  const already = cdList.some(c=>c.barcode === barcode);
  const cover = album.cover_art
    ? `<img loading="lazy" decoding="async" class="cd-lookup-cover" src="${cdEscapeAttr(album.cover_art)}" alt="" data-title="${cdEscapeAttr(album.title || '♪')}" onerror="cdLookupCoverFallback(this)">`
    : `<div class="cd-lookup-cover cd-cover-fallback"><span class="cd-cover-initial">${cdEscape((album.title || '♪').charAt(0).toUpperCase())}</span></div>`;
  preview.innerHTML = `
    <div class="cd-lookup-card">
      ${cover}
      <div class="cd-lookup-body">
        <b class="cd-lookup-title">${cdEscape(album.title)}</b>
        <span class="cd-lookup-artist">${cdEscape(album.artist)}</span>
        <span class="cd-lookup-meta">${cdEscape([album.year, album.country, album.label].filter(Boolean).join(' · '))}${album.tracklist.length ? ' · ' + album.tracklist.length + ' tracks' : ''}</span>
        ${album.stream_urls.deezer ? `<a class="cd-stream-link" href="${cdEscapeAttr(album.stream_urls.deezer)}" target="_blank" rel="noopener noreferrer">Listen on Deezer</a>` : ''}
      </div>
    </div>
    <div class="cd-lookup-actions">
      ${already ? `<span class="cd-already">Already in your collection</span>` : `<button type="button" class="btn-save" id="cdAddBtn">Add to my CDs</button>`}
      <button type="button" class="btn-cancel" id="cdLookupCancelBtn">Cancel</button>
    </div>`;
  preview.style.display = '';
  if(!already) document.getElementById('cdAddBtn').addEventListener('click', ()=>addCDToCollection(cdPendingAlbum, cdPendingBarcode));
  document.getElementById('cdLookupCancelBtn').addEventListener('click', ()=>{
    preview.style.display = 'none';
    preview.innerHTML = '';
    cdPendingAlbum = null;
  });
}
window.cdLookupCoverFallback = function(img){
  const cover = img.closest('.cd-lookup-cover') || img.parentElement;
  const title = cover.getAttribute('data-title') || '♪';
  cover.classList.add('cd-cover-fallback');
  cover.innerHTML = `<span class="cd-cover-initial">${cdEscape(title.charAt(0).toUpperCase())}</span>`;
};

async function addCDToCollection(album, barcode){
  if(!album || !barcode) return;
  const btn = document.getElementById('cdAddBtn');
  if(btn){ btn.disabled = true; btn.textContent = 'Adding…'; }
  const row = {
    user_id: currentUserId,
    barcode: barcode,
    title: (album.title || '').trim(),
    artist: (album.artist || '').trim(),
    year: (album.year || '').trim(),
    label: (album.label || '').trim(),
    country: (album.country || '').trim(),
    cover_art: album.cover_art || '',
    genres: album.genres || [],
    tracklist: album.tracklist || [],
    mb_id: album.mb_id || '',
    stream_urls: album.stream_urls || {}
  };
  try{
    const { error } = await sb.from('cd_collection').upsert(row, { onConflict: 'user_id,barcode' });
    if(error) throw error;
    document.getElementById('cdPreview').style.display = 'none';
    document.getElementById('cdPreview').innerHTML = '';
    cdPendingAlbum = null;
    showToast('Added to your CDs 💿', 2600);
    trackEvent('cd_added');
    loadCDCollection();
  }catch(err){
    console.error('Error saving CD:', err);
    showToast('Couldn\u2019t add — ' + (err.message || 'unknown error'), 4200);
    if(btn){ btn.disabled = false; btn.textContent = 'Add to my CDs'; }
  }
}

window.addEventListener('beforeunload', ()=>{ if(cdScanStream) cdScanStream.getTracks().forEach(t=>t.stop()); });
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape'){
    stopCDScan();
    if(cdAudio) cdAudio.pause();
  }
});

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
    { overlay:'addMusicOverlay', target:'#addMusicSongBtn', title:'Add your first song!', body:'Choose <b>+ Song</b> for a single track, or <b>+ Album</b> / <b>+ Playlist</b> to add a whole project at once — paste an Apple Music, Spotify, YouTube, or Tidal link.' },
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
    ['overlay','addMusicOverlay','spotifyImportOverlay','messagesOverlay','notifOverlay','feedOverlay','statsOverlay','sotdOverlay','leaderboardOverlay','songDbInfoOverlay'].forEach(id=>{
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
    let tries = 0;
    const iv = setInterval(()=>{
      tries++;
      const onboardingEl = el('onboardingOverlay');
      const onboardingOpen = onboardingEl && onboardingEl.classList.contains('open');
      if(!onboardingOpen){
        clearInterval(iv);
        startTour();
      } else if(tries > 120){
        clearInterval(iv);
      }
    }, 250);
  }

  window.startTour = startTour;
  window.maybeStartTour = maybeStartTour;

  function syncTourButton(){
    const b = el('tourBtn');
    if(!b) return;
    const isAllowed = (typeof isSamAdmin === 'function' && isSamAdmin()) || (typeof isCertifiedTester === 'function' && isCertifiedTester());
    b.style.display = isAllowed ? '' : 'none';
  }
  window.syncTourButton = syncTourButton;
  syncTourButton();

  document.getElementById('tourBtn').addEventListener('click', ()=>{
    try{ trackEvent('tour_replay'); }catch(e){}
    startTour();
  });
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