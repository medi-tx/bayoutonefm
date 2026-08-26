
/* =========================================================
   THEME CUSTOMIZATION
   ========================================================= */
const DEFAULT_THEME = { ink:'#12141c', paper:'#eedd95', gold:'#d5873f', rose:'#2A9D8F', teal:'#E63946', lilac:'#8E44AD', sage:'#264653' };

const THEME_PRESETS = [
  { name:'bayoutonefm (default)', colors: DEFAULT_THEME },
  { name:'Dark', colors: { ink:'#14151A', paper:'#1E2028', paperElevated:'#262933', border:'rgba(52,56,66,0.5)', gold:'#F4A300', teal:'#E63946', rose:'#2A9D8F', lilac:'#8E44AD', sage:'#264653' } },
  { name:'Light', colors: { ink:'#F7F5F0', paper:'#FFFFFF', paperElevated:'#FDFBF6', border:'#E5E1D8', gold:'#F4A300', teal:'#E63946', rose:'#2A9D8F', lilac:'#8E44AD', sage:'#264653' } },
  { name:'Euphoric', colors: { ink:'#1a0a2e', paper:'#fff8f0', paperElevated:'#ffe8ea', border:'#d6cdcd', gold:'#ff2fa0', teal:'#ff9e00', rose:'#ffd60a', lilac:'#7cff6b', sage:'#6bd8ff' } },
  { name:'Calm', colors: { ink:'#0f2027', paper:'#c2c7c6', paperElevated:'#ecf6f7', border:'#cbd3d3', gold:'#8ecae6', teal:'#a8dadc', rose:'#bde0c8', lilac:'#cdeac0', sage:'#e0ece4' } },
  { name:'Melancholy', colors: { ink:'#141b2e', paper:'#eceff4', paperElevated:'#e0e4ec', border:'#c5c9d0', gold:'#5c6b8a', teal:'#4a5a78', rose:'#6b7a99', lilac:'#8c95ab', sage:'#aab0c2' } },
  { name:'Fierce', colors: { ink:'#100000', paper:'#fff2f0', paperElevated:'#ffe1df', border:'#d4c6c5', gold:'#ff7a00', teal:'#ff1e1e', rose:'#8a0f0f', lilac:'#c81d1d', sage:'#4a0a0a' } },
  { name:'Dreamy', colors: { ink:'#2b1b3d', paper:'#faf4ff', paperElevated:'#f8efff', border:'#d5cddd', gold:'#e0b3ff', teal:'#c9a0ff', rose:'#a0c4ff', lilac:'#bde0fe', sage:'#ffd6e8' } },
  { name:'Nostalgic', colors: { ink:'#2e2318', paper:'#f5ecd9', paperElevated:'#f2e6ce', border:'#d1c8b6', gold:'#d4a24c', teal:'#c17f4a', rose:'#a85d3b', lilac:'#8a5a44', sage:'#6e6350' } },
  { name:'Mysterious', colors: { ink:'#0a0a14', paper:'#e8e4f0', paperElevated:'#dfd6ec', border:'#c0bdc8', gold:'#7b2fbe', teal:'#4b1d78', rose:'#2e0f52', lilac:'#1a1a3d', sage:'#3d1f5c' } },
  { name:'Romantic', colors: { ink:'#2b0f1a', paper:'#fff0f3', paperElevated:'#ffe6eb', border:'#d9c8cc', gold:'#ff6f91', teal:'#e63958', rose:'#c9184a', lilac:'#f8a5c2', sage:'#ffccd5' } },
  { name:'Anxious', colors: { ink:'#1c1f14', paper:'#eef0e2', paperElevated:'#ebeed3', border:'#c8cabd', gold:'#c9d92b', teal:'#8a9a3c', rose:'#5c6b2e', lilac:'#9c8a3c', sage:'#4a4a3c' } },
  { name:'Confident', colors: { ink:'#0a1128', paper:'#f4f6fb', paperElevated:'#f5f3e8', border:'#cacdd5', gold:'#ffd60a', teal:'#1d3d8f', rose:'#3a6ea5', lilac:'#c0c0c0', sage:'#02225f' } },
  { name:'Playful', colors: { ink:'#1a1a2e', paper:'#fffbf0', paperElevated:'#ffeee4', border:'#d6d2cd', gold:'#ff595e', teal:'#ffca3a', rose:'#8ac926', lilac:'#1982c4', sage:'#6a4c93' } },
  { name:'Serene', colors: { ink:'#1b2b23', paper:'#f7faf5', paperElevated:'#f1f6ee', border:'#cfd5cf', gold:'#a8c9a1', teal:'#c8dfc0', rose:'#dceedd', lilac:'#e8f0e3', sage:'#cfe0d8' } },
  { name:'Backout Reel', colors: { ink:'#0A0A0F', paper:'#101018', paperElevated:'#1A1A24', border:'#2A2A38', gold:'#FFD166', teal:'#FFD166', rose:'#FF6B6B', lilac:'#8B5CF6', sage:'#6B7280' } },
  { name:'Cream Sleeve', colors: { ink:'#2C2418', paper:'#FAF6EE', paperElevated:'#FFFFFF', border:'#DED2B8', gold:'#C1440E', teal:'#C1440E', rose:'#9A6708', lilac:'#1F6F50', sage:'#5B3A8E' } },
  { name:'Static Violet', colors: { ink:'#0D0618', paper:'#1B1030', paperElevated:'#251640', border:'#3A2359', gold:'#FFE066', teal:'#FFE066', rose:'#FF3EA5', lilac:'#00E5D0', sage:'#7CFF6B' } },
  { name:'Slate Print', colors: { ink:'#1A1D24', paper:'#FFFFFF', paperElevated:'#ECEEF2', border:'#DADEE4', gold:'#C2410C', teal:'#C2410C', rose:'#B45309', lilac:'#1D4ED8', sage:'#7C3AED' } },
  { name:'Deep Tide', colors: { ink:'#041118', paper:'#0C2530', paperElevated:'#123444', border:'#1D4B5C', gold:'#FFD166', teal:'#FFD166', rose:'#EF476F', lilac:'#06D6A0', sage:'#A78BFA' } },
  { name:'Pastel Haze', colors: { ink:'#031435', paper:'#fff8f0', paperElevated:'#e7e5ff', border:'#d6cdcd', gold:'#bf89ec', teal:'#a4daaf', rose:'#f5e69e', lilac:'#a3ade1', sage:'#eaac8a' } }
];
function hexToRgb(hex){
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : { r:0,g:0,b:0 };
}
function rgbToHex(r,g,b){
  const c = v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0');
  return '#' + c(r) + c(g) + c(b);
}
function shade(hex, amount){ // amount: positive lightens, negative darkens
  const { r, g, b } = hexToRgb(hex);
  const f = v => v + (amount>0 ? (255-v)*amount : v*amount);
  return rgbToHex(f(r), f(g), f(b));
}
function rgba(hex, a){
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminance(hex){
  const { r, g, b } = hexToRgb(hex);
  return (0.299*r + 0.587*g + 0.114*b) / 255;
}
function canvasPaperColor(alpha){
  try{
    const rgb = getComputedStyle(document.documentElement).getPropertyValue('--on-paper-rgb').trim();
    return 'rgba(' + (rgb || '18,20,28') + ',' + alpha + ')';
  }catch(e){ return 'rgba(18,20,28,' + alpha + ')'; }
}

function applyTheme(theme){
  const t = { ...DEFAULT_THEME, ...theme };
  const root = document.documentElement.style;
  root.setProperty('--ink', t.ink);
  root.setProperty('--ink-2', shade(t.ink, 0.1));
  root.setProperty('--paper', t.paper);
  root.setProperty('--paper-2', shade(t.paper, -0.06));
  root.setProperty('--gold', t.gold);
  root.setProperty('--star', t.gold);
  root.setProperty('--rose', t.rose);
  root.setProperty('--teal', t.teal);
  root.setProperty('--lilac', t.lilac || '#c9a0dc');
  root.setProperty('--sage', t.sage || '#7a8b6a');
  root.setProperty('--line', rgba(t.ink, 0.15));
  const inkLum = luminance(t.ink);
  const paperLum = luminance(t.paper);
  root.setProperty('--paper-elevated', t.paperElevated || shade(t.paper, paperLum > 0.5 ? -0.04 : 0.08));
  root.setProperty('--border', t.border || rgba(t.paper, paperLum > 0.5 ? 0.5 : 0.2));
  const onInk = inkLum > 0.55
    ? (paperLum > 0.5 ? '#12141c' : t.paper)
    : (paperLum > 0.45 ? t.paper : '#f5f2ea');
  const onPaper = paperLum > 0.45
    ? (inkLum > 0.55 ? '#12141c' : t.ink)
    : '#f5f2ea';
  const onInkRgb = hexToRgb(onInk);
  const onPaperRgb = hexToRgb(onPaper);
  root.setProperty('--text-on-ink', onInk);
  root.setProperty('--text-dim', rgba(onInk, 0.6));
  root.setProperty('--on-paper', onPaper);
  root.setProperty('--on-ink', onInk);
  root.setProperty('--on-paper-rgb', onPaperRgb.r + ',' + onPaperRgb.g + ',' + onPaperRgb.b);
  root.setProperty('--on-ink-rgb', onInkRgb.r + ',' + onInkRgb.g + ',' + onInkRgb.b);
  root.setProperty('--line-on-paper', rgba(onPaper, 0.16));
  root.setProperty('--field-bg', paperLum > 0.45 ? '#ffffff' : '#262833');
  const tierAccents = { 'S':'teal', 'star':'gold', 'A':'rose', 'B':'lilac', 'C':'sage' };
  const darkText = '#1A1A1A', lightText = '#F5F2EA';
  const darkTLum = luminance(darkText), lightTLum = luminance(lightText);
  Object.keys(tierAccents).forEach(tk=>{
    const cA = luminance(t[tierAccents[tk]] || '#888888');
    const crDark = (Math.max(cA, darkTLum) + 0.05) / (Math.min(cA, darkTLum) + 0.05);
    const crLight = (Math.max(cA, lightTLum) + 0.05) / (Math.min(cA, lightTLum) + 0.05);
    root.setProperty('--tier-' + tk + '-fg', crDark >= crLight ? darkText : lightText);
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', t.ink);

  // sync the picker UI to match
  Object.keys(THEME_COLOR_LABELS).forEach(key=>{
    const colorInput = document.getElementById('theme-' + key);
    const textInput = document.getElementById('theme-' + key + '-text');
    if(colorInput && t[key] && t[key].startsWith('#')) colorInput.value = t[key];
    if(textInput && t[key]) textInput.value = t[key];
  });
}
function loadTheme(){
  try{
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : { ...DEFAULT_THEME };
  }catch(e){ return { ...DEFAULT_THEME }; }
}
function saveTheme(theme){
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
  persistRemoteTheme(theme);
}
let remoteThemeDebounceTimer = null;
function persistRemoteTheme(theme){
  if(!currentUserId || !myProfile) return;
  clearTimeout(remoteThemeDebounceTimer);
  remoteThemeDebounceTimer = setTimeout(async ()=>{
    const err = await upsertMyProfile({ theme });
    if(err) console.error('Failed to save theme to account:', err);
  }, 600);
  // also save immediately so it isn't lost if the user navigates away quickly
  upsertMyProfile({ theme });
}
const THEME_COLOR_LABELS = {
  ink:'Page', paper:'Card', gold:'★ Star', rose:'A', teal:'S', lilac:'B', sage:'C',
  paperElevated:'Elevated', border:'Border'
};
function currentThemeFromInputs(){
  const theme = {};
  Object.keys(THEME_COLOR_LABELS).forEach(key=>{
    const el = document.getElementById('theme-' + key);
    if(el) theme[key] = el.value;
  });
  return theme;
}
function renderThemeColorGrid(){
  const grid = document.getElementById('themeColorGrid');
  if(!grid) return;
  grid.innerHTML = '';
  const cur = loadTheme();
  Object.keys(THEME_COLOR_LABELS).forEach(key=>{
    const val = cur[key] || '';
    const isHex = val.startsWith('#');
    const field = document.createElement('div');
    field.className = 'theme-color-field';
    field.innerHTML = `<label>${THEME_COLOR_LABELS[key]}</label><input type="color" id="theme-${key}" value="${isHex ? val : '#888888'}"><input type="text" id="theme-${key}-text" value="${val}" maxlength="20">`;
    grid.appendChild(field);
    const colorInput = field.querySelector('input[type="color"]');
    const textInput = field.querySelector('input[type="text"]');
    colorInput.addEventListener('input', ()=>{
      textInput.value = colorInput.value;
      const theme = currentThemeFromInputs();
      applyTheme(theme);
      saveTheme(theme);
      renderThemePresets();
    });
    textInput.addEventListener('change', ()=>{
      const v = textInput.value.trim();
      if(v.startsWith('#') && v.length >= 4){
        colorInput.value = v.length === 4 ? '#' + v[1]+v[1]+v[2]+v[2]+v[3]+v[3] : v;
      }
      const theme = currentThemeFromInputs();
      applyTheme(theme);
      saveTheme(theme);
      renderThemePresets();
    });
  });
}
function syncThemeColorGrid(){
  const cur = loadTheme();
  Object.keys(THEME_COLOR_LABELS).forEach(key=>{
    const el = document.getElementById('theme-' + key);
    const txt = document.getElementById('theme-' + key + '-text');
    if(el && cur[key]) el.value = cur[key].startsWith('#') ? cur[key] : '#888888';
    if(txt && cur[key]) txt.value = cur[key];
  });
}

const CUSTOM_THEMES_KEY = 'song-journal-custom-themes';
const STICKERS_KEY = 'song-journal-stickers';
function loadCustomThemes(){
  if(myProfile && myProfile.custom_themes) return myProfile.custom_themes;
  try{
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return []; }
}
function saveCustomThemes(list){
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(list));
  if(currentUserId && myProfile){
    myProfile.custom_themes = list;
    upsertMyProfile({ custom_themes: list }).then(err=>{
      if(err) console.error('Failed to save custom themes to account:', err);
    });
  }
}
function renderThemePresets(){
  const wrap = document.getElementById('themePresets');
  wrap.innerHTML = '';
  THEME_PRESETS.forEach(preset=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-preset-btn';
    const c = preset.colors;
    btn.innerHTML = `<span class="theme-preset-swatch"><span style="background:${c.ink}"></span><span style="background:${c.gold}"></span><span style="background:${c.rose}"></span><span style="background:${c.teal}"></span><span style="background:${c.lilac||'#c9a0dc'}"></span><span style="background:${c.sage||'#7a8b6a'}"></span></span>${preset.name}`;
    btn.addEventListener('click', ()=>{
      applyTheme(preset.colors);
      saveTheme(preset.colors);
    });
    wrap.appendChild(btn);
  });
  loadCustomThemes().forEach(theme=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-preset-btn custom';
    const c = theme.colors;
    btn.innerHTML = `<span class="theme-preset-swatch"><span style="background:${c.ink}"></span><span style="background:${c.gold}"></span><span style="background:${c.rose}"></span><span style="background:${c.teal}"></span><span style="background:${c.lilac||'#c9a0dc'}"></span><span style="background:${c.sage||'#7a8b6a'}"></span></span>${escapeHtml(theme.name)}<span class="theme-preset-x" data-delete-theme="${theme.id}" title="Delete this theme">×</span>`;
    btn.addEventListener('click', (e)=>{
      if(e.target.closest('[data-delete-theme]')) return;
      applyTheme(theme.colors);
      saveTheme(theme.colors);
    });
    wrap.appendChild(btn);
  });
  wrap.querySelectorAll('[data-delete-theme]').forEach(x=>{
    x.addEventListener('click', (e)=>{
      e.stopPropagation();
      const id = x.dataset.deleteTheme;
      if(confirm('Delete this saved theme?')){
        saveCustomThemes(loadCustomThemes().filter(t=>t.id!==id));
        renderThemePresets();
      }
    });
  });
}

// apply saved theme immediately, even before login, so the whole app (incl. auth screen) reflects it
applyTheme(loadTheme());

// when switching accounts, clear the old theme so the new account's theme takes over
window.addEventListener('storage', e=>{
  if(e.key === THEME_KEY && e.newValue === null) applyTheme(DEFAULT_THEME);
});

document.addEventListener('DOMContentLoaded', ()=>{
  renderThemePresets();

  const CB_THEME_KEY = 'song-journal-colorblind-theme';
  const CB_TYPE_KEY = 'song-journal-colorblind-type';
  const CB_PRESETS = {
    protan: { ink:'#1A1A1A', paper:'#F4F1EA', gold:'#009292', teal:'#004949', rose:'#920000', lilac:'#B66DFF', sage:'#FFB6DB', paperElevated:'#FFFFFF', border:'rgba(0,0,0,0.2)' },
    deutan: { ink:'#1A1A1A', paper:'#F4F1EA', teal:'#0072B2', gold:'#D55E00', lilac:'#F0E442', sage:'#000000', rose:'#CC79A7', paperElevated:'#FFFFFF', border:'rgba(0,0,0,0.2)' },
    tritan: { ink:'#1A1A1A', paper:'#D9D9D9', gold:'#D41159', teal:'#1A85FF', sage:'#000000', lilac:'#FFFFFF', rose:'#994F00', paperElevated:'#FFFFFF', border:'rgba(0,0,0,0.2)' },
    mono:   { ink:'#0A0A0A', paper:'#F2F2F2', gold:'#595959', teal:'#999999', rose:'#1A1A1A', lilac:'#D9D9D9', sage:'#777777', paperElevated:'#FFFFFF', border:'rgba(0,0,0,0.25)' },
  };
  const cbToggle = document.getElementById('cbToggle');
  const cbTypes = document.getElementById('cbTypes');
  function syncCbToggle(on){
    cbToggle.dataset.cb = on ? 'on' : 'off';
    cbToggle.setAttribute('aria-checked', on ? 'true' : 'false');
    document.body.classList.toggle('cb-on', on);
  }
  function applyCbType(type){
    const preset = CB_PRESETS[type] || CB_PRESETS.protan;
    applyTheme(preset);
    saveTheme(preset);
    if(cbTypes){
      Array.from(cbTypes.querySelectorAll('.cb-type-btn')).forEach(b=>{
        b.setAttribute('aria-pressed', b.dataset.cbType === type ? 'true' : 'false');
      });
    }
    localStorage.setItem(CB_TYPE_KEY, type);
  }
  if(cbTypes){
    Object.keys(CB_PRESETS).forEach(type=>{
      const btn = cbTypes.querySelector('[data-cb-type="' + type + '"]');
      const sw = btn && btn.querySelector('.cb-swatch');
      if(sw){
        ['gold','rose','teal','lilac','sage'].forEach(k=>{
          const dot = document.createElement('span');
          dot.className = 'cb-dot';
          dot.style.background = CB_PRESETS[type][k];
          sw.appendChild(dot);
        });
      }
    });
  }
  const cbSaved = localStorage.getItem(CB_THEME_KEY) === 'on';
  if(cbSaved){
    syncCbToggle(true);
    if(cbTypes) cbTypes.style.display = '';
    applyCbType(localStorage.getItem(CB_TYPE_KEY) || 'protan');
  } else {
    syncCbToggle(false);
    if(cbTypes) cbTypes.style.display = 'none';
  }
  cbToggle.addEventListener('click', ()=>{
    const on = cbToggle.dataset.cb !== 'on';
    syncCbToggle(on);
    if(on){
      if(!localStorage.getItem(CB_THEME_KEY + '-prev')){
        localStorage.setItem(CB_THEME_KEY + '-prev', JSON.stringify(loadTheme()));
      }
      localStorage.setItem(CB_THEME_KEY, 'on');
      if(cbTypes) cbTypes.style.display = '';
      applyCbType(localStorage.getItem(CB_TYPE_KEY) || 'protan');
    } else {
      localStorage.removeItem(CB_THEME_KEY);
      if(cbTypes) cbTypes.style.display = 'none';
      const prev = JSON.parse(localStorage.getItem(CB_THEME_KEY + '-prev') || 'null') || DEFAULT_THEME;
      localStorage.removeItem(CB_THEME_KEY + '-prev');
      applyTheme(prev);
      saveTheme(prev);
    }
  });
  if(cbTypes){
    cbTypes.addEventListener('click', e=>{
      const btn = e.target.closest('.cb-type-btn');
      if(!btn) return;
      applyCbType(btn.dataset.cbType);
    });
  }

  document.getElementById('themeBtn').addEventListener('click', ()=>{
    if(!myProfile || myProfile.username !== 'samannleblanc') return;
    trackEvent('open_theme');
    applyTheme(loadTheme());
    renderThemeColorGrid();
    document.getElementById('themeOverlay').classList.add('open');
  });
  document.getElementById('themeCloseBtn').addEventListener('click', ()=>{
    document.getElementById('themeOverlay').classList.remove('open');
  });
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape') document.getElementById('themeOverlay').classList.remove('open');
  });

  const themeSaveName = document.getElementById('themeSaveName');
  const themeSaveBtn = document.getElementById('themeSaveBtn');
  themeSaveName.addEventListener('input', ()=>{
    themeSaveBtn.disabled = !themeSaveName.value.trim();
  });
  themeSaveBtn.addEventListener('click', ()=>{
    const name = themeSaveName.value.trim();
    if(!name) return;
    const id = 'custom-' + Date.now();
    const customThemes = loadCustomThemes();
    customThemes.push({ id, name, colors: currentThemeFromInputs() });
    saveCustomThemes(customThemes);
    themeSaveName.value = '';
    themeSaveBtn.disabled = true;
    renderThemePresets();
  });

  const themeResetBtn = document.getElementById('themeResetBtn');
  themeResetBtn.addEventListener('click', ()=>{
    localStorage.removeItem(CB_THEME_KEY);
    localStorage.removeItem(CB_TYPE_KEY);
    localStorage.removeItem(CB_THEME_KEY + '-prev');
    syncCbToggle(false);
    if(cbTypes) cbTypes.style.display = 'none';
    applyTheme(DEFAULT_THEME);
    saveTheme(DEFAULT_THEME);
    renderThemeColorGrid();
    renderThemePresets();
  });

  renderThemePresets();
  renderThemeColorGrid();
});

function uid(){ return 's' + Date.now() + Math.random().toString(36).slice(2,7); }

function setImagePreview(prefix, value){
  const img = document.getElementById(prefix+'-preview');
  const empty = document.getElementById(prefix+'-empty');
  const removeBtn = document.getElementById(prefix+'-remove');
  if(value){
    img.src = value;
    img.style.display = 'block';
    empty.style.display = 'none';
    if(removeBtn) removeBtn.style.display = 'block';
  } else {
    img.style.display = 'none';
    empty.style.display = 'block';
    if(removeBtn) removeBtn.style.display = 'none';
  }
}
function compressImage(dataUrl, maxDim, quality){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      let { width, height } = img;
      if(width > maxDim || height > maxDim){
        if(width > height){
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
}
function bindCoverInput(fileInputId, prefix, setter){
  document.getElementById(fileInputId).addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async ()=>{
      const compressed = await compressImage(reader.result, 150, 0.7);
      setter(compressed);
      setImagePreview(prefix, compressed);
    };
    reader.readAsDataURL(file);
  });
  document.getElementById(prefix+'-remove').addEventListener('click', ()=>{
    setter(null);
    setImagePreview(prefix, null);
    document.getElementById(fileInputId).value = '';
  });
}

function renderRemindsPicker(prefix, selectedIds){
  const el = document.getElementById(prefix+'-reminds-picker');
  const hint = document.getElementById(prefix+'-reminds-hint');
  selectedIds = selectedIds || [];
  el.innerHTML = '';
  if(people.length === 0){
    hint.style.display = 'block';
    return;
  }
  hint.style.display = 'none';
  people.forEach(p=>{
    const lp = linkedProfile(p);
    const label = document.createElement('label');
    label.className = 'reminds-chip' + (selectedIds.includes(p.id) ? ' selected' : '') + (lp ? ' linked' : '');
    const photo = (lp && lp.photo) ? lp.photo : p.photo;
    const imgOrFallback = photo
      ? `<img loading="lazy" decoding="async" src="${photo}" alt="Image">`
      : `<span class="rc-fallback">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`;
    const friendMark = lp ? `<span class="rc-linked" title="Actual friend on bayoutonefm">✓</span>` : '';
    label.innerHTML = `<input type="checkbox" value="${escapeAttr(p.id)}" ${selectedIds.includes(p.id)?'checked':''}> ${imgOrFallback} ${escapeHtml(p.name)}`;
    label.querySelector('input').addEventListener('change', e=>{
      label.classList.toggle('selected', e.target.checked);
    });
    el.appendChild(label);
  });
}
function getSelectedReminds(prefix){
  return [...document.querySelectorAll('#'+prefix+'-reminds-picker input:checked')].map(i=>i.value);
}

function linkedProfile(p){
  if(!p || !p.userId) return null;
  return allProfilesCache.find(x=>x.user_id === p.userId) || null;
}

function renderPeople(){
  const row = document.getElementById('peopleRow');
  if(people.length === 0){
    row.innerHTML = '<span class="reminds-hint">Add someone to start tagging songs that remind you of them.</span>';
    return;
  }
  row.innerHTML = people.map(p=>{
    const isExample = (p.id || '').startsWith('ex-');
    const lp = linkedProfile(p);
    const photo = (lp && lp.photo) ? lp.photo : p.photo;
    const tip = lp ? 'Songs that remind me of @' + lp.username + ' (friend on bayoutonefm)' : 'Songs that remind me of ' + escapeAttr(p.name);
    return `
    <button type="button" class="person-card ${remindsFilterId===p.id?'active':''}${isExample?' example':''}${lp?' linked':''}" data-person="${p.id}" title="${tip}" aria-current="${remindsFilterId===p.id?'true':'false'}">
      <span class="person-edit" data-edit-person="${p.id}" title="Edit person">✎</span>
      <span class="person-remove" data-remove-person="${p.id}" title="Remove person">×</span>
      ${photo ? `<img loading="lazy" decoding="async" class="person-photo" src="${photo}" alt="Profile photo">` : `<span class="person-photo-fallback">${escapeHtml((p.name||'?').charAt(0).toUpperCase())}</span>`}
      <span class="person-name">${escapeHtml(p.name)}</span>
      ${lp ? `<span class="person-username">@${escapeHtml(lp.username)}</span>` : ''}
      ${isExample ? '<span class="person-example">EXAMPLE</span>' : ''}
    </button>`;
  }).join('');
}

function populateFilters(){
  const genreSel = document.getElementById('filterGenre');
  const moodSel = document.getElementById('filterMood');
  const genres = new Set();
  const moods = new Set();
  songs.forEach(s=>{
    if(s.genres) s.genres.forEach(g=>genres.add(g.trim()));
    (s.tags||[]).forEach(t=>moods.add(t.trim()));
  });
  const curGenre = genreSel.value, curMood = moodSel.value;
  genreSel.innerHTML = '<option value="">All genres</option>' + [...genres].sort().map(g=>`<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join('');
  moodSel.innerHTML = '<option value="">All moods/tags</option>' + [...moods].sort().map(m=>`<option value="${escapeAttr(m)}">${escapeHtml(m)}</option>`).join('');
  genreSel.value = curGenre; moodSel.value = curMood;
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

function formatArtists(artists){
  if(!artists || artists.length === 0) return 'Unknown artist';
  if(artists.length === 1) return artists[0];
  if(artists.length === 2) return artists.join(' & ');
  return artists.slice(0,-1).join(', ') + ' & ' + artists[artists.length-1];
}

function renderTierBadge(tier){
  if(!tier) return `<span class="tier-badge tier-none">UNRATED</span>`;
  return `<span class="tier-badge tier-${tier}">${tier}</span>`;
}
const TIER_BANDS = { '★':[95,100], 'S':[85,94], 'A':[70,84], 'B':[50,69], 'C':[30,49] };
function bandForTier(t){ return TIER_BANDS[t] || null; }
function tierForScore(n){
  const keys = ['★','S','A','B','C'];
  for(const t of keys){ const b = TIER_BANDS[t]; if(n >= b[0] && n <= b[1]) return t; }
  return null;
}
function scoreChipHtml(s){
  if(s.score === null || s.score === undefined || s.score === '') return '';
  return `<span class="score-chip" title="Exact score">${escapeHtml(String(s.score))}</span>`;
}
function starsHtml(n){
  n = clampNum(n||0, 0, 5);
  let out = '';
  for(let i=1;i<=5;i++) out += `<span class="${i <= n ? 'star-ico on' : 'star-ico'}">★</span>`;
  return out;
}
function vibeBarHtml(label, v, cls, ends){
  return `<div class="vibe-bar-row"><span class="vibe-bar-label">${label}</span><span class="vibe-bar-track"><span class="vibe-bar-fill ${cls}" style="width:${clampNum(v||0,0,100)}%;"></span></span>${ends ? `<span class="vb-ends">${ends}</span>` : ''}</div>`;
}
function cardRatingsStripHtml(s){
  const st = s.stars || {};
  const hasStars = !!(st.lyrics || st.vocals || st.replay);
  const hasVibes = s.vibeEnergy !== null && s.vibeEnergy !== undefined;
  if(!hasStars && !hasVibes) return '';
  let out = '<div class="card-ratings">';
  if(hasVibes){
    out += `<div class="cr-vibes">`
      + `<span class="cr-ve" title="chill">😴</span>`
      + `<span class="vb energy" title="⚡ Energy ${s.vibeEnergy}"><i style="width:${clampNum(s.vibeEnergy,0,100)}%;"></i></span>`
      + `<span class="cr-ve" title="electric">⚡</span>`
      + `<span class="cr-ve" title="stormy">🌧️</span>`
      + `<span class="vb mood" title="🌗 Mood ${s.vibeMood != null ? s.vibeMood : 0}"><i style="width:${clampNum(s.vibeMood||0,0,100)}%;"></i></span>`
      + `<span class="cr-ve" title="sunny">☀️</span>`
      + `<span class="cr-ve" title="new">✨</span>`
      + `<span class="vb nostalgia" title="🕰️ Nostalgia ${s.vibeNostalgia != null ? s.vibeNostalgia : 0}"><i style="width:${clampNum(s.vibeNostalgia||0,0,100)}%;"></i></span>`
      + `<span class="cr-ve" title="familiar">📻</span>`
      + `</div>`;
  }
  if(hasStars){
    out += `<div class="cr-stars">`
      + `<span title="Lyrics ${(st.lyrics||0)}/5">🎤${starsHtml(st.lyrics)}</span>`
      + `<span title="Vocals ${(st.vocals||0)}/5">🎶${starsHtml(st.vocals)}</span>`
      + `<span title="Replay-ability ${(st.replay||0)}/5">🔁${starsHtml(st.replay)}</span>`
      + `</div>`;
  }
  return out + '</div>';
}
function tierBandLabel(t){
  const b = bandForTier(t);
  return b ? `${b[0]}–${b[1]}` : '';
}
function songStackIds(s){
  const ids = [];
  if(Array.isArray(s.stackIds)) s.stackIds.forEach(id=>{ if(id && !ids.includes(id)) ids.push(id); });
  if(s.clusterId && !ids.includes(s.clusterId)) ids.push(s.clusterId);
  return ids;
}
function stackDisplayName(id){
  for(const s of (typeof songs !== 'undefined' ? songs : [])){
    if(s.stackNames && s.stackNames[id]) return s.stackNames[id];
    if(s.clusterId === id && s.clusterName) return s.clusterName;
  }
  const meta = (typeof getStackMeta === 'function') ? getStackMeta() : {};
  return (meta[id] && meta[id].name) || null;
}
function songStackBadgesHtml(s, clusterCounts){
  const ids = songStackIds(s).filter(cid => (clusterCounts[cid]||0) > 1);
  if(!ids.length) return '';
  if(ids.length === 1) return `<span class="link-badge" data-cluster="${ids[0]}">🔗 ${clusterCounts[ids[0]]} linked</span>`;
  return `<button type="button" class="stacks-btn" data-stacks-for="${s.id}" title="Show all stacks">Stacks</button>`;
}
function trackNoDisplay(s){
  if(!s.trackNumber) return '';
  const v = String(s.trackNumber).toUpperCase();
  return v === 'S' ? ' · S' : ' · #'+escapeHtml(v);
}
function validateTrackNo(raw){
  const t = String(raw||'').trim().toUpperCase();
  if(!t) return { ok:true, value:null };
  if(t === 'S') return { ok:true, value:'S' };
  const n = Number(t);
  if(Number.isInteger(n) && n >= 1 && n <= 1111) return { ok:true, value:String(n) };
  return { ok:false };
}
let _friendPeopleCache = null;
function cbField(label, val){
  if(val === null || val === undefined || val === '' || (Array.isArray(val) && !val.length)) return '';
  return `<div class="cb-field"><span class="cb-flabel">${label}</span><span class="cb-fval">${val}</span></div>`;
}
function cbRemindsNames(s){
  if(!(s.remindsOf && s.remindsOf.length)) return '';
  const pool = [
    ...(typeof people !== 'undefined' && Array.isArray(people) ? people : []),
    ...(Array.isArray(_friendPeopleCache) ? _friendPeopleCache : [])
  ];
  return s.remindsOf.map(pid=>{
    const pp = pool.find(x=>x.id===pid);
    return pp ? escapeHtml(pp.name) : null;
  }).filter(Boolean).join(', ');
}
function musicKeyToCamelot(key){
  if(!key) return '';
  const k=key.trim();
  const map={
    'c major':'8b','c minor':'5a','a minor':'8a',
    'g major':'9b','g minor':'6a','e minor':'9a',
    'd major':'10b','d minor':'7a','b minor':'10a',
    'a major':'11b','a minor':'8a','f# minor':'11a','f#m':'11a',
    'e major':'12b','c# minor':'12a','c#m':'12a','db minor':'12a',
    'b major':'1b','g# minor':'1a','g#m':'1a','ab minor':'1a',
    'f# major':'2b','gb major':'2b','d# minor':'2a','d#m':'2a','eb minor':'2a',
    'db major':'3b','c# major':'3b','bb minor':'3a',
    'ab major':'4b','f minor':'4a',
    'eb major':'5b','c minor':'5a',
    'bb major':'6b','g minor':'6a',
    'f major':'7b','d minor':'7a',
    'a# minor':'8a','bb minor':'8a'
  };
  return map[k]||'';
}

function cardBackHtml(s){
  const streamLinks = [];
  if(s.spotifyUrl) streamLinks.push(`<a class="back-link" href="${escapeHtml(s.spotifyUrl)}" target="_blank" rel="noopener">Spotify</a>`);
  if(s.appleMusicUrl) streamLinks.push(`<a class="back-link" href="${escapeHtml(s.appleMusicUrl)}" target="_blank" rel="noopener">Apple Music</a>`);
  if(s.youtubeMusicUrl) streamLinks.push(`<a class="back-link" href="${escapeHtml(s.youtubeMusicUrl)}" target="_blank" rel="noopener">YouTube</a>`);
  if(s.tidalUrl) streamLinks.push(`<a class="back-link" href="${escapeHtml(s.tidalUrl)}" target="_blank" rel="noopener">Tidal</a>`);
  return `
    <div class="card-back">
      <div class="cb-head">
        <span class="cb-title">${escapeHtml(s.title||'Untitled')}${s.explicit ? ' <span class="explicit-badge" title="Explicit content">E</span>' : ''}</span>
      </div>
      <div class="cb-fields">
        ${cbField('Track #', trackNoDisplay(s))}
        ${cbField('Record label', s.recordLabel ? escapeHtml(s.recordLabel) : '')}
        ${cbField('Release date', s.releaseDate ? escapeHtml(s.releaseDate) : '')}
        ${cbField('Producers', s.producer ? escapeHtml(s.producer) : '')}
        ${cbField('Songwriters', s.songwriters ? escapeHtml(s.songwriters) : '')}
        ${cbField('BPM', s.bpm ? escapeHtml(String(s.bpm)) : '')}
        ${cbField('Key', s.musicKey ? escapeHtml(s.musicKey) + (musicKeyToCamelot(s.musicKey) ? ' <span class="camelot-chip">'+escapeHtml(musicKeyToCamelot(s.musicKey))+'</span>' : '') : '')}
        ${cbField('Duration', s.duration ? escapeHtml(s.duration) : '')}
        ${streamLinks.length ? '<div class="cb-field"><span class="cb-flabel">Listen</span><span class="cb-fval">' + streamLinks.join(' · ') + '</span></div>' : ''}
        ${s.artistWebsite ? '<div class="cb-field"><span class="cb-flabel">Artist</span><span class="cb-fval"><a class="back-link" href="'+escapeHtml(s.artistWebsite)+'" target="_blank" rel="noopener">'+escapeHtml(formatArtists(s.artists)||'Artist website')+' ↗</a></span></div>' : ''}
      </div>
    </div>`;
}
function tierColor(tier){
  return {'★':'var(--star)',S:'var(--teal)',A:'var(--rose)',B:'var(--lilac)',C:'var(--sage)'}[tier]||'';
}

function formatAddedDate(ts){
  if(!ts) return '';
  const d = new Date(ts);
  if(isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric' });
  const time = d.toLocaleTimeString(undefined,{ hour:'numeric', minute:'2-digit' });
  return `${date} · ${time}`;
}

/* ---- tier board: S-C rows of cover art, deduped, no unrated row ---- */
function slugifyForGenius(str){
  return (str||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').join('-');
}
function geniusLyricsUrl(title, artists){
  const a = slugifyForGenius((artists||[])[0]||'');
  const t = slugifyForGenius(title||'');
  if(a && t) return `https://genius.com/${a}-${t}-lyrics`;
  return null;
}
function coverKey(url){
  if(!url) return '';
  return String(url).replace(/\d+x\d+bb(?=\.\w+$)/, '150x150bb');
}
function dedupeSongsForBoard(list){
  const seen = new Set();
  const out = [];
  list.forEach(s=>{
    const ck = coverKey(s.coverArt);
    const key = ck
      ? 'cover|' + ck
      : `${(s.title||'').trim().toLowerCase()}|${(s.artists||[]).join(',').trim().toLowerCase()}|${(s.album||'').trim().toLowerCase()}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push(s);
  });
  return out;
}
function tierBoardItemHtml(s, editable){
  const initial = (s.title||'?').charAt(0).toUpperCase();
  const cover = s.coverArt
    ? `<img loading="lazy" decoding="async" class="tier-board-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">
`
    : `<div class="tier-board-cover-fallback">${escapeHtml(initial)}</div>`;
  return `
    <div class="tier-board-item" ${editable ? `data-id="${s.id}"` : ''} title="${escapeAttr(s.title||'Untitled')} · ${escapeAttr(formatArtists(s.artists))}">
      ${cover}
    </div>
  `;
}
function buildTierBoardHtml(list, editable){
  const active = dedupeSongsForBoard((list||[]).filter(s=>!s.archived));
  const byTier = { '★':[], S:[], A:[], B:[], C:[] };
  active.forEach(s=>{ if(byTier[s.tier]) byTier[s.tier].push(s); });
  return TIERS.map(t=>{
    const items = byTier[t];
    const body = items.length
      ? `<div class="tier-board-covers">${items.map(s=>tierBoardItemHtml(s, editable)).join('')}</div>`
      : `<div class="tier-board-empty-row">Nothing in ${t} tier yet</div>`;
    return `
      <div class="tier-board-row">
        <div class="tier-board-badge tier-${t}">${t}</div>
        ${body}
      </div>
    `;
  }).join('');
}
function renderTierBoard(){
  const el = document.getElementById('tierBoard');
  const toolbar = document.getElementById('tierBoardToolbar');
  const empty = document.getElementById('tierBoardEmptyState');
  const active = songs.filter(s=>!s.archived);
  if(active.length === 0){
    el.innerHTML = '';
    el.style.display = 'none';
    if(toolbar) toolbar.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  el.style.display = '';
  if(toolbar) toolbar.style.display = '';
  el.innerHTML = buildTierBoardHtml(songs, true);
}
document.getElementById('tierBoard').addEventListener('click', e=>{
  trackEvent('tier_board_song_click');
  const item = e.target.closest('[data-id]');
  if(!item) return;
  const song = songs.find(s=>s.id===item.dataset.id);
  if(song) openModal(song);
});

function renderLastAdded(){
  const panel = document.getElementById('lastAdded');
  const body = document.getElementById('lastAddedBody');
  if(songs.length === 0){
    panel.style.display = 'none';
    return;
  }
  const latest = songs.reduce((a,b)=> (b.createdAt||0) > (a.createdAt||0) ? b : a);
  panel.style.display = 'flex';
  body.innerHTML = `
    <span class="lat-title">${escapeHtml(latest.title||'Untitled')}</span>
    <span class="lat-artist">${escapeHtml(formatArtists(latest.artists))}</span>
    ${renderTierBadge(latest.tier)}
  `;
}

/* ---- windowed grid rendering (avoids building thousands of DOM nodes at once) ---- */
const GRID_BATCH_SIZE = 60;
let currentGridList = [];
let currentClusterCounts = {};
let renderedCount = 0;
let gridObserver = null;

function stringHue(str){
  let h = 0;
  str = String(str || '?');
  for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) % 360; }
  return h;
}
function coverInitials(s){
  const t = ((s && s.title) ? s.title : '?').trim();
  const a = ((s && s.artists && s.artists[0]) ? s.artists[0] : '').trim();
  let ini = t.charAt(0).toUpperCase();
  if(a) ini += a.charAt(0).toUpperCase();
  return ini || '?';
}
function coverThumbHtml(s){
  if(s && s.coverArt){
    const alt = (s.title||'Album') + (s.artists && s.artists.length ? ' by ' + (s.artists||[]).join(', ') : '');
    return `<img loading="lazy" decoding="async" class="cover-thumb" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="${escapeAttr(alt)}">`;
  }
  const initials = coverInitials(s);
  const hue = stringHue((s && (s.title || s.id)) || '?');
  return `<div class="cover-thumb cover-fallback" style="--cf-h:${hue}" aria-hidden="true">${escapeHtml(initials)}</div>`;
}

function songCardHtml(s, clusterCounts){
  return `
      <div class="card ${s.archived?'archived':''}" data-id="${s.id}">
        <div class="card-front">
          <button class="pin-btn ${s.favorited?'pinned':''}" data-action="pin" data-help="Add to or remove from your personal favourites list." aria-pressed="${s.favorited?'true':'false'}" aria-label="${s.favorited?'Remove from favorites':'Add to favorites'}" title="${s.favorited?'Remove from favorites':'Add to favorites'}">${s.favorited?'♥':'♡'}</button>
          ${(s.tier) ? `<div class="card-tier-badge">${renderTierBadge(s.tier)}${(s.score !== null && s.score !== undefined && s.score !== '') ? `<span class="score-chip">${escapeHtml(String(s.score))}</span>` : ''}</div>` : ''}
          <div class="card-top">
            ${coverThumbHtml(s)}
            <div class="title-stack">
              ${s.archived ? '<span class="archived-badge">ARCHIVED</span>' : ''}
              <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}${s.explicit ? ' <span class="explicit-badge" title="Explicit content">E</span>' : ''}</p>
              <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
            </div>
          </div>
          <div class="meta-row">
            ${s.year ? `<span>${escapeHtml(s.year)}</span>` : ''}
            ${(s.genres&&s.genres.length) ? `<span class="meta-genres">· ${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
          </div>
          ${cardRatingsStripHtml(s)}
          <div class="preview-row">
            <button type="button" class="preview-btn" data-preview="${escapeAttr(s.id)}" data-help="Play a 30-second preview of this song." title="Play a 30-second preview" aria-label="Play 30-second preview">▶︎</button>
            <span class="preview-hint">30-sec preview</span>
          </div>
          ${songStackBadgesHtml(s, clusterCounts)}

          ${s.quickThought ? `<p class="card-thought">"${escapeHtml(s.quickThought)}"</p>` : ''}
          ${s.why ? `<p class="card-opinions">${escapeHtml(s.why)}</p>` : ''}
          ${s.credit ? `<p class="credit-note"><b>Borrowed from / Where I Heard It:</b> ${escapeHtml(s.credit)}</p>` : ''}
          ${(s.remindsOf && s.remindsOf.length) ? `<div class="reminds-badges">${s.remindsOf.map(pid=>{
            const p = people.find(pp=>pp.id===pid);
            if(!p) return '';
            const lp = linkedProfile(p);
            const photo = (lp && lp.photo) ? lp.photo : p.photo;
            const tip = lp ? 'Friend @' + escapeAttr(lp.username) + ' on bayoutonefm' : 'Songs that remind me of ' + escapeAttr(p.name);
            return `<span class="reminds-badge${lp?' linked':''}" data-person="${p.id}" title="${tip}">${photo?`<img loading="lazy" decoding="async" src="${photo}" loading="lazy" decoding="async" alt="Image">`:''}${escapeHtml(p.name)}<button type="button" class="reminds-badge-x" data-remove-reminder="${s.id}|${p.id}" title="Remove ${escapeAttr(p.name)} from this song">×</button></span>`;
          }).join('')}</div>` : ''}
          <div class="card-actions">
            ${geniusLyricsUrl(s.title, s.artists) ? `<a href="${escapeAttr(geniusLyricsUrl(s.title, s.artists))}" target="_blank" rel="noopener" title="Open lyrics on Genius" data-help="Search for full lyrics on Genius.">LYRICS ↗</a>` : ''}
            <button data-action="edit" data-help="Open the editor to change this song's details.">EDIT</button>
            <button data-action="archive" data-help="Hide this card from your main grid without deleting it.">${s.archived ? 'UNARCHIVE' : 'ARCHIVE'}</button>
            <button data-action="delete" class="del" data-help="Permanently remove this song from your cataloguex.">DELETE</button>
            <button data-action="share" class="share-card-btn" data-help="Generate a shareable image of this song card." title="Generate a shareable card for this song">↗ SHARE</button>
          </div>
        </div>
        ${cardBackHtml(s)}
        <button type="button" class="cb-flip-fab" data-action="flip" data-help="Flip the card to see extra details on the back." title="Flip card" aria-label="Flip card">↻</button>
      </div>
    `;
}

function renderNextGridBatch(){
  const grid = document.getElementById('grid');
  const sentinel = document.getElementById('gridSentinel');
  const slice = currentGridList.slice(renderedCount, renderedCount + GRID_BATCH_SIZE);
  if(slice.length){
    grid.insertAdjacentHTML('beforeend', slice.map(s=>songCardHtml(s, currentClusterCounts)).join(''));
    renderedCount += slice.length;
    if(typeof renderStickerLayer === 'function' && stickers && stickers.some(s=>s&&s.url)) renderStickerLayer();
  }
  if(renderedCount < currentGridList.length){
    sentinel.style.display = 'block';
    if(!gridObserver){
      gridObserver = new IntersectionObserver(entries=>{
        if(entries[0].isIntersecting) renderNextGridBatch();
      }, { rootMargin: '800px' });
      gridObserver.observe(sentinel);
    }
  } else {
    sentinel.style.display = 'none';
  }
}

/* ---- timeline / scrapbook view: chronological feed grouped by day ---- */
function timelineItemHtml(s){
  const cover = s.coverArt
    ? `<img loading="lazy" decoding="async" class="timeline-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">
`
    : `<div class="timeline-cover timeline-cover-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
  const when = s.createdAt
    ? `<span>${escapeHtml(new Date(s.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</span><span>${escapeHtml(new Date(s.createdAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}))}</span>`
    : '';
  return `
      <div class="timeline-item" data-id="${s.id}" title="Edit this entry">
        ${cover}
        <div class="timeline-body">
          <p class="timeline-title">${escapeHtml(s.title||'Untitled')}</p>
          <p class="timeline-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
          <div class="timeline-meta">
            ${renderTierBadge(s.tier)}
            ${(s.genres&&s.genres.length) ? `<span>${s.genres.map(g=>escapeHtml(g)).join(', ')}</span>` : ''}
          </div>
        </div>
        <div class="timeline-when">${when}</div>
      </div>
    `;
}
function renderTimeline(){
  const el = document.getElementById('timeline');
  const empty = document.getElementById('timelineEmptyState');
  const list = songs.filter(s=>{ if(showArchived){ if(!s.archived) return false; } else { if(s.archived) return false; }     return true;
  });
  list.forEach(t=>{
    if(typeof t.explicit !== 'boolean') t.explicit = t.trackExplicitness === 'explicit';
  });
  list.sort((a,b)=> (b.createdAt||0) - (a.createdAt||0));
  if(!list.length){
    el.innerHTML = '';
    el.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  el.style.display = '';
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const niceDay = ts => {
    const d = new Date(ts);
    if(isNaN(d.getTime())) return 'Unknown date';
    if(d.toDateString() === today.toDateString()) return 'Today';
    if(d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric', year:'numeric'});
  };
  const groups = {};
  list.forEach(s=>{
    const d = new Date(s.createdAt||0);
    const key = isNaN(d.getTime()) ? 'unknown' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    (groups[key] = groups[key] || []).push(s);
  });
  let html = '';
  Object.keys(groups).sort((a,b)=>{
    if(a === 'unknown') return 1;
    if(b === 'unknown') return -1;
    return a < b ? 1 : (a > b ? -1 : 0);
  }).forEach(k=>{
    const items = groups[k];
    html += `<div class="timeline-day"><p class="timeline-day-label">${escapeHtml(niceDay(items[0].createdAt))}<span class="timeline-day-count">${items.length} ${items.length===1?'song':'songs'}</span></p><div class="timeline-items">`;
    items.forEach(s=>{ html += timelineItemHtml(s); });
    html += '</div></div>';
  });
  el.innerHTML = html;
}
document.getElementById('timeline').addEventListener('click', e=>{
  trackEvent('timeline_song_click');
  const item = e.target.closest('.timeline-item');
  if(!item) return;
  const song = songs.find(s=>s.id === item.dataset.id);
  if(song) openModal(song);
});

/* ---- stats page ---- */
const TIER_CHART_COLORS = { '★':'#d5873f', S:'#E63946', A:'#2A9D8F', B:'#8E44AD', C:'#264653' };
function statChartCanvas(id){
  const c = document.getElementById(id);
  const dpr = window.devicePixelRatio || 1;
  const w = c.width, h = c.height;
  c.width = Math.round(w*dpr);
  c.height = Math.round(h*dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return { ctx, w, h };
}
function drawTierChart(){
  const counts = { '★':0, S:0, A:0, B:0, C:0, unrated:0 };
  songs.forEach(s=>{
    if(s.archived) return;
    if(s.tier && Object.prototype.hasOwnProperty.call(counts, s.tier)) counts[s.tier]++;
    else counts.unrated++;
  });
  const { ctx, w, h } = statChartCanvas('statTierChart');
  ctx.clearRect(0,0,w,h);
  const keys = ['S','A','B','C','unrated'];
  const max = Math.max(1, ...keys.map(k=>counts[k]));
  const padL = 28, padB = 22, padT = 12;
  const chartW = w - padL - 6;
  const barW = (chartW - (keys.length-1)*10) / keys.length;
  keys.forEach((k,i)=>{
    const x = padL + i*(barW+10);
    const val = counts[k];
    const bh = val ? Math.max(3, (val/max)*(h-padT-padB)) : 2;
    const y = h - padB - bh;
    ctx.fillStyle = k === 'unrated' ? canvasPaperColor(0.18) : TIER_CHART_COLORS[k];
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,barW,bh,4); else ctx.rect(x,y,barW,bh);
    ctx.fill();
    ctx.fillStyle = canvasPaperColor(0.75);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(String(val), x+barW/2, y-4);
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(k, x+barW/2, h-8);
  });
}
function drawGenreChart(){
  const map = {};
  songs.forEach(s=>{
    if(s.archived) return;
    (s.genres||[]).forEach(g=>{ const k=String(g).trim(); if(k) map[k]=(map[k]||0)+1; });
  });
  let entries = Object.entries(map).sort((a,b)=>b[1]-a[1]);
  const others = entries.slice(9);
  const head = entries.slice(0,9);
  const otherTotal = others.reduce((n,e)=>n+e[1],0);
  const slices = head.slice();
  if(otherTotal > 0) slices.push(['Other', otherTotal]);
  const total = slices.reduce((n,e)=>n+e[1],0) || 1;
  const { ctx, w, h } = statChartCanvas('statGenreChart');
  ctx.clearRect(0,0,w,h);
  const cx = 92, cy = 95, R = 70;
  const palette = ['#b4b9f3','#ad0505','#fd9f1c','#12141c','#8b5e3c','#6aa84f','#a05aa0','#eedd95','#4a90b8','#888'];
  let angle = -Math.PI/2;
  slices.forEach((e,i)=>{
    const frac = e[1]/total;
    const start = angle, end = angle + frac*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,R,start,end);
    ctx.closePath();
    ctx.fillStyle = palette[i % palette.length];
    ctx.fill();
    ctx.strokeStyle = '#eedd95';
    ctx.lineWidth = 2;
    ctx.stroke();
    angle = end;
  });
  let ly = 16;
  ctx.textAlign = 'left';
  slices.forEach((e,i)=>{
    if(ly > h-18) return;
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(170, ly-9, 10, 10);
    ctx.fillStyle = canvasPaperColor(0.8);
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.fillText(`${e[0]} · ${e[1]} (${Math.round(e[1]/total*100)}%)`, 186, ly);
    ly += 17;
  });
  ctx.fillStyle = 'rgba(var(--on-paper-rgb),0.68)';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('top genres across your cataloguex', cx, h-4);
}
function drawMonthChart(){
  const now = new Date();
  const months = {};
  songs.forEach(s=>{
    if(s.archived || !s.createdAt) return;
    const d = new Date(s.createdAt);
    if(isNaN(d.getTime())) return;
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    months[k] = (months[k]||0)+1;
  });
  const keys = [];
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const { ctx, w, h } = statChartCanvas('statMonthChart');
  ctx.clearRect(0,0,w,h);
  const max = Math.max(1, ...keys.map(k=>months[k]||0));
  const padL = 28, padB = 22, padT = 12;
  const chartW = w - padL - 6;
  const barW = (chartW - (keys.length-1)*4) / keys.length;
  const anyHistory = songs.some(s=>s.createdAt && !s.archived);
  keys.forEach((k,i)=>{
    const x = padL + i*(barW+4);
    const val = months[k]||0;
    const bh = val ? Math.max(2, (val/max)*(h-padT-padB)) : 1;
    const y = h-padB-bh;
    ctx.fillStyle = '#b4b9f3';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,barW,bh,3); else ctx.rect(x,y,barW,bh);
    ctx.fill();
    ctx.fillStyle = 'rgba(var(--on-paper-rgb),0.82)';
    ctx.font = '8px "IBM Plex Mono", monospace';
    ctx.fillText(k.slice(2), x+barW/2, h-8);
  });
  if(!anyHistory){
    ctx.fillStyle = canvasPaperColor(0.45);
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText('Add songs to see your month-by-month history', w/2, (h-padT-padB)/2);
  }
}
function genreCounts(){
  const map = {};
  songs.forEach(s=>{
    if(s.archived) return;
    (s.genres||[]).forEach(g=>{ const k=String(g).trim(); if(k) map[k]=(map[k]||0)+1; });
  });
  return Object.entries(map).sort((a,b)=>b[1]-a[1]);
}
function renderAllGenres(){
  const entries = genreCounts();
  const listEl = document.getElementById('allGenresList');
  const chart = document.getElementById('statGenreChart');
  const hint = document.getElementById('genreToggleHint');
  const expanded = listEl.style.display !== 'none';
  if(expanded){
    listEl.style.display = 'none';
    chart.style.display = '';
    hint.textContent = '(click for all)';
    return;
  }
  chart.style.display = 'none';
  hint.textContent = '(click to collapse)';
  listEl.style.display = 'flex';
  listEl.innerHTML = entries.length
    ? entries.map(([g,n])=>`<span class="tag">${escapeHtml(g)}<b>${n}</b></span>`).join('')
    : '<span class="stat-chart-note">No genres yet — add them when you log songs.</span>';
}
document.getElementById('genreLabelToggle').addEventListener('click', renderAllGenres);
function renderStatTags(){
  const map = {};
  songs.forEach(s=>{
    if(s.archived) return;
    (s.tags||[]).forEach(t=>{ const k=String(t).trim(); if(k) map[k]=(map[k]||0)+1; });
  });
  const entries = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,14);
  document.getElementById('statTags').innerHTML = entries.length
    ? entries.map(([t,n])=>`<span class="tag">${escapeHtml(t)}<b>${n}</b></span>`).join('')
    : '<span class="stat-chart-note">Add tags like “nostalgic” or “road trip” to your songs to see them here.</span>';
}
function openStats(){
  const active = songs.filter(s=>!s.archived);
  document.getElementById('statSongCount').textContent = active.length;
  document.getElementById('statArtistCount').textContent = new Set(active.flatMap(s=>s.artists||[]).map(a=>String(a).trim().toLowerCase())).size;
  document.getElementById('statFavCount').textContent = active.filter(s=>s.favorited).length;
  drawTierChart();
  drawGenreChart();
  drawMonthChart();
  renderStatTags();
  document.getElementById('statsOverlay').classList.add('open');
}
document.getElementById('statsBtn').addEventListener('click', ()=>{ trackEvent('open_stats'); openStats(); });
document.getElementById('statsCloseBtn').addEventListener('click', ()=>{
  document.getElementById('statsOverlay').classList.remove('open');
});
document.getElementById('songDbBtn').addEventListener('click', ()=>{
  if(localStorage.getItem('bayoutonefm-songdb-info-seen')){
    window.location.href = 'songdb.html';
  } else {
    document.getElementById('songDbInfoOverlay').classList.add('open');
  }
});
document.getElementById('songDbInfoCloseBtn').addEventListener('click', ()=>{
  if(document.getElementById('songDbInfoDismiss').checked){
    localStorage.setItem('bayoutonefm-songdb-info-seen', '1');
  }
  document.getElementById('songDbInfoOverlay').classList.remove('open');
  window.location.href = 'songdb.html';
});
/* ---- EXPORT BACKUP ---- */
document.getElementById('exportBackupBtn').addEventListener('click', ()=>{
  trackEvent('export_backup');
  const backup = {
    exportedAt: new Date().toISOString(),
    version: 1,
    username: myProfile?.username || null,
    songs,
    people,
    wishlist,
    custom_themes: loadCustomThemes(),
    stickers: (()=>{ try{ return JSON.parse(localStorage.getItem(STICKERS_KEY)||'[]'); }catch(e){ return []; }})(),
    theme: loadTheme()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bayoutonefm-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

/* ---- YEAR IN REVIEW ---- */
function openYearReview(){
  const year = new Date().getFullYear();
  document.getElementById('yrTitle').textContent = `📅 ${year} Year in Review`;
  const yearSongs = songs.filter(s=> s.createdAt && new Date(s.createdAt).getFullYear() === year && !s.archived);
  const total = yearSongs.length;
  const pinned = yearSongs.filter(s=>s.favorited).length;
  const tiers = { '★':0, S:0, A:0, B:0, C:0 };
  yearSongs.forEach(s=>{ if(s.tier && tiers[s.tier] !== undefined) tiers[s.tier]++; });
  const genreCount = {};
  yearSongs.forEach(s=> (s.genres||[]).forEach(g=>{ genreCount[g] = (genreCount[g]||0)+1; }));
  const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const tagCount = {};
  yearSongs.forEach(s=> (s.tags||[]).forEach(t=>{ tagCount[t] = (tagCount[t]+1)||1; }));
  const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const artistCount = {};
  yearSongs.forEach(s=> (s.artists||[]).forEach(a=>{ artistCount[a] = (artistCount[a]||0)+1; }));
  const topArtists = Object.entries(artistCount).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const monthCounts = Array(12).fill(0);
  yearSongs.forEach(s=>{ const m = new Date(s.createdAt).getMonth(); monthCounts[m]++; });
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxMonth = Math.max(...monthCounts, 1);

  let html = '';
  if(total === 0){
    html = '<div class="yr-section" style="text-align:center;padding:24px 0;color:rgba(var(--on-paper-rgb),0.5);">No songs added this year yet. Start cataloguing!</div>';
  } else {
    html += `<div class="yr-hero"><div class="yr-hero-num">${total}</div><div class="yr-hero-label">songs added in ${year}</div></div>`;
    html += `<div class="yr-section"><div class="yr-stat-grid">`;
    html += `<div class="yr-stat-card"><div class="yr-stat-num">${Object.keys(artistCount).length}</div><div class="yr-stat-label">artists explored</div></div>`;
    html += `<div class="yr-stat-card"><div class="yr-stat-num">${pinned}</div><div class="yr-stat-label">pinned ♥</div></div>`;
    html += `<div class="yr-stat-card"><div class="yr-stat-num">${yearSongs.filter(s=>s.tier==='S').length}</div><div class="yr-stat-label">S-tier tracks</div></div>`;
    html += `<div class="yr-stat-card"><div class="yr-stat-num">${yearSongs.filter(s=>s.edits && s.edits.length).length}</div><div class="yr-stat-label">songs re-edited</div></div>`;
    html += `</div></div>`;

    html += `<div class="yr-section"><div class="yr-section-title">Tier breakdown</div>`;
    ['★','S','A','B','C'].forEach(t=>{
      const count = tiers[t];
      const pct = total ? Math.round((count/total)*100) : 0;
      const colors = { '★':'var(--gold)', S:'var(--gold)', A:'var(--teal)', B:'var(--on-paper)', C:'rgba(var(--on-paper-rgb),0.5)' };
      html += `<div class="yr-bar-row"><span class="yr-bar-label">${t}</span><div class="yr-bar-track"><div class="yr-bar-fill" style="width:${pct}%;background:${colors[t]}"></div></div><span class="yr-bar-count">${count}</span></div>`;
    });
    html += `</div>`;

    if(topGenres.length){
      const maxG = topGenres[0][1];
      html += `<div class="yr-section"><div class="yr-section-title">Top genres</div>`;
      topGenres.forEach(([g,c])=>{
        html += `<div class="yr-bar-row"><span class="yr-bar-label">${escapeHtml(g)}</span><div class="yr-bar-track"><div class="yr-bar-fill" style="width:${Math.round((c/maxG)*100)}%;background:var(--teal)"></div></div><span class="yr-bar-count">${c}</span></div>`;
      });
      html += `</div>`;
    }

    html += `<div class="yr-section"><div class="yr-section-title">Songs per month</div>`;
    monthNames.forEach((name,i)=>{
      const pct = Math.round((monthCounts[i]/maxMonth)*100);
      html += `<div class="yr-bar-row"><span class="yr-bar-label">${name}</span><div class="yr-bar-track"><div class="yr-bar-fill" style="width:${pct}%;background:var(--gold)"></div></div><span class="yr-bar-count">${monthCounts[i]}</span></div>`;
    });
    html += `</div>`;

    if(topArtists.length){
      html += `<div class="yr-section"><div class="yr-section-title">Most-added artists</div><ul class="yr-song-list">`;
      topArtists.forEach(([a,c],i)=>{
        html += `<li class="yr-song-item"><span class="yr-song-rank">${i+1}</span><span class="yr-song-title">${escapeHtml(a)}</span><span class="yr-song-artist">${c} song${c!==1?'s':''}</span></li>`;
      });
      html += `</ul></div>`;
    }

    if(topTags.length){
      html += `<div class="yr-section"><div class="yr-section-title">Most-used tags</div><div class="stat-tags">`;
      topTags.forEach(([t,c])=>{
        html += `<span class="stat-tag">${escapeHtml(t)} <small>${c}</small></span>`;
      });
      html += `</div></div>`;
    }

    const topSongs = yearSongs.filter(s=>s.favorited || s.tier==='S'||s.tier==='A').sort((a,b)=>(b.favorited?1:0)-(a.favorited?1:0) || (tierRank(a.tier) - tierRank(b.tier))).slice(0,10);
    if(topSongs.length){
      html += `<div class="yr-section"><div class="yr-section-title">Highlights of ${year}</div><ul class="yr-song-list">`;
      topSongs.forEach((s,i)=>{
        const cover = s.coverArt ? `<img loading="lazy" decoding="async" class="yr-song-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" alt="Album cover">` : '';
        html += `<li class="yr-song-item"><span class="yr-song-rank">${i+1}</span>${cover}<span class="yr-song-title">${escapeHtml(s.title||'Untitled')}</span><span class="yr-song-artist">${escapeHtml(formatArtists(s.artists))}</span></li>`;
      });
      html += `</ul></div>`;
    }
  }

  document.getElementById('yrBody').innerHTML = html;
  document.getElementById('yearReviewOverlay').classList.add('open');
}
document.getElementById('yearReviewBtn').addEventListener('click', ()=>{ trackEvent('open_year_review'); openYearReview(); });
document.getElementById('yrCloseBtn').addEventListener('click', ()=>{
  document.getElementById('yearReviewOverlay').classList.remove('open');
});
/* ---- FEATURE USAGE ANALYTICS EXPORT ---- */
function showAnalyticsExport(){
  if(myProfile && myProfile.username === 'samannleblanc'){
    document.getElementById('exportAnalyticsBtn').style.display = '';
    document.getElementById('themeBtn').style.display = '';
  }
}
/* ---- SONG OF THE DAY: WEEKLY SCHEDULER (samannleblanc only) ---- */
function showSotdScheduleBtn(){
  const btn = document.getElementById('sotdScheduleBtn');
  if(!btn) return;
  btn.style.display = (myProfile && myProfile.username === 'samannleblanc') ? '' : 'none';
}
function exportUsageData(){
  trackEvent('export_analytics');
  const features = {};
  analyticsLog.forEach(e=>{
    if(!features[e.feature]) features[e.feature] = { count: 0, first: e.ts, last: e.ts };
    features[e.feature].count++;
    if(e.ts < features[e.feature].first) features[e.feature].first = e.ts;
    if(e.ts > features[e.feature].last) features[e.feature].last = e.ts;
  });
  const featureRows = Object.entries(features)
    .map(([f, v])=>({ feature: f, count: v.count, firstUsed: new Date(v.first).toISOString(), lastUsed: new Date(v.last).toISOString() }))
    .sort((a,b)=> b.count - a.count);
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalEvents: analyticsLog.length,
    uniqueFeatures: featureRows.length,
    sessionStart: analyticsLog.length ? new Date(analyticsLog[0].ts).toISOString() : null,
    features: featureRows,
    rawEvents: analyticsLog.map(e=>({ ts: new Date(e.ts).toISOString(), feature: e.feature, detail: e.detail }))
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bayoutonefm-usage-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
document.getElementById('exportAnalyticsBtn').addEventListener('click', exportUsageData);

/* ---- mixtape: friends' recent additions ---- */
let mixtapeDays = 7;
let feedMode = 'friends'; // 'friends' | 'discover'
function mixtapeItemHtml(s, who){
  const cover = s.coverArt
    ? `<img loading="lazy" decoding="async" class="mixtape-cover" src="${escapeAttr(s.coverArt)}" loading="lazy" decoding="async" alt="Album cover">
`
    : `<div class="mixtape-cover mixtape-cover-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
  const when = s.createdAt ? escapeHtml(new Date(s.createdAt).toLocaleString(undefined,{ month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })) : '';
  const from = who === 'you'
      ? '<span class="mixtape-from">your cataloguex</span>'
      : `<span class="mixtape-from">@${escapeHtml(who)}</span>`;
  return `
      <div class="mixtape-item" data-id="${s.id}" data-who="${escapeAttr(who)}" title="${who==='you' ? 'This one is already in your cataloguex' : 'Click to add this to your cataloguex'}">
        ${cover}
        <div class="mixtape-body">
          <p class="mixtape-title">${escapeHtml(s.title||'Untitled')}</p>
          <p class="mixtape-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}</p>
        </div>
        <div class="mixtape-side">
          ${from}
          ${renderTierBadge(s.tier)}
          <span class="mixtape-when">${when}</span>
        </div>
      </div>
    `;
}
function setFeedModeUI(mode){
  feedMode = mode;
  const wOn = mode==='friends' && mixtapeDays===7, mOn = mode==='friends' && mixtapeDays===30, dOn = mode==='discover';
  const wk = document.getElementById('mixtapeWeekBtn'), mo = document.getElementById('mixtapeMonthBtn'), di = document.getElementById('mixtapeDiscoverBtn');
  wk.classList.toggle('active', wOn); wk.setAttribute('aria-pressed', wOn ? 'true' : 'false');
  mo.classList.toggle('active', mOn); mo.setAttribute('aria-pressed', mOn ? 'true' : 'false');
  di.classList.toggle('active', dOn); di.setAttribute('aria-pressed', dOn ? 'true' : 'false');
  document.getElementById('feedFriendsSub').style.display = mode==='discover' ? 'none' : '';
  document.getElementById('feedModeSub').style.display = mode==='discover' ? '' : 'none';
}
document.getElementById('mixtapeWeekBtn').addEventListener('click', ()=>{
  trackEvent('feed_timeframe', {tf:'week'});
  mixtapeDays = 7;
  setFeedModeUI('friends');
  loadFeed();
});
document.getElementById('mixtapeMonthBtn').addEventListener('click', ()=>{
  trackEvent('feed_timeframe', {tf:'month'});
  mixtapeDays = 30;
  setFeedModeUI('friends');
  loadFeed();
});
document.getElementById('mixtapeDiscoverBtn').addEventListener('click', ()=>{
  trackEvent('feed_timeframe', {tf:'discover'});
  setFeedModeUI('discover');
  loadFeed();
});
// discoverCardHtml removed — discover feed now uses feedCardHtml for consistency
// Column name Supabase actually uses for global_songs' recency ordering, discovered at
// runtime since it wasn't possible to confirm the schema in advance. undefined = not yet
// probed, null = no working timestamp column found (falls back to unordered), otherwise
// the column name that worked — cached so we don't re-probe on every Discover open.
let discoverOrderColumn = undefined;
const DISCOVER_ORDER_CANDIDATES = ['created_at', 'inserted_at', 'added_at', 'date_added', 'updated_at'];
async function fetchDiscoverRows(limit){
  if(discoverOrderColumn !== undefined){
    let q = sb.from('global_songs').select('*').limit(limit);
    if(discoverOrderColumn) q = q.order(discoverOrderColumn, { ascending:false });
    const { data, error } = await q;
    if(error) throw error;
    return data || [];
  }
  for(const col of DISCOVER_ORDER_CANDIDATES){
    try{
      const { data, error } = await sb.from('global_songs').select('*').order(col, { ascending:false }).limit(limit);
      if(!error){
        discoverOrderColumn = col;
        return data || [];
      }
    }catch(e){ /* try next candidate */ }
  }
  // None of the guessed columns exist — still show something, just not recency-sorted.
  discoverOrderColumn = null;
  const { data, error } = await sb.from('global_songs').select('*').limit(limit);
  if(error) throw error;
  return data || [];
}
async function loadDiscoverFeed(){
  const list = document.getElementById('feedList');
  const countEl = document.getElementById('feedCount');
  if(!list) return;
  list.innerHTML = '<div class="feed-empty">Loading…</div>';
  try{
    const friendIds = [...myFriendIds];
    if(!friendIds.length){
      if(countEl) countEl.textContent = '';
      list.innerHTML = '<div class="feed-empty">Add some friends to see what they\'re listening to!</div>';
      list.__feedMode = 'discover';
      list.__discoverData = [];
      return;
    }
    const results = await Promise.all(friendIds.slice(0,25).map(async id=>{
      try{
        const friendSongs = (await fetchReadOnlySongs(id)) || [];
        const p = allProfilesCache.find(x=>x.user_id === id);
        return friendSongs
          .filter(s=>!s.archived && s.title)
          .map(s=>({ song:s, who: p?.username || 'friend', profile: p, ownerId: id }));
      }catch(e){ return []; }
    }));
    const all = results.flat();
    for(let i = all.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    if(all.length === 0){
      if(countEl) countEl.textContent = '';
      list.innerHTML = '<div class="feed-empty">Your friends haven\'t added any songs yet.</div>';
      list.__feedMode = 'discover';
      list.__discoverData = [];
      return;
    }
    try{
      const ownerIds = [...new Set(all.map(e=>e.ownerId).filter(Boolean))];
      if(ownerIds.length){
        const { data: rxData } = await sb.from('feed_reactions')
          .select('song_owner_id, song_id, reactor_id, emoji')
          .in('song_owner_id', ownerIds);
        if(rxData){
          all.forEach(e=>{
            e.reactions = rxData.filter(r=>r.song_owner_id===e.ownerId && r.song_id===e.song.id);
          });
        }
      }
    }catch(err){ console.warn('Could not load discover reactions:', err); }
    if(countEl) countEl.textContent = `${all.length} songs from ${friendIds.length} friend${friendIds.length===1?'':'s'}`;
    list.innerHTML = all.map(entry=> feedCardHtml(entry)).join('');
    list.__feedMode = 'discover';
    list.__discoverData = all;
  }catch(e){
    console.warn('Could not load discover feed:', e);
    if(countEl) countEl.textContent = '';
    list.innerHTML = '<div class="feed-empty">Couldn\'t load Discover right now — try again in a bit.</div>';
    list.__feedMode = 'discover';
    list.__discoverData = [];
  }
}
function openAddFromData(data){
  openModal(null);
  document.getElementById('f-title').value = data.title || '';
  document.getElementById('f-artist').value = (data.artists||[]).join(', ');
  document.getElementById('f-album').value = data.album || '';
  document.getElementById('f-year').value = data.year || '';
  const genreEl = document.getElementById('f-genre');
  if(genreEl) genreEl.value = (data.genres||[]).join(', ');
  document.getElementById('f-why').value = data.why || '';
  document.getElementById('f-quick').value = data.quickThought || '';
  document.getElementById('f-credit').value = data.credit || '';
  document.getElementById('f-label').value = data.recordLabel || '';
  document.getElementById('f-release-date').value = data.releaseDate || '';
  document.getElementById('f-artist-website').value = data.artistWebsite || '';
  currentCoverArt = data.coverArt || null;
  setImagePreview('f-cover', currentCoverArt);
  currentTier = data.tier || null;
  renderTierPicker();
}

/* ---- shareable cataloguex card ---- */
function shareTopSongs(list){
  const rank = { '★':0, S:1, A:2, B:3, C:4 };
  return (list||[]).filter(s=>!s.archived).sort((a,b)=>{
    const ra = Object.prototype.hasOwnProperty.call(rank, a.tier) ? rank[a.tier] : 5;
    const rb = Object.prototype.hasOwnProperty.call(rank, b.tier) ? rank[b.tier] : 5;
    if(ra !== rb) return ra - rb;
    return (b.favorited?1:0) - (a.favorited?1:0);
  }).slice(0, 8);
}
function loadCardImage(src){
  return new Promise(resolve=>{
    if(!src){ resolve(null); return; }
    let url = src;
    if(/^https?:/i.test(src)){
      try{
        const u = new URL(src, location.href);
        u.searchParams.set('cardx', String(Date.now()));
        url = u.href;
      }catch(e){}
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>resolve(img);
    img.onerror = ()=>resolve(null);
    img.src = url;
  });
}
function cardRoundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}
function cardTruncate(ctx, str, maxW, font){
  if(!str) return '';
  ctx.font = font;
  if(ctx.measureText(str).width <= maxW) return str;
  let t = String(str);
  while(t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0,-1);
  return t + '…';
}
let shareState = null;
async function drawShareCard(opts){
  if(opts && opts.mode === 'song') return drawSongShareCard(opts);
  if(opts && opts.mode === 'tier') return drawTierShareCard(opts);
  const previewBack = document.getElementById('sharePreviewBack');
  if(previewBack) previewBack.style.display = 'none';
  const dlBack = document.getElementById('shareDownloadBackBtn');
  if(dlBack) dlBack.style.display = 'none';
  const W = 1080, H = 1350;
  const cv = document.getElementById('shareCanvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#1c1e2b');
  g.addColorStop(1,'#11131b');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(180,185,243,0.08)';
  ctx.beginPath(); ctx.arc(W*0.9, H*0.1, 320, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(253,159,28,0.06)';
  ctx.beginPath(); ctx.arc(W*0.08, H*0.92, 280, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#b4b9f3';
  ctx.font = '700 42px "Space Grotesk", sans-serif';
  ctx.fillStyle='#eedd95'; ctx.fillText('bayoutonefm', 88, 142);
  ctx.fillStyle = 'rgba(238,221,149,0.8)';
  ctx.font = '600 28px "Space Grotesk", sans-serif';
  ctx.fillText('CATALOGUEX CARD', 88, 190);

  ctx.fillStyle = '#eedd95';
  ctx.font = 'italic 700 84px Georgia, serif';
  ctx.fillText('@' + (opts.username || 'you'), 84, 318);

  ctx.strokeStyle = 'rgba(238,221,149,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(88, 368); ctx.lineTo(W-88, 368); ctx.stroke();

  ctx.fillStyle = 'rgba(238,221,149,0.7)';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  ctx.fillText('TOP PICKS', 88, 420);

  const picks = shareTopSongs(opts.list);
  const cellW = (W - 88 - 88 - 40) / 2;
  const cellH = 130;
  const coverS = 66;
  const startY = 452;
  const imgs = await Promise.all(picks.map(s=>loadCardImage(s.coverArt)));
  picks.forEach((s,i)=>{
    const col = i % 2, row = Math.floor(i/2);
    const x = 88 + col*(cellW + 40);
    const y = startY + row*cellH;
    const img = imgs[i];
    cardRoundRect(ctx, x, y, coverS, coverS, 10);
    if(img){
      ctx.save();
      cardRoundRect(ctx, x, y, coverS, coverS, 10);
      ctx.clip();
      ctx.drawImage(img, x, y, coverS, coverS);
      ctx.restore();
    } else {
      ctx.fillStyle = '#2a2c33';
      ctx.fill();
      ctx.fillStyle = '#eedd95';
      ctx.font = '700 28px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((s.title||'?').charAt(0).toUpperCase(), x + coverS/2, y + coverS/2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    const tx = x + coverS + 18;
    const tw = cellW - coverS - 18;
    ctx.fillStyle = '#eedd95';
    ctx.font = '700 26px "Space Grotesk", sans-serif';
    ctx.fillText(cardTruncate(ctx, s.title || 'Untitled', tw, ctx.font), tx, y + 24);
    ctx.fillStyle = 'rgba(238,221,149,0.6)';
    ctx.font = '500 21px "Space Grotesk", sans-serif';
    ctx.fillText(cardTruncate(ctx, formatArtists(s.artists), tw, ctx.font), tx, y + 52);
    const tier = s.tier || '';
        const chipCol = { '★':'#eedd95', S:'#E63946', A:'#2A9D8F', B:'#8E44AD', C:'#264653' }[tier] || '#8E44AD';
    ctx.fillStyle = chipCol;
    cardRoundRect(ctx, tx, y + 64, 46, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#11131b';
    ctx.font = '700 18px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tier || '—', tx + 23, y + 85);
    ctx.textAlign = 'left';
  });
  const active = (opts.list || []).filter(s=>!s.archived);
  const artists = new Set(active.flatMap(s=>s.artists||[]).map(a=>String(a).trim().toLowerCase()));
  const starred = active.filter(s=>s.favorited).length;
  const statsLine = `${active.length} SONGS  ·  ${artists.size} ARTISTS  ·  ${starred} STARRED`;
  const t = loadTheme();
  ctx.fillStyle = t.paper || 'rgba(238,221,149,0.85)';
  ctx.font = '500 24px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statsLine, W/2, H - 150);
  ctx.fillStyle = 'rgba(238,221,149,0.4)';
  ctx.font = '500 20px "Space Grotesk", sans-serif';
  const now = new Date();
  ctx.fillStyle='#eedd95'; ctx.fillText('Join bayoutonefm today to share your own music', W/2, H - 96);
  ctx.textAlign = 'left';
}
function cardWrapText(ctx, text, maxW, font){
  ctx.font = font;
  const words = String(text||'').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur + ' ' + w : w;
    if(cur && ctx.measureText(test).width > maxW){
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if(cur) lines.push(cur);
  return lines.slice(0, 4);
}
function cardBase(ctx, W, H, username){
  const t = loadTheme();
  const g = ctx.createLinearGradient(0,0,W,H);
  g.addColorStop(0, t.ink || '#1c1e2b');
  g.addColorStop(1, t.ink || '#11131b');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle = 'rgba(180,185,243,0.08)';
  ctx.beginPath(); ctx.arc(W*0.9, H*0.1, 320, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(253,159,28,0.06)';
  ctx.beginPath(); ctx.arc(W*0.08, H*0.92, 280, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = t.gold || '#b4b9f3';
  ctx.font = '700 42px "Space Grotesk", sans-serif';
  ctx.fillStyle='#eedd95'; ctx.fillText('bayoutonefm', 88, 142);
  ctx.fillStyle = t.paper || 'rgba(238,221,149,0.8)';
  ctx.font = '600 28px "Space Grotesk", sans-serif';
  ctx.fillText('CATALOGUEX CARD', 88, 190);
  ctx.fillStyle = t.paper || '#eedd95';
  ctx.font = 'italic 700 84px Georgia, serif';
  ctx.fillText('@' + (username || 'you'), 84, 318);
  ctx.strokeStyle = t.paper ? t.paper + '40' : 'rgba(238,221,149,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(88, 368); ctx.lineTo(W-88, 368); ctx.stroke();
}
async function drawSongShareCard(opts){
  const cv = document.getElementById('shareCanvas');
  const s = opts.song || {};
  function escapeCss(x){ try{return CSS.escape(x); }catch(e){ return String(x).replace(/"|\\/g,''); } }
  let frontEl = null;
  if(s.id){
    const card = document.querySelector('.card[data-id="' + escapeCss(s.id) + '"]');
    if(card) frontEl = card.querySelector('.card-front');
  }
  if(window.html2canvas && frontEl){
    try{
      frontEl.scrollIntoView({behavior:'auto', block:'center', inline:'center'});
      await new Promise(r=>setTimeout(r,150));
      const c = await Promise.race([
        html2canvas(frontEl, { backgroundColor: loadTheme().paper || '#eedd95', scale: 2 }),
        new Promise((_,rej)=> setTimeout(()=>rej(new Error('html2canvas timeout')), 5000))
      ]);
      cv.width = c.width; cv.height = c.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(c, 0, 0);
      return;
    }catch(e){ console.warn('html2canvas front failed, falling back:', e); }
  }
  const W = 1080, H = 1350;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  cardBase(ctx, W, H, opts.username);
  const t = loadTheme();
  const coverS = 360;
  const coverX = (W - coverS)/2, coverY = 420;
  const img = await loadCardImage(s.coverArt);
  cardRoundRect(ctx, coverX, coverY, coverS, coverS, 24);
  if(img){
    ctx.save();
    cardRoundRect(ctx, coverX, coverY, coverS, coverS, 24);
    ctx.clip();
    ctx.drawImage(img, coverX, coverY, coverS, coverS);
    ctx.restore();
  } else {
    ctx.fillStyle = t.ink || '#12141c';
    ctx.fill();
    ctx.fillStyle = t.paper || '#eedd95';
    ctx.font = '700 180px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((s.title||'?').charAt(0).toUpperCase(), W/2, coverY + coverS/2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.fillStyle = t.paper || '#eedd95';
  ctx.font = '700 64px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cardTruncate(ctx, s.title || 'Untitled', W - 176, ctx.font), W/2, coverY + coverS + 96);
  ctx.fillStyle = t.paper ? t.paper + 'D9' : 'rgba(238,221,149,0.85)';
  ctx.font = '500 34px "Space Grotesk", sans-serif';
  ctx.fillText(cardTruncate(ctx, formatArtists(s.artists), W - 176, ctx.font), W/2, coverY + coverS + 146);
  const detailBits = [s.album, s.year].filter(Boolean).join(' · ');
  if(detailBits){
    ctx.fillStyle = t.paper ? t.paper + '99' : 'rgba(238,221,149,0.6)';
    ctx.font = '500 26px "Space Grotesk", sans-serif';
    ctx.fillText(cardTruncate(ctx, detailBits, W - 176, ctx.font), W/2, coverY + coverS + 194);
  }
  if(s.genres && s.genres.length){
    const genresStr = s.genres.slice(0,3).join('  ·  ');
    ctx.fillStyle = t.gold || 'rgba(180,185,243,0.9)';
    ctx.font = '600 22px "IBM Plex Mono", monospace';
    ctx.fillText(cardTruncate(ctx, genresStr, W - 176, ctx.font), W/2, coverY + coverS + 240);
  }
  const tier = s.tier || '';
  const chipCol = { S: t.teal || '#E63946', A: t.rose || '#2A9D8F', B: t.lilac || '#8E44AD', C: t.sage || '#264653', '★': t.gold || '#d5873f' }[tier] || t.paper || '#d5873f';
  ctx.fillStyle = chipCol;
  cardRoundRect(ctx, W/2 - 44, coverY + coverS + 262, 88, 48, 12);
  ctx.fill();
  ctx.fillStyle = t.ink || '#11131b';
  ctx.font = '700 26px "IBM Plex Mono", monospace';
  ctx.fillText(tier || '—', W/2, coverY + coverS + 295);
  if(s.quickThought){
    const lines = cardWrapText(ctx, '\u201c' + s.quickThought + '\u201d', W - 260, 'italic 500 28px Georgia, serif');
    ctx.fillStyle = t.paper ? t.paper + 'BF' : 'rgba(238,221,149,0.75)';
    ctx.font = 'italic 500 28px Georgia, serif';
    lines.forEach((ln,i)=>{ ctx.fillText(cardTruncate(ctx, ln, W - 260, ctx.font), W/2, coverY + coverS + 348 + i*40); });
  }
  ctx.fillStyle='#eedd95'; ctx.fillText('Join bayoutonefm today to share your own music', W/2, H - 96);
  ctx.textAlign = 'left';
  const backCv = document.getElementById('shareCanvasBack');
  if(backCv) await drawSongBackShareCard(opts, 'shareCanvasBack');
}

async function drawSongBackShareCard(opts, cvId){
  const cv = document.getElementById(cvId || 'shareCanvas');
  const s = opts.song || {};
  function escapeCss(x){ try{return CSS.escape(x); }catch(e){ return String(x).replace(/"|\\/g,''); } }
  let backEl = null;
  if(s.id){
    const card = document.querySelector('.card[data-id="' + escapeCss(s.id) + '"]');
    if(card) backEl = card.querySelector('.card-back');
  }
  if(window.html2canvas && backEl){
    try{
      backEl.scrollIntoView({behavior:'auto', block:'center', inline:'center'});
      await new Promise(r=>setTimeout(r,150));
      const c = await Promise.race([
        html2canvas(backEl, { backgroundColor: loadTheme().paper || '#eedd95', scale: 2 }),
        new Promise((_,rej)=> setTimeout(()=>rej(new Error('html2canvas timeout')), 5000))
      ]);
      cv.width = c.width; cv.height = c.height;
      const ctx = cv.getContext('2d');
      ctx.drawImage(c, 0, 0);
      return;
    }catch(e){ console.warn('html2canvas back failed, falling back:', e); }
  }
  const W = 1080, H = 1350;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  cardBase(ctx, W, H, opts.username);
  ctx.fillStyle = '#eedd95';
  ctx.font = '700 42px "Space Grotesk", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText((s.title||'Untitled'), 88, 220);
  ctx.font = '500 22px "Space Grotesk", sans-serif';
  const fields = [
    ['Track #', trackNoDisplay(s)],
    ['Record label', s.recordLabel || ''],
    ['Release date', s.releaseDate || ''],
    ['Producers', s.producer || ''],
    ['Songwriters', s.songwriters || ''],
    ['BPM', s.bpm ? String(s.bpm) : ''],
    ['Key', s.musicKey ? s.musicKey + (musicKeyToCamelot(s.musicKey)? ' ('+musicKeyToCamelot(s.musicKey)+')':'') : ''],
    ['Duration', s.duration || '']
  ];
  let y = 280;
  ctx.fillStyle = 'rgba(238,221,149,0.9)';
  fields.forEach(([label, val])=>{
    if(!val) return;
    ctx.font = '600 16px "IBM Plex Mono", monospace';
    ctx.fillText(label + ':', 88, y);
    ctx.font = '500 16px "Space Grotesk", sans-serif';
    ctx.fillText(String(val), 220, y);
    y += 34;
  });
  if(s.genres && s.genres.length){
    ctx.font = '500 16px "Space Grotesk", sans-serif';
    ctx.fillText('Genres: ' + s.genres.join(', '), 88, y + 8);
  }
}

async function drawTierShareCard(opts){
  const W = 1080, PAD = 88, BADGE_W = 60, BADGE_H = 48, COVER_S = 80, COVER_GAP = 14, ROW_GAP = 18;
  const active = dedupeSongsForBoard((opts.list || []).filter(s=>!s.archived));
  const byTier = { '★':[], S:[], A:[], B:[], C:[] };
  active.forEach(s=>{ if(byTier[s.tier]) byTier[s.tier].push(s); });
  const tiers = ['★','S','A','B','C'];
  const coversPerRow = Math.floor((W - PAD*2 - BADGE_W - COVER_GAP*2) / (COVER_S + COVER_GAP));
  let totalRows = 0;
  tiers.forEach(t=>{ totalRows += Math.max(1, Math.ceil(byTier[t].length / coversPerRow)); });
  const titleY = 420, headerH = 60;
  const H = titleY + headerH + totalRows * (BADGE_H + 8 + ROW_GAP) + 200;
  const cv = document.getElementById('shareCanvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  cardBase(ctx, W, H, opts.username);
  const t = loadTheme();
  ctx.fillStyle = t.paper ? t.paper + 'B3' : 'rgba(238,221,149,0.7)';
  ctx.font = '500 30px "Space Grotesk", sans-serif';
  ctx.fillText('TIER BOARD', PAD, titleY);
  const tierColors = { '★': '#d5873f', S: t.teal || '#E63946', A: t.rose || '#2A9D8F', B: t.lilac || '#8E44AD', C: t.sage || '#264653' };
  const tierTextColors = { '★': t.ink || '#12141c', S: t.paper || '#eedd95', A: t.ink || '#12141c', B: t.ink || '#12141c', C: t.ink || '#12141c' };
  const allSongs = tiers.flatMap(t=>byTier[t]);
  const imgs = await Promise.all(allSongs.map(s=>loadCardImage(s.coverArt)));
  const imgMap = {};
  allSongs.forEach((s,i)=>{ imgMap[s.id] = imgs[i]; });
  let curY = titleY + headerH;
  const badgeRound = 10;
  tiers.forEach(t=>{
    const items = byTier[t];
    const rows = items.length ? Math.ceil(items.length / coversPerRow) : 0;
    const rowCount = Math.max(1, rows);
    for(let r = 0; r < rowCount; r++){
      const startI = r * coversPerRow;
      const endI = Math.min(startI + coversPerRow, items.length);
      const rowItems = items.slice(startI, endI);
      const badgeY = curY;
      if(r === 0){
        ctx.fillStyle = tierColors[t] || '#12141c';
        cardRoundRect(ctx, PAD, badgeY, BADGE_W, BADGE_H, badgeRound);
        ctx.fill();
        ctx.fillStyle = tierTextColors[t] || '#eedd95';
        ctx.font = '700 28px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, PAD + BADGE_W/2, badgeY + BADGE_H/2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
      const coversX = PAD + BADGE_W + COVER_GAP*2;
      rowItems.forEach((s,ci)=>{
        const cx = coversX + ci*(COVER_S + COVER_GAP);
        const cy = badgeY;
        const img = imgMap[s.id];
        cardRoundRect(ctx, cx, cy, COVER_S, COVER_S, 8);
        if(img){
          ctx.save();
          cardRoundRect(ctx, cx, cy, COVER_S, COVER_S, 8);
          ctx.clip();
          ctx.drawImage(img, cx, cy, COVER_S, COVER_S);
          ctx.restore();
        } else {
          ctx.fillStyle = t.ink || '#12141c';
          ctx.fill();
          ctx.fillStyle = '#eedd95';
          ctx.font = '700 30px Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((s.title||'?').charAt(0).toUpperCase(), cx + COVER_S/2, cy + COVER_S/2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
      });
      if(!rowItems.length){
        ctx.fillStyle = t.paper ? t.paper + '4D' : 'rgba(238,221,149,0.3)';
        ctx.font = '500 18px "Space Grotesk", sans-serif';
        ctx.fillText('Nothing in ' + t + ' tier yet', PAD + BADGE_W + COVER_GAP*2, badgeY + 18);
      }
      curY += BADGE_H + 8 + ROW_GAP;
    }
  });
  const artists = new Set(active.flatMap(s=>s.artists||[]).map(a=>String(a).trim().toLowerCase()));
  const statsLine = `${active.length} SONGS  ·  ${artists.size} ARTISTS  ·  ${active.filter(s=>s.favorited).length} STARRED`;
  ctx.fillStyle = 'rgba(238,221,149,0.85)';
  ctx.font = '500 24px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statsLine, W/2, H - 150);
  ctx.fillStyle = 'rgba(238,221,149,0.4)';
  ctx.font = '500 20px "Space Grotesk", sans-serif';
  const now = new Date();
  ctx.fillStyle='#eedd95'; ctx.fillText('Join bayoutonefm today to share your own music', W/2, H - 96);
  ctx.textAlign = 'left';
}
async function openShareCard(opts){
  shareState = opts;
  let title = 'My cataloguex card', sub = 'A shareable snapshot of your top-tier picks.';
  if(opts.mode === 'song'){
    title = (opts.song && opts.song.title) || 'Song card';
    sub = 'A shareable card for this song — post it anywhere.';
  } else if(opts.mode === 'tier'){
    title = opts.friendName ? `@${opts.username}'s tier board` : 'My tier board';
    sub = opts.friendName
      ? `A shareable snapshot of @${opts.username}'s tier board.`
      : 'A shareable snapshot of your tier board.';
  } else if(opts.friendName){
    title = `@${opts.username}'s card`;
    sub = `A shareable snapshot of @${opts.username}'s top-tier picks.`;
  }
  document.getElementById('shareTitle').textContent = title;
  document.getElementById('shareSub').textContent = sub;
  document.getElementById('shareNote').textContent = 'Generating…';
  document.getElementById('shareOverlay').classList.add('open');
  document.getElementById('shareSendRow').style.display = (opts.mode === 'song') ? '' : 'none';
  const previewBack = document.getElementById('sharePreviewBack');
  const dlBack = document.getElementById('shareDownloadBackBtn');
  const isSong = opts.mode === 'song';
  if(previewBack) previewBack.style.display = isSong ? '' : 'none';
  if(dlBack) dlBack.style.display = isSong ? '' : 'none';
  try{
    await drawShareCard(opts);
    document.getElementById('shareNote').textContent = 'Tip: share it in a story, group chat, or wherever you swap music.';
  }catch(err){
    document.getElementById('shareNote').textContent = 'Could not generate the card — try again.';
    console.error('Share card error:', err);
  }
}
document.getElementById('myShareCardBtn').addEventListener('click', ()=>{
  trackEvent('share_card');
  const username = (myProfile && myProfile.username) || 'you';
  openShareCard({ username, list: songs, friendName: false });
});
document.getElementById('friendShareBtn').addEventListener('click', ()=>{
  trackEvent('share_card');
  const uname = (document.getElementById('friendName').textContent || '@friend').replace(/^@/, '');
  openShareCard({ username: uname, list: currentFriendSongs, friendName: true });
});
document.getElementById('shareMyTierBoardBtn').addEventListener('click', ()=>{
  trackEvent('share_tier_board');
  const username = (myProfile && myProfile.username) || 'you';
  openShareCard({ mode:'tier', username, list: songs, friendName: false });
});
document.getElementById('friendShareTierBoardBtn').addEventListener('click', ()=>{
  trackEvent('share_tier_board');
  const uname = (document.getElementById('friendName').textContent || '@friend').replace(/^@/, '');
  openShareCard({ mode:'tier', username: uname, list: currentFriendSongs, friendName: true });
});
document.getElementById('shareCloseBtn').addEventListener('click', ()=>{
  document.getElementById('shareOverlay').classList.remove('open');
});
let _sendFriendSong = null;
async function openSendFriendPicker(){
  if(!shareState || shareState.mode !== 'song' || !shareState.song){ alert('Only song cards can be sent in chat.'); return; }
  _sendFriendSong = shareState.song;
  const ids = [...myFriendIds];
  const listEl = document.getElementById('sendFriendList');
  if(ids.length === 0){
    listEl.innerHTML = '<p class="profile-empty-note">No friends yet — add friends in 🔎 Discover first.</p>';
  } else {
    listEl.innerHTML = '<p class="profile-empty-note">Loading…</p>';
    const { data, error } = await sb.from('profiles').select('user_id, username, photo').in('user_id', ids);
    const rows = (error ? [] : (data || [])).filter(p=>p.username);
    if(!rows.length){
      listEl.innerHTML = '<p class="profile-empty-note">Could not load your friends.</p>';
    } else {
      listEl.innerHTML = rows.map(p=>`
        <button type="button" class="discover-row" data-send-friend="${escapeAttr(p.user_id)}">
          ${p.photo ? `<img loading="lazy" decoding="async" src="${escapeAttr(p.photo)}" alt="Profile photo">` : `<span class="drow-fallback is-pfp"></span>`}
          <span style="flex:1;"><span class="drow-name">@${escapeHtml(p.username)}</span></span>
          <span class="modal-action-btn accent">Send</span>
        </button>`).join('');
    }
  }
  document.getElementById('sendFriendOverlay').classList.add('open');
}
document.getElementById('shareSendFriendBtn').addEventListener('click', ()=>{
  trackEvent('share_send_friend_open');
  document.getElementById('shareOverlay').classList.remove('open');
  openSendFriendPicker();
});
document.getElementById('sendFriendCloseBtn').addEventListener('click', ()=>{
  document.getElementById('sendFriendOverlay').classList.remove('open');
});
document.getElementById('sendFriendList').addEventListener('click', async e=>{
  const row = e.target.closest('[data-send-friend]');
  if(!row) return;
  const friendId = row.dataset.sendFriend;
  if(!_sendFriendSong || !currentUserId) return;
  row.style.opacity = '0.5';
  const song = _sendFriendSong;
  const payload = {
    title: song.title || 'Unknown song',
    artist: formatArtists(song.artists || []),
    album: song.album || '',
    year: song.year ? parseInt(song.year, 10) : null,
    cover: song.coverArt || null,
    url: geniusLyricsUrl(song.title, song.artists) || '',
    explicit: !!song.explicit
  };
  const { error } = await sb.from('messages').insert({
    sender_id: currentUserId,
    recipient_id: friendId,
    content: '',
    song: payload
  });
  if(error){
    console.error('Error sending song to friend:', error);
    alert('Could not send: ' + error.message);
    row.style.opacity = '';
    return;
  }
  trackEvent('share_send_friend_done');
  const me = (myProfile && myProfile.username) ? '@' + myProfile.username : 'Someone';
  sendNotif(friendId, 'message', me + ' sent you a song: ' + payload.title);
  row.style.opacity = '';
  row.disabled = true;
  const tag = row.querySelector('.modal-action-btn.accent');
  if(tag) tag.textContent = 'Sent ✓';
});
document.getElementById('sendFriendDoneBtn').addEventListener('click', ()=>{
  trackEvent('share_send_done_open_messages');
  document.getElementById('sendFriendOverlay').classList.remove('open');
  if(typeof window.btfOpenMessages === 'function') window.btfOpenMessages();
});
async function shareCardBlob(canvas){
  return new Promise((res, rej)=> canvas.toBlob(b => b ? res(b) : rej(new Error('export failed')), 'image/png'));
}
async function saveOrShareBlob(blob, filename){
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.matchMedia('(max-width:800px)').matches);
  if(isMobile && navigator.share && navigator.canShare){
    const file = new File([blob], filename, { type: 'image/png' });
    if(navigator.canShare({ files: [file] })){
      try{ await navigator.share({ files: [file], title: filename }); return; }catch(e){ if(e && e.name === 'AbortError') return; }
    }
  }
  if(window.showSaveFilePicker){
    try{
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types:[{ description: 'PNG image', accept:{ 'image/png':['.png'] } }] });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return;
    }catch(e){ if(e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function shareCardBaseName(){
  return 'cataloguex-card-' + (String(shareState.username||'you').replace(/[^a-z0-9]/gi,'').toLowerCase() || 'you');
}
document.getElementById('shareDownloadFrontBtn').addEventListener('click', async ()=>{
  trackEvent('share_download_front');
  if(!shareState) return;
  const note = document.getElementById('shareNote');
  try{
    note.textContent = 'Preparing image…';
    const cv = document.getElementById('shareCanvas');
    const blob = await shareCardBlob(cv);
    await saveOrShareBlob(blob, shareCardBaseName() + '-front.png');
    note.textContent = 'Saved — check your Downloads folder.';
  }catch(err){
    console.error('Front download failed:', err);
    note.textContent = 'Download failed — try Copy image instead.';
  }
});
document.getElementById('shareDownloadBackBtn').addEventListener('click', async ()=>{
  trackEvent('share_download_back');
  if(!shareState) return;
  const note = document.getElementById('shareNote');
  try{
    note.textContent = 'Preparing image…';
    const cv = document.getElementById('shareCanvasBack');
    const blob = await shareCardBlob(cv);
    await saveOrShareBlob(blob, shareCardBaseName() + '-back.png');
    note.textContent = 'Saved — check your Downloads folder.';
  }catch(err){
    console.error('Back download failed:', err);
    note.textContent = 'Download failed — try Copy image instead.';
  }
});
document.getElementById('shareCopyBtn').addEventListener('click', async ()=>{
  trackEvent('share_copy');
  const cv = document.getElementById('shareCanvas');
  try{
    const blob = await new Promise(res=>cv.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    document.getElementById('shareNote').textContent = 'Copied! Paste it anywhere.';
  }catch(err){
    document.getElementById('shareNote').textContent = 'Copy isn\u2019t supported in this browser — use Download instead.';
  }
});

/* ---- invite friends ---- */
document.getElementById('inviteBtn').addEventListener('click', ()=>{
  trackEvent('invite_open');
  if(!currentUserId){ alert('Please sign in first.'); return; }
  const inviteUrl = location.origin + location.pathname + '?invite=' + encodeURIComponent(currentUserId);
  document.getElementById('inviteLinkInput').value = inviteUrl;
  document.getElementById('inviteOverlay').classList.add('open');
  loadInviteHistory();
});
document.getElementById('inviteCopyBtn').addEventListener('click', ()=>{
  trackEvent('invite_copy');
  const url = document.getElementById('inviteLinkInput').value;
  navigator.clipboard.writeText(url).then(()=>{
    document.getElementById('inviteCopyBtn').textContent = '✓ Copied!';
    setTimeout(()=>{ document.getElementById('inviteCopyBtn').textContent = '📋 Copy'; }, 2000);
  }).catch(()=>{
    prompt('Copy this invite link:', url);
  });
});
document.getElementById('inviteShareNativeBtn').addEventListener('click', ()=>{
  trackEvent('invite_share_native');
  const url = document.getElementById('inviteLinkInput').value;
  const text = 'Join me on bayoutonefm — your personal music cataloguex! ' + url;
  if(navigator.share){
    navigator.share({ title: 'Join bayoutonefm', text, url }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(text).then(()=>{
      document.getElementById('inviteShareNativeBtn').textContent = '✓ Copied to clipboard!';
      setTimeout(()=>{ document.getElementById('inviteShareNativeBtn').textContent = '📤 Share via…'; }, 2000);
    }).catch(()=>{
      prompt('Share this invite:', text);
    });
  }
});
document.getElementById('inviteCloseBtn').addEventListener('click', ()=>{
  document.getElementById('inviteOverlay').classList.remove('open');
});
async function loadInviteHistory(){
  if(!currentUserId || !sb) return;
  const listEl = document.getElementById('inviteSentList');
  try{
    const { data, error } = await sb.from('profiles').select('user_id, username, photo, created_at').order('created_at', {ascending:false}).limit(20);
    if(error || !data) return;
    const myFriends = Array.from(myFriendIds || []);
    const invitees = data.filter(p => myFriends.includes(p.user_id));
    if(!invitees.length){
      listEl.innerHTML = '<p style="font-size:12px; color:rgba(var(--on-paper-rgb),0.55); text-align:center;">Share the link above to invite friends!</p>';
    } else {
      listEl.innerHTML = '<p class="theme-section-label" style="margin-bottom:8px;">Recent friends</p>' +
        invitees.slice(0,8).map(p => {
          const photo = p.photo ? `<img src="${escapeAttr(p.photo)}" alt="" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : `<span class="drow-fallback is-pfp" style="width:24px;height:24px;font-size:10px;"></span>`;
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;">${photo}<span style="font-size:13px;color:var(--on-paper);">@${escapeHtml(p.username)}</span></div>`;
        }).join('');
    }
  }catch(e){}
}

/* ---- 30-second audio previews (official Apple Music previews via iTunes Search API) ---- */
const previewCache = {};
const previewFailed = new Set();
const previewInflight = new Set();
let itunesCooldownUntil = 0;
let deezerCooldownUntil = 0;
let previewAudio = null;
let nowPlayingId = null;
const feedSongCache = {};
let audioCtx = null;
let audioUnlocked = false;
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 0 && window.matchMedia('(max-width:800px)').matches);
function unlockAudioCtx(){
  if(audioUnlocked) return;
  try{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = audioCtx.createBuffer(1,1,22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
    audioUnlocked = true;
  }catch(e){}
}
function setPreviewBtnState(id, state){
  document.querySelectorAll('[data-preview="' + CSS.escape(String(id)) + '"]').forEach(btn=>{
    btn.classList.remove('loading','playing','none');
    if(state === 'loading'){
      btn.classList.add('loading');
      btn.textContent = '…';
      btn.title = 'Finding a preview…';
    } else if(state === 'playing'){
      btn.classList.add('playing');
      btn.textContent = '⏸';
      btn.title = 'Pause preview';
    } else if(state === 'none'){
      btn.classList.add('none');
      btn.textContent = '—';
      btn.title = 'No preview available';
    } else {
      btn.textContent = '▶︎';
      btn.title = 'Play a 30-second preview';
    }
  });
}
async function fetchPreviewUrl(song){
  const id = song && song.id;
  if(id === null || id === undefined) return null;
  if(previewFailed.has(id) || previewInflight.has(id)) return null;
  if(Object.prototype.hasOwnProperty.call(previewCache, id)) return previewCache[id];
  if(song.previewUrl){ previewCache[id] = song.previewUrl; return song.previewUrl; }
  previewInflight.add(id);
  const term = [song.title, (song.artists||[])[0]].filter(Boolean).join(' ').replace(/\//g, ' ');
  const wantTitle = String(song.title||'').trim().toLowerCase();
  const wantArtist = String((song.artists||[])[0]||'').trim().toLowerCase();
  const now = Date.now();
  function pickHit(rows){
    let hit = rows.find(r=> r.previewUrl && String(r.trackName||'').trim().toLowerCase() === wantTitle && wantArtist && String(r.artistName||'').trim().toLowerCase() === wantArtist);
    if(hit) return { url: hit.previewUrl, tier: 0 };
    hit = rows.find(r=> r.previewUrl && wantTitle && String(r.trackName||'').trim().toLowerCase().includes(wantTitle) && wantArtist && String(r.artistName||'').trim().toLowerCase().includes(wantArtist));
    if(hit) return { url: hit.previewUrl, tier: 1 };
    hit = rows.find(r=> r.previewUrl && String(r.trackName||'').trim().toLowerCase() === wantTitle && wantArtist && wantArtist.split(' ').some(w => w.length > 2 && String(r.artistName||'').toLowerCase().includes(w)));
    if(hit) return { url: hit.previewUrl, tier: 2 };
    return null;
  }
  const jobs = [];
  if(now > deezerCooldownUntil){
    jobs.push(
      deezerSearch(term, 10)
        .then(rows=> pickHit(rows))
        .catch(()=>{ deezerCooldownUntil = Date.now() + 60000; return null; })
    );
  }
  if(now > itunesCooldownUntil){
    jobs.push(
      itunesSearch(term, 'song', 10)
        .then(rows=> pickHit(rows))
        .catch(()=>{ itunesCooldownUntil = Date.now() + 60000; return null; })
    );
  }
  let url = null;
  if(jobs.length === 1){
    const r = await jobs[0];
    url = r ? r.url : null;
  } else if(jobs.length >= 2){
    // Race both sources; take an exact match immediately, otherwise wait for
    // both and prefer the best match quality (exact > partial > loose).
    url = await new Promise((resolve)=>{
      let pending = jobs.length, settledDone = false;
      let best = null;
      const finish = (v)=>{ if(!settledDone){ settledDone = true; resolve(v); } };
      jobs.forEach(p=> p.then(r=>{
        pending--;
        if(r && (!best || r.tier < best.tier)) best = r;
        if(best && best.tier === 0){ finish(best.url); return; }
        if(pending === 0){ finish(best ? best.url : null); }
      }).catch(()=>{ pending--; if(pending === 0){ finish(best ? best.url : null); } }));
      // Safety: never wait longer than 6s total.
      setTimeout(()=> finish(best ? best.url : null), 6000);
    });
  }
  previewInflight.delete(id);
  if(url) previewCache[id] = url;
  else previewFailed.add(id);
  if(url && id === 'sotd' && typeof window.sotdPersistPreview === 'function') window.sotdPersistPreview(url);
  return url;
}
function prefetchPreviews(songList){
  if(!songList || !songList.length) return;
  const todo = songList.filter(s=> s && s.id && !previewFailed.has(s.id) && !previewInflight.has(s.id) && !Object.prototype.hasOwnProperty.call(previewCache, s.id) && !s.previewUrl).slice(0, 60);
  if(!todo.length) return;
  let idx = 0;
  function next(){
    if(idx >= todo.length) return;
    const s = todo[idx++];
    fetchPreviewUrl(s).catch(()=>{}).then(()=> setTimeout(next, 3000));
  }
  next();
}
function stopPreview(){
  if(previewAudio && !previewAudio.paused) previewAudio.pause();
  if(previewAudio) previewAudio.removeAttribute('src');
  if(nowPlayingId){ setPreviewBtnState(nowPlayingId, 'idle'); nowPlayingId = null; }
}
function markPlayed(song){
  if(!song || !song.id) return;
  const idx = songs.findIndex(s=>s.id === song.id);
  if(idx === -1) return; // only record plays for real cataloguex songs
  songs[idx].lastPlayed = Date.now();
  save();
  syncToSupabase();
}

function playPreviewNow(id, song){
  if(!previewAudio) previewAudio = document.getElementById('previewAudio');
  if(nowPlayingId === id && previewAudio && !previewAudio.paused) return false;
  const cachedUrl = (Object.prototype.hasOwnProperty.call(previewCache, song.id)) ? previewCache[song.id] : (song.previewUrl || null);
  if(!cachedUrl) return false;
  if(nowPlayingId && nowPlayingId !== id){ stopPreview(); }
  previewAudio.src = cachedUrl;
  previewAudio.onended = ()=>{ setPreviewBtnState(id, 'idle'); nowPlayingId = null; };
  previewAudio.onerror = ()=>{ setPreviewBtnState(id, 'none'); nowPlayingId = null; };
  previewAudio.oncanplay = null;
  nowPlayingId = id;
  setPreviewBtnState(id, 'playing');
  previewAudio.play().catch(()=>{ setPreviewBtnState(id, 'idle'); nowPlayingId = null; });
  markPlayed(song);
  trackEvent('preview_play');
  return true;
}
async function togglePreview(id){
  if(!previewAudio) previewAudio = document.getElementById('previewAudio');
  if(nowPlayingId === id && previewAudio && !previewAudio.paused){
    previewAudio.pause();
    setPreviewBtnState(id, 'idle');
    nowPlayingId = null;
    return;
  }
  let song = null;
  if(id === 'sotd' && typeof window.sotdPreviewSong === 'function') song = window.sotdPreviewSong();
  if(!song && String(id).indexOf('msgrec:') === 0 && typeof window.msgPreviewSong === 'function') song = window.msgPreviewSong(id);
  if(!song && String(id).indexOf('msg:') === 0 && typeof window.msgThreadPreviewSong === 'function') song = window.msgThreadPreviewSong(id.slice(4));
  if(!song && String(id).indexOf('songsearch:') === 0){
    const t = songSearchCache[parseInt(id.slice(11), 10)];
    if(t) song = { id, title: t.trackName || 'Unknown song', artists: [t.artistName || ''], previewUrl: t.previewUrl || '' };
  }
  if(!song && String(id).indexOf('albs:') === 0 && typeof window.albumPreviewSong === 'function'){
    setPreviewBtnState(id, 'loading');
    song = await window.albumPreviewSong(id);
  }
  if(!song && String(id).indexOf('feed:') === 0){
    song = feedSongCache[id];
  }
  if(!song) song = songs.find(s=>s.id === id) || (currentFriendSongs||[]).find(s=>s.id === id);
  if(!song){ setPreviewBtnState(id, 'none'); setTimeout(()=>{ if(nowPlayingId !== id) setPreviewBtnState(id, 'idle'); }, 1600); return; }
  if(nowPlayingId && nowPlayingId !== id) setPreviewBtnState(nowPlayingId, 'idle');
  previewFailed.delete(id);
  previewInflight.delete(id);
  if(playPreviewNow(id, song)) return;
  setPreviewBtnState(id, 'loading');
  const url = await fetchPreviewUrl(song);
  if(!url){
    setPreviewBtnState(id, 'none');
    setTimeout(()=>{ if(nowPlayingId !== id) setPreviewBtnState(id, 'idle'); }, 1600);
    return;
  }
  if(nowPlayingId && nowPlayingId !== id){ stopPreview(); }
  previewAudio.src = url;
  previewAudio.onended = ()=>{ setPreviewBtnState(id, 'idle'); nowPlayingId = null; };
  previewAudio.onerror = ()=>{ setPreviewBtnState(id, 'none'); nowPlayingId = null; };
  nowPlayingId = id;
  previewAudio.play().then(()=>{ setPreviewBtnState(id, 'playing'); }).catch(()=>{ setPreviewBtnState(id, 'idle'); nowPlayingId = null; });
  markPlayed(song);
  trackEvent('preview_play');
}
function resolveSong(id){
  let song = null;
  if(id === 'sotd' && typeof window.sotdPreviewSong === 'function') song = window.sotdPreviewSong();
  if(!song && String(id).indexOf('msgrec:') === 0 && typeof window.msgPreviewSong === 'function') song = window.msgPreviewSong(id);
  if(!song && String(id).indexOf('msg:') === 0 && typeof window.msgThreadPreviewSong === 'function') song = window.msgThreadPreviewSong(id.slice(4));
  if(!song && String(id).indexOf('songsearch:') === 0){
    const t = songSearchCache[parseInt(id.slice(11), 10)];
    if(t) song = { id, title: t.trackName || 'Unknown song', artists: [t.artistName || ''], previewUrl: t.previewUrl || '' };
  }
  if(!song && String(id).indexOf('albs:') === 0 && typeof window.albumPreviewSong === 'function') return null;
  if(!song && String(id).indexOf('feed:') === 0) song = feedSongCache[id];
  if(!song) song = songs.find(s=>s.id === id) || (currentFriendSongs||[]).find(s=>s.id === id);
  return song;
}
document.addEventListener('click', e=>{
 try{
  unlockAudioCtx();
  const btn = e.target.closest('[data-preview]');
  if(!btn) return;
  e.stopPropagation();
  e.preventDefault();
  const id = btn.dataset.preview;
  if(!previewAudio) previewAudio = document.getElementById('previewAudio');
  if(nowPlayingId === id && previewAudio && !previewAudio.paused){
    previewAudio.pause();
    setPreviewBtnState(id, 'idle');
    nowPlayingId = null;
    return;
  }
  let song = resolveSong(id);
  if(song && playPreviewNow(id, song)) return;
  togglePreview(id);
 }catch(err){ console.error('preview click handler error:', err); }
}, true);
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && nowPlayingId) stopPreview();
});

function render(){
  if(viewingTimeline){
    document.getElementById('grid').style.display = 'none';
    document.getElementById('gridSentinel').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('tierBoard').style.display = 'none';
    document.getElementById('tierBoardToolbar').style.display = 'none';
    document.getElementById('tierBoardEmptyState').style.display = 'none';
    document.getElementById('timeline').style.display = 'none';
    document.getElementById('timelineEmptyState').style.display = 'none';
    renderLastAdded();
    renderTimeline();
    return;
  }
  if(viewingWishlist){
    document.getElementById('tierBoard').style.display = 'none';
    document.getElementById('tierBoardToolbar').style.display = 'none';
    document.getElementById('tierBoardEmptyState').style.display = 'none';
    document.getElementById('timeline').style.display = 'none';
    document.getElementById('timelineEmptyState').style.display = 'none';
    renderWishlistGrid();
    return;
  }
  if(viewingTierBoard){
    document.getElementById('grid').style.display = 'none';
    document.getElementById('gridSentinel').style.display = 'none';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('timeline').style.display = 'none';
    document.getElementById('timelineEmptyState').style.display = 'none';
    renderLastAdded();
    renderTierBoard();
    return;
  }
  document.getElementById('tierBoard').style.display = 'none';
  document.getElementById('tierBoardEmptyState').style.display = 'none';
  document.getElementById('timeline').style.display = 'none';
  document.getElementById('timelineEmptyState').style.display = 'none';
  document.getElementById('grid').style.display = '';
  renderLastAdded();
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const q = document.getElementById('search').value.trim().toLowerCase();
  const fGenre = document.getElementById('filterGenre').value;
  const fMood = document.getElementById('filterMood').value;
  const sortBy = document.getElementById('sortBy').value;

  let list = songs.filter(s=>{
    if(showArchived){ if(!s.archived) return false; }
    else { if(s.archived) return false; }
    if(clusterFilterId) return songStackIds(s).includes(clusterFilterId);
    if(remindsFilterId) return (s.remindsOf||[]).includes(remindsFilterId);
    if(q){
      const hay = `${s.title} ${(s.artists||[]).join(' ')} ${s.album}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(fGenre && !(s.genres||[]).includes(fGenre)) return false;
    if(fMood && !(s.tags||[]).includes(fMood)) return false;
    return true;
  });

  list.sort((a,b)=>{
    if(sortBy === 'pinned') return (b.favorited?1:0) - (a.favorited?1:0) || (tierRank(b.tier) - tierRank(a.tier));
    if(sortBy === 'rating-desc') return tierRank(b.tier) - tierRank(a.tier);
    if(sortBy === 'rating-asc') return tierRank(a.tier) - tierRank(b.tier);
    if(sortBy === 'score-desc') return (Number(b.score)||0) - (Number(a.score)||0);
    if(sortBy === 'score-asc') return (Number(a.score)||0) - (Number(b.score)||0);
    if(sortBy === 'year-desc') return (parseInt(b.year)||0) - (parseInt(a.year)||0);
    if(sortBy === 'year-asc') return (parseInt(a.year)||0) - (parseInt(b.year)||0);
    if(sortBy === 'title') return a.title.localeCompare(b.title);
    if(sortBy === 'recently-played') return (b.lastPlayed||0) - (a.lastPlayed||0);
    return 0;
  });

  if(list.length === 0){
    grid.innerHTML = '';
    currentGridList = [];
    renderedCount = 0;
    document.getElementById('gridSentinel').style.display = 'none';
    empty.style.display = 'block';
    if(showArchived){
      empty.querySelector('h2').textContent = 'Archive is empty';
      empty.querySelector('p').textContent = 'Songs you archive will show up here.';
    } else {
      empty.querySelector('h2').textContent = songs.length ? 'No matches' : 'No tracks yet';
      empty.querySelector('p').textContent = songs.length ? 'Try a different search or filter.' : 'Log your first song to start your cataloguex — and unlock your tier board, timeline, and taste stats.';
    }
  } else {
    empty.style.display = 'none';
    const clusterCounts = {};
    songs.forEach(s=>{ songStackIds(s).forEach(cid=>{ clusterCounts[cid] = (clusterCounts[cid]||0)+1; }); });
    grid.innerHTML = '';
    currentGridList = list;
    currentClusterCounts = clusterCounts;
    renderedCount = 0;
    renderNextGridBatch();
    prefetchPreviews(list);
  }

  const clusterBar = document.getElementById('clusterBar');
  if(clusterFilterId){
    clusterBar.style.display = 'flex';
    const clusterName = stackDisplayName(clusterFilterId);
    document.getElementById('clusterBarText').textContent = `Viewing "${clusterName || 'Untitled stack'}" · ${list.length} song${list.length!==1?'s':''}`;
  } else {
    clusterBar.style.display = 'none';
  }

  const remindsBar = document.getElementById('remindsBar');
  if(remindsFilterId){
    const p = people.find(pp=>pp.id===remindsFilterId);
    remindsBar.style.display = 'flex';
    document.getElementById('remindsBarText').textContent = `Songs that remind me of ${p?p.name:'…'} · ${list.length} song${list.length!==1?'s':''}`;
  } else {
    remindsBar.style.display = 'none';
  }

  const active = songs.filter(s=>!s.archived);
  const archivedCount = songs.filter(s=>s.archived).length;
  const sCount = active.filter(s=>s.tier==='S').length;
  document.getElementById('stats').innerHTML = `<b>${myFriendsCount}</b> friend${myFriendsCount!==1?'s':''} &nbsp;·&nbsp; <b>${active.length}</b> songs logged &nbsp;·&nbsp; <span style="color:var(--rose)"><b>${active.filter(s=>s.favorited).length}</b> ♥</span> &nbsp;·&nbsp; <span style="color:var(--gold)"><b>${active.filter(s=>s.tier==='★').length}</b> ★</span> &nbsp;·&nbsp; <span style="color:var(--teal)"><b>${sCount}</b> S</span> &nbsp;·&nbsp; <span style="color:var(--rose)"><b>${active.filter(s=>s.tier==='A').length}</b> A</span> &nbsp;·&nbsp; <span style="color:var(--lilac)"><b>${active.filter(s=>s.tier==='B').length}</b> B</span> &nbsp;·&nbsp; <span style="color:var(--sage)"><b>${active.filter(s=>s.tier==='C').length}</b> C</span> &nbsp;·&nbsp; <b>${archivedCount}</b> archived`;

  populateFilters();
  renderStickerSections();
  if(!window.__stkMigScheduled){
    window.__stkMigScheduled = true;
    setTimeout(()=>{
      if(typeof migratePageStickersToCards === 'function') migratePageStickersToCards();
    }, 600);
  }
}

function renderWishlistGrid(){
  document.getElementById('lastAdded').style.display = 'none';
  document.getElementById('clusterBar').style.display = 'none';
  document.getElementById('remindsBar').style.display = 'none';
  const grid = document.getElementById('grid');
  const empty = document.getElementById('emptyState');
  const q = document.getElementById('search').value.trim().toLowerCase();
  let list = wishlist.filter(s=>{
    if(!q) return true;
    const hay = `${s.title} ${(s.artists||[]).join(' ')} ${s.album||''}`.toLowerCase();
    return hay.includes(q);
  });
  if(list.length === 0){
    grid.innerHTML = '';
    empty.style.display = 'block';
    empty.querySelector('h2').textContent = wishlist.length ? 'No matches' : 'No songs yet';
    empty.querySelector('p').textContent = wishlist.length ? 'Try a different search.' : "Add a song you wish you'd written — a little inspiration shelf for your cataloguex.";
  } else {
    empty.style.display = 'none';
    grid.innerHTML = list.map(s=>`
      <div class="card" data-wish-id="${s.id}">
        <div class="card-top">
          ${coverThumbHtml(s)}
          <div class="title-stack">
            <p class="track-title" style="${s.tier ? 'color:'+tierColor(s.tier) : ''}">${escapeHtml(s.title||'Untitled')}</p>
            <p class="track-artist">${escapeHtml(formatArtists(s.artists))}${s.album ? ' · '+escapeHtml(s.album) : ''}${trackNoDisplay(s)}</p>
          </div>
        </div>
        <div class="meta-row">${s.year ? `<span>${escapeHtml(s.year)}</span>`:''}</div>
        ${s.lyricSnippet ? `<p class="lyric-snippet">${escapeHtml(s.lyricSnippet)}</p>` : ''}
        ${s.quickThought ? `<p class="why">${escapeHtml(s.quickThought)}</p>` : ''}
        <div class="card-actions">
          <button data-wish-action="edit">EDIT</button>
          <button data-wish-action="delete" class="del">DELETE</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('stats').innerHTML = `<b>${wishlist.length}</b> song${wishlist.length!==1?'s':''} you wish you wrote`;
}

function openModal(song){
  editingId = song ? song.id : null;
  document.getElementById('modalTitle').textContent = song ? 'Edit song' : 'Add a song';
  document.getElementById('f-title').value = song?.title || '';
  document.getElementById('f-artist').value = (song?.artists||[]).join(', ');
  document.getElementById('f-album').value = song?.album || '';
  document.getElementById('f-year').value = song?.year || '';
  document.getElementById('f-genre').value = (song?.genres||[]).join(', ');
  document.getElementById('f-why').value = song?.why || '';
  document.getElementById('f-quick').value = song?.quickThought || '';
  document.getElementById('f-credit').value = song?.credit || '';
  document.getElementById('f-label').value = song?.recordLabel || '';
  document.getElementById('f-duration').value = song?.duration || '';
  document.getElementById('f-producer').value = song?.producer || '';
  document.getElementById('f-songwriters').value = song?.songwriters || '';
  document.getElementById('f-bpm').value = song?.bpm ?? '';
  document.getElementById('f-key').value = song?.musicKey || '';
  updateCamelotPreview('f-key','f-key-camelot');
  document.getElementById('f-release-date').value = song?.releaseDate || '';
  document.getElementById('f-spotify').value = song?.spotifyUrl || '';
  document.getElementById('f-apple').value = song?.appleMusicUrl || '';
  document.getElementById('f-youtube').value = song?.youtubeMusicUrl || '';
  document.getElementById('f-tidal').value = song?.tidalUrl || '';
  document.getElementById('f-artist-website').value = song?.artistWebsite || '';
  document.getElementById('f-track').value = song?.trackNumber || '';
  document.getElementById('f-score').value = (song?.score === null || song?.score === undefined) ? '' : song.score;
  currentStars = { lyrics:(song?.stars&&song.stars.lyrics)||0, vocals:(song?.stars&&song.stars.vocals)||0, replay:(song?.stars&&song.stars.replay)||0 };
  renderStarPickers();
  document.getElementById('f-vibe-energy').value = (song?.vibeEnergy === null || song?.vibeEnergy === undefined) ? 50 : song.vibeEnergy;
  document.getElementById('f-vibe-mood').value = (song?.vibeMood === null || song?.vibeMood === undefined) ? 50 : song.vibeMood;
  document.getElementById('f-vibe-nostalgia').value = (song?.vibeNostalgia === null || song?.vibeNostalgia === undefined) ? 50 : song.vibeNostalgia;
  currentCoverArt = song?.coverArt || null;
  currentExplicit = song?.explicit || false;
  currentFav = song?.favorited || false;
  currentSongSource = song?.source || null;
  setImagePreview('f-cover', currentCoverArt);
  const expBtn = document.getElementById('f-explicit-btn');
  const expLabel = document.getElementById('f-explicit-label');
  expBtn.classList.toggle('on', currentExplicit);
  expLabel.textContent = currentExplicit ? 'Explicit' : 'Not explicit';
  document.getElementById('f-song-search').value = '';
  document.getElementById('songSearchResults').style.display = 'none';
  document.getElementById('songSearchResults').innerHTML = '';
  renderRemindsPicker('f', song?.remindsOf || []);
  currentTier = song?.tier || null;
  renderTierPicker();
  const favBtn = document.getElementById('modalFavBtn');
  favBtn.textContent = currentFav ? '♥' : '♡';
  favBtn.classList.toggle('on', currentFav);
  document.getElementById('overlay').classList.add('open');
  resetEditorTabs('single');
}
function closeModal(){
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}
function resetEditorTabs(prefix){
  var tabs = document.querySelectorAll('[data-editor-tab$="-'+prefix+'"]');
  var panels = document.querySelectorAll('[data-editor-panel$="-'+prefix+'"]');
  tabs.forEach(function(t){ t.classList.remove('active'); });
  panels.forEach(function(p){ p.classList.remove('show'); });
  var firstTab = document.querySelector('[data-editor-tab="front-'+prefix+'"]');
  var firstPanel = document.querySelector('[data-editor-panel="front-'+prefix+'"]');
  if(firstTab) firstTab.classList.add('active');
  if(firstPanel) firstPanel.classList.add('show');
}
document.addEventListener('click', function(e){
  var tab = e.target.closest('.editor-tab');
  if(!tab) return;
  var name = tab.getAttribute('data-editor-tab');
  var suffix = name.split('-').pop();
  var bar = tab.closest('.editor-toggle-bar');
  if(bar) bar.querySelectorAll('.editor-tab').forEach(function(t){ t.classList.remove('active'); });
  tab.classList.add('active');
  document.querySelectorAll('[data-editor-panel$="-'+suffix+'"]').forEach(function(p){ p.classList.remove('show'); });
  var panel = document.querySelector('[data-editor-panel="'+name+'"]');
  if(panel) panel.classList.add('show');
});
function renderTierPicker(){
  const el = document.getElementById('tierPicker');
  el.innerHTML = '';
  TIERS.forEach(t=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tier-' + t + (currentTier===t ? ' selected':'');
    btn.textContent = t;
    btn.addEventListener('click', ()=>{
      currentTier = (currentTier === t) ? null : t;
      if(currentTier){
        const band = bandForTier(currentTier);
        const cur = parseInt(document.getElementById('f-score').value, 10);
        if(isNaN(cur) || cur < band[0] || cur > band[1]){
          document.getElementById('f-score').value = Math.round((band[0] + band[1]) / 2);
        }
      }
      renderTierPicker();
    });
    el.appendChild(btn);
  });
}
let currentStars = { lyrics:0, vocals:0, replay:0 };
function renderStarPickers(){
  [['lyrics','f-stars-lyrics'],['vocals','f-stars-vocals'],['replay','f-stars-replay']].forEach(([key,id])=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '';
    for(let i=1;i<=5;i++){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = i <= currentStars[key] ? 'on' : '';
      b.textContent = '★';
      b.setAttribute('aria-label', key + ' ' + i + ' stars');
      b.addEventListener('click', ()=>{
        currentStars[key] = (currentStars[key] === i) ? 0 : i;
        renderStarPickers();
      });
      el.appendChild(b);
    }
  });
}
document.getElementById('f-score').addEventListener('input', ()=>{
  const v = parseInt(document.getElementById('f-score').value, 10);
  if(isNaN(v)) return;
  const t = tierForScore(Math.max(30, Math.min(100, v)));
  if(t && t !== currentTier){
    currentTier = t;
    renderTierPicker();
  }
});

/* ---- DUPLICATE CHECK ---- */
function normalizeTitle(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
const normalizeArtist = normalizeTitle;
function songKey(song){
  const t = normalizeTitle(song.title);
  const a = (song.artists||[]).map(normalizeArtist).sort().join(' ');
  return t + '||' + a;
}
function findDuplicates(newSongs){
  const existing = new Map();
  songs.forEach(s=>{ existing.set(songKey(s), s); });
  return newSongs.filter(s=>{
    const k = songKey(s);
    return existing.has(k) || (existing.set(k, s), false);
  });
}
function showDupModal(duplicates, onConfirm){
  const body = document.getElementById('dupBody');
  const showCount = Math.min(duplicates.length, 50);
  document.getElementById('dupTitle').textContent = duplicates.length === 1
    ? '⚠️ Already in your cataloguex'
    : `⚠️ ${duplicates.length} songs already in your cataloguex`;
  body.innerHTML = '<p class="dup-body">' + (duplicates.length === 1
    ? 'This song is already in your cataloguex. Add it again?'
    : `${duplicates.length} songs are already in your cataloguex. Add them again?`) + '</p>' +
    duplicates.slice(0, showCount).map(s=>{
      const cover = s.coverArt
        ? `<img loading="lazy" decoding="async" src="${escapeAttr(s.coverArt)}" alt="Album cover">`
        : `<div class="dup-song-fallback">${escapeHtml((s.title||'?').charAt(0).toUpperCase())}</div>`;
      return `<div class="dup-song">${cover}<div class="dup-song-info"><div class="dup-song-title">${escapeHtml(s.title||'')}</div><div class="dup-song-artist">${escapeHtml(formatArtists(s.artists))}</div></div></div>`;
    }).join('') + (duplicates.length > showCount ? `<p class="dup-body" style="opacity:0.6">…and ${duplicates.length - showCount} more</p>` : '');
  document.getElementById('dupOverlay').classList.add('open');
  const confirmBtn = document.getElementById('dupConfirmBtn');
  const cancelBtn = document.getElementById('dupCancelBtn');
  const close = ()=>{ document.getElementById('dupOverlay').classList.remove('open'); confirmBtn.onclick=null; cancelBtn.onclick=null; };
  cancelBtn.onclick = close;
  confirmBtn.onclick = ()=>{ close(); onConfirm(); };
}
function handleSave(){
  const title = document.getElementById('f-title').value.trim();
  if(!title){ document.getElementById('f-title').focus(); return; }
  const trackCheck = validateTrackNo(document.getElementById('f-track').value);
  if(!trackCheck.ok){
    alert('Only Track numbers up to 1,111 and S for a Single are available put in the Track # input.');
    document.getElementById('f-track').focus();
    return;
  }
  const data = {
    title,
    artists: document.getElementById('f-artist').value.split(',').map(a=>a.trim()).filter(Boolean),
    album: document.getElementById('f-album').value.trim(),
    year: document.getElementById('f-year').value.trim(),
    genres: document.getElementById('f-genre').value.split(',').map(g=>g.trim()).filter(Boolean),
    why: document.getElementById('f-why').value.trim(),
    quickThought: document.getElementById('f-quick').value.trim(),
    credit: document.getElementById('f-credit').value.trim(),
    recordLabel: document.getElementById('f-label').value.trim() || null,
    duration: document.getElementById('f-duration').value.trim() || null,
    producer: document.getElementById('f-producer').value.trim() || null,
    songwriters: document.getElementById('f-songwriters').value.trim() || null,
    bpm: (()=>{ const v = parseInt(document.getElementById('f-bpm').value, 10); return isNaN(v) ? null : v; })(),
    musicKey: document.getElementById('f-key').value.trim() || null,
    spotifyUrl: document.getElementById('f-spotify').value.trim() || null,
    appleMusicUrl: document.getElementById('f-apple').value.trim() || null,
    youtubeMusicUrl: document.getElementById('f-youtube').value.trim() || null,
    tidalUrl: document.getElementById('f-tidal').value.trim() || null,
    releaseDate: document.getElementById('f-release-date').value.trim() || null,
    artistWebsite: document.getElementById('f-artist-website').value.trim() || null,
    coverArt: currentCoverArt,
    remindsOf: getSelectedReminds('f'),
    tier: currentTier,
    trackNumber: trackCheck.value,
    score: (()=>{ const v = parseInt(document.getElementById('f-score').value, 10); return isNaN(v) ? null : Math.max(30, Math.min(100, v)); })(),
    stars: { lyrics: currentStars.lyrics || 0, vocals: currentStars.vocals || 0, replay: currentStars.replay || 0 },
    vibeEnergy: clampNum(parseInt(document.getElementById('f-vibe-energy').value, 10) || 0, 0, 100),
    vibeMood: clampNum(parseInt(document.getElementById('f-vibe-mood').value, 10) || 0, 0, 100),
    vibeNostalgia: clampNum(parseInt(document.getElementById('f-vibe-nostalgia').value, 10) || 0, 0, 100),
    explicit: currentExplicit,
    favorited: currentFav,
    source: currentSongSource
  };
  const doSave = ()=>{
    if(!data.coverArt && (data.title || data.artists.length)){
      const q = [data.title, data.artists[0]].filter(Boolean).join(' ');
      deezerSearch(q, 1).then(dz=>{
        if(dz && dz[0] && dz[0].artworkUrl100){
          data.coverArt = upscaleArtwork(dz[0].artworkUrl100);
        }
        if(dz && dz[0] && typeof dz[0].explicit === 'boolean' && !data.explicit){
          data.explicit = dz[0].explicit;
        }
        finishSave(data);
      }).catch(()=>{
        itunesSearch(q, 'song', 1).then(hit=>{
          if(hit && hit[0] && hit[0].artworkUrl100){
            data.coverArt = upscaleArtwork(hit[0].artworkUrl100);
          }
          if(hit && hit[0] && hit[0].trackExplicitness === 'explicit' && !data.explicit){
            data.explicit = true;
          }
          finishSave(data);
        }).catch(()=> finishSave(data));
      });
    } else {
      finishSave(data);
    }
  };
  if(editingId){
    doSave();
  } else {
    const dupes = findDuplicates([data]);
    if(dupes.length > 0){
      showDupModal(dupes, doSave);
    } else {
      doSave();
    }
  }
}
function finishSave(data){
  trackEvent(editingId ? 'edit_song' : 'add_song_single');
  const oldStats = cataloguexBadgeStats(songs);
  const oldBadges = new Set(badgeDefs().filter(b=>b.check(oldStats)).map(b=>b.id));
  if(editingId){
    const idx = songs.findIndex(s=>s.id===editingId);
    if(idx>-1){
      const old = songs[idx];
      const tracked = ['title','artists','album','year','genres','tags','why','credit','tier','coverArt','remindsOf'];
      const changes = tracked.filter(k=>{
        const a = JSON.stringify(old[k]);
        const b = JSON.stringify(data[k]);
        return a !== b;
      }).map(k=>({ field:k, old:old[k], now:data[k] }));
      if(changes.length){
        if(!old.edits) old.edits = [];
        old.edits.push({ at: Date.now(), changes });
      }
      songs[idx] = {...old, ...data};
    }
  } else {
    songs.unshift({ id: uid(), pinned:false, createdAt: Date.now(), ...data });
  }
  save();
  if(editingId){
    const idx = songs.findIndex(s=>s.id===editingId);
    if(idx > -1) updateGlobalSong(songs[idx]);
  } else {
    upsertGlobalSong(data, currentUserId);
    syncToSongDb(data, currentUserId);
  }
  closeModal();
  render();
  if(document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
  const newStats = cataloguexBadgeStats(songs);
  badgeDefs().forEach(b=>{
    if(!oldBadges.has(b.id) && b.check(newStats)){
      sendNotif(currentUserId, 'badge', 'You earned a badge: ' + b.icon + ' ' + b.label);
    }
  });
  if(data.remindsOf && data.remindsOf.length){
    const myName = (myProfile && myProfile.username) || 'Someone';
    data.remindsOf.forEach(pid=>{
      const p = people.find(x=>x.id === pid);
      if(p && p.userId && p.userId !== currentUserId){
        sendNotif(p.userId, 'linked', myName + ' added a song that reminds them of you!');
      }
    });
  }
}

function openMultiModal(mode){
  multiMode = mode;
  const isAlbum = mode === 'album';
  document.getElementById('multiModalTitle').textContent = isAlbum ? 'New Album' : 'New Linked Stack';
  document.getElementById('multiHint').textContent = isAlbum
    ? 'Search Apple Music to pull in tracks, art, and per-track artists automatically — or add tracks manually below. Each track becomes its own entry in your cataloguex.'
    : 'These fields apply to every song below — good for tracks that just remind you of each other.';
  document.getElementById('multiAlbumLabel').textContent = isAlbum ? 'Album' : 'Album (optional)';
  document.getElementById('multiArtistLabel').textContent = isAlbum ? 'Primary artist (fills tracks below — edit each track to add features)' : 'Artist(s)';
  document.getElementById('multiWhyLabel').textContent = isAlbum ? 'Thoughts on the album' : 'What connects these';
  document.getElementById('multiTitlesLabel').textContent = isAlbum ? 'Tracks' : 'Song titles';
  document.getElementById('mf-spotify-search-field').style.display = isAlbum ? '' : 'none';
  document.getElementById('mf-album-search').value = '';
  document.getElementById('albumSearchResults').style.display = 'none';
  document.getElementById('albumSearchResults').innerHTML = '';
  document.getElementById('mf-artist').value = '';
  document.getElementById('mf-album').value = '';
  document.getElementById('mf-year').value = '';
  document.getElementById('mf-genre').value = '';
  document.getElementById('mf-why').value = '';
  document.getElementById('mf-credit').value = '';
  document.getElementById('mf-label').value = '';
  document.getElementById('mf-duration').value = '';
  document.getElementById('mf-producer').value = '';
  document.getElementById('mf-songwriters').value = '';
  document.getElementById('mf-bpm').value = '';
  document.getElementById('mf-key').value = '';
  updateCamelotPreview('mf-key','mf-key-camelot');
  document.getElementById('mf-release-date').value = '';
  document.getElementById('mf-spotify').value = '';
  document.getElementById('mf-apple').value = '';
  document.getElementById('mf-youtube').value = '';
  document.getElementById('mf-tidal').value = '';
  document.getElementById('mf-artist-website').value = '';
  document.getElementById('multiCoverLabel').textContent = isAlbum ? 'Artwork (shared)' : 'Artwork (optional, shared)';
  currentMultiCoverArt = null;
  setImagePreview('mf-cover', null);
  renderRemindsPicker('mf', []);
  currentMultiTier = null;
  resetTitleBoxes();
  document.getElementById('multiOverlay').classList.add('open');
  resetEditorTabs('multi');
  if(isAlbum) document.getElementById('mf-album-search').focus();
}
function closeMultiModal(){
  document.getElementById('multiOverlay').classList.remove('open');
}
function addTitleBoxRow(focus, prefill){
  const container = document.getElementById('titleBoxes');
  const isAlbum = multiMode === 'album';
  const row = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-box-input';
  input.placeholder = isAlbum ? `Track ${container.children.length+1} title` : `Song ${container.children.length+1} title`;
  if(prefill && prefill.title) input.value = prefill.title;
  if(prefill && prefill.no) row._trackNo = prefill.no;
  if(prefill && prefill.label) row._label = prefill.label;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'remove-title';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', ()=>{
    if(container.children.length > 1) row.remove();
  });

  if(isAlbum){
    row.className = 'track-box-row';
    const top = document.createElement('div');
    top.className = 'track-box-row-top';
    const num = document.createElement('span');
    num.className = 'track-box-num';
    num.textContent = (container.children.length+1) + '.';
    top.appendChild(num);
    top.appendChild(input);
    top.appendChild(removeBtn);
    row.appendChild(top);

    const sub = document.createElement('div');
    sub.className = 'track-box-sub';
    const artistInput = document.createElement('input');
    artistInput.type = 'text';
    artistInput.className = 'track-box-artist';
    artistInput.placeholder = 'Artist(s) for this track — e.g. Artist One, Artist Two (feat. …)';
    if(prefill && prefill.artist) artistInput.value = prefill.artist;
    sub.appendChild(artistInput);
    row.appendChild(sub);

    const tierRow = document.createElement('div');
    tierRow.className = 'track-box-tier';
    const tierLabel = document.createElement('span');
    tierLabel.className = 'track-box-tier-label';
    tierLabel.textContent = 'Tier:';
    tierRow.appendChild(tierLabel);
    let trackTier = (prefill && prefill.tier) ? prefill.tier : null;
    ['★','S','A','B','C'].forEach(t=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'track-tier-btn tier-' + t + (trackTier===t ? ' selected' : '');
      btn.textContent = t;
      btn.addEventListener('click', ()=>{
        trackTier = (trackTier === t) ? null : t;
        tierRow.querySelectorAll('.track-tier-btn').forEach(b=>b.classList.toggle('selected', b.textContent===trackTier));
      });
      tierRow.appendChild(btn);
    });
    row._trackTier = ()=> trackTier;
    row.appendChild(tierRow);
  } else {
    row.className = 'title-box-row';
    row.appendChild(input);
    row.appendChild(removeBtn);
  }

  container.appendChild(row);
  if(focus) input.focus();
}
function resetTitleBoxes(prefillTracks){
  document.getElementById('titleBoxes').innerHTML = '';
  if(prefillTracks && prefillTracks.length){
    prefillTracks.forEach(t=>addTitleBoxRow(false, t));
  } else {
    addTitleBoxRow(false);
    addTitleBoxRow(false);
  }
}
function handleMultiSave(){
  const isAlbum = multiMode === 'album';
  const titleInputs = [...document.querySelectorAll('#titleBoxes .title-box-input')];
  if(titleInputs.every(i=>!i.value.trim())){
    titleInputs[0]?.focus();
    return;
  }
  const sharedArtists = document.getElementById('mf-artist').value.split(',').map(a=>a.trim()).filter(Boolean);
  const shared = {
    album: document.getElementById('mf-album').value.trim(),
    year: document.getElementById('mf-year').value.trim(),
    genres: document.getElementById('mf-genre').value.split(',').map(g=>g.trim()).filter(Boolean),
    why: document.getElementById('mf-why').value.trim(),
    credit: document.getElementById('mf-credit').value.trim(),
    recordLabel: document.getElementById('mf-label').value.trim() || null,
    duration: document.getElementById('mf-duration').value.trim() || null,
    producer: document.getElementById('mf-producer').value.trim() || null,
    songwriters: document.getElementById('mf-songwriters').value.trim() || null,
    bpm: (()=>{ const v = parseInt(document.getElementById('mf-bpm').value, 10); return isNaN(v) ? null : v; })(),
    musicKey: document.getElementById('mf-key').value.trim() || null,
    spotifyUrl: document.getElementById('mf-spotify').value.trim() || null,
    appleMusicUrl: document.getElementById('mf-apple').value.trim() || null,
    youtubeMusicUrl: document.getElementById('mf-youtube').value.trim() || null,
    tidalUrl: document.getElementById('mf-tidal').value.trim() || null,
    releaseDate: document.getElementById('mf-release-date').value.trim() || null,
    artistWebsite: document.getElementById('mf-artist-website').value.trim() || null,
    coverArt: currentMultiCoverArt,
    remindsOf: getSelectedReminds('mf'),
    tier: currentMultiTier
  };
  const clusterId = uid();
  const albumTitle = document.getElementById('mf-album').value.trim();
  const albumArtist = document.getElementById('mf-artist').value.trim();
  const albumName = isAlbum ? ((albumTitle || 'Untitled') + (albumArtist ? ' — ' + albumArtist : '')) : null;
  const now = Date.now();
  let newSongs;
  if(isAlbum){
    const rows = [...document.querySelectorAll('#titleBoxes .track-box-row')];
    newSongs = rows.map(row=>{
      const title = row.querySelector('.title-box-input').value.trim();
      if(!title) return null;
      const artistVal = row.querySelector('.track-box-artist').value.trim();
      const trackTier = row._trackTier ? row._trackTier() : null;
      return {
        id: uid(), pinned:false, createdAt: now, clusterId, clusterName: albumName, title,
        artists: artistVal ? artistVal.split(',').map(a=>a.trim()).filter(Boolean) : sharedArtists,
        trackNumber: row._trackNo || null,
        recordLabel: row._label || null,
        ...shared,
        tier: trackTier || shared.tier
      };
    }).filter(Boolean);
  } else {
    const titles = titleInputs.map(i=>i.value.trim()).filter(Boolean);
    newSongs = titles.map(title=>({
      id: uid(), pinned:false, createdAt: now, clusterId,
      artists: sharedArtists,
      ...shared
    }));
  }
  if(newSongs.length === 0){
    titleInputs[0]?.focus();
    return;
  }
  const dupes = findDuplicates(newSongs);
  const doMultiSave = ()=>{
    trackEvent('save_album', { count: newSongs.length });
    songs = [...newSongs, ...songs];
    save();
    upsertGlobalSongBatch(newSongs, currentUserId);
    syncToSongDbBatch(newSongs, currentUserId);
    closeMultiModal();
    render();
    if(document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
    if(shared.remindsOf && shared.remindsOf.length){
      const myName = (myProfile && myProfile.username) || 'Someone';
      shared.remindsOf.forEach(pid=>{
        const p = people.find(x=>x.id === pid);
        if(p && p.userId && p.userId !== currentUserId){
          sendNotif(p.userId, 'linked', myName + ' added a song that reminds them of you!');
        }
      });
    }
  };
  if(dupes.length > 0){
    showDupModal(dupes, doMultiSave);
  } else {
    doMultiSave();
  }
}

document.getElementById('grid').addEventListener('click', e=>{
  const stacksBtn = e.target.closest('[data-stacks-for]');
  if(stacksBtn){
    if(typeof openSongStacksPopover === 'function') openSongStacksPopover(stacksBtn.dataset.stacksFor);
    return;
  }
  const linkBadge = e.target.closest('.link-badge');
  if(linkBadge){
    clusterFilterId = linkBadge.dataset.cluster;
    remindsFilterId = null;
    render();
    return;
  }
  const removeReminderBtn = e.target.closest('[data-remove-reminder]');
  if(removeReminderBtn){
    const [songId, personId] = removeReminderBtn.dataset.removeReminder.split('|');
    const song = songs.find(s=>s.id===songId);
    if(song){
      song.remindsOf = (song.remindsOf||[]).filter(pid=>pid!==personId);
      save();
      render();
    }
    return;
  }
  const remindsBadge = e.target.closest('.reminds-badge[data-person]');
  if(remindsBadge){
    remindsFilterId = remindsBadge.dataset.person;
    clusterFilterId = null;
    renderPeople();
    render();
    return;
  }
  const wishBtn = e.target.closest('button[data-wish-action]');
  if(wishBtn){
    const card = wishBtn.closest('.card');
    const id = card.dataset.wishId;
    const item = wishlist.find(w=>w.id===id);
    if(!item) return;
    const action = wishBtn.dataset.wishAction;
    if(action === 'edit'){
      openWishModal(item);
    } else if(action === 'delete'){
      if(confirm(`Remove "${item.title}" from your wishlist?`)){
        wishlist = wishlist.filter(w=>w.id!==id);
        saveWishlist();
        renderWishlistGrid();
      }
    }
    return;
  }
  const btn = e.target.closest('button[data-action]');
  if(!btn) return;
  const card = btn.closest('.card');
  const id = card.dataset.id;
  const song = songs.find(s=>s.id===id);
  if(!song) return;
  const action = btn.dataset.action;
  if(action === 'pin'){
    trackEvent('pin_song');
    song.favorited = !song.favorited;
    btn.setAttribute('aria-pressed', song.favorited ? 'true' : 'false');
    btn.setAttribute('aria-label', song.favorited ? 'Remove from favorites' : 'Add to favorites');
    save(); render();
    if(document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
  } else if(action === 'archive'){
    trackEvent('archive_song');
    song.archived = !song.archived;
    if(song.archived) song.tier = '';
    save(); render();
    if(document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
  } else if(action === 'edit'){
    trackEvent('edit_song_open');
    openModal(song);
  } else if(action === 'share'){
    trackEvent('share_song');
    openShareCard({ mode:'song', song, username: (myProfile && myProfile.username) || 'you', friendName: false });
  } else if(action === 'flip'){
    const cardEl = btn.closest('.card');
    if(cardEl) cardEl.classList.toggle('flipped');
  } else if(action === 'delete'){
    trackEvent('delete_song');
    if(confirm(`Remove "${song.title}" from your cataloguex?`)){
      songs = songs.filter(s=>s.id!==id);
      save(); render();
      if(document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
    }
  }
});

function updateViewUI(){
  const archBtn = document.getElementById('toggleArchive');
  const wishBtn = document.getElementById('toggleWishlist');
  const tierBtn = document.getElementById('toggleTierBoard');
  const timeBtn = document.getElementById('toggleTimeline');
  archBtn.textContent = showArchived ? '← Back to cataloguex' : 'View archive';
  archBtn.classList.toggle('active', showArchived);
  archBtn.setAttribute('aria-pressed', showArchived ? 'true' : 'false');
  wishBtn.textContent = viewingWishlist ? '← Back to cataloguex' : '✍ Songs I Wish I Wrote';
  wishBtn.classList.toggle('active', viewingWishlist);
  wishBtn.setAttribute('aria-pressed', viewingWishlist ? 'true' : 'false');
  tierBtn.textContent = viewingTierBoard ? '← Back to cataloguex' : '🏆 Tier board';
  tierBtn.classList.toggle('active', viewingTierBoard);
  tierBtn.setAttribute('aria-pressed', viewingTierBoard ? 'true' : 'false');
  timeBtn.textContent = viewingTimeline ? '← Back to cataloguex' : '🕰 Timeline';
  timeBtn.classList.toggle('active', viewingTimeline);
  timeBtn.setAttribute('aria-pressed', viewingTimeline ? 'true' : 'false');

  const otherMode = showArchived || viewingWishlist;
  document.getElementById('openAddMusic').style.display = otherMode ? 'none' : '';
  document.getElementById('openCluster').style.display = otherMode ? 'none' : '';
  document.getElementById('viewClustersBtn').style.display = otherMode ? 'none' : '';

  document.getElementById('resetCataloguexBtn').style.display = otherMode ? 'none' : '';
  document.getElementById('openWish').style.display = viewingWishlist ? '' : 'none';
  document.getElementById('peopleSection').style.display = viewingWishlist ? 'none' : '';
  document.getElementById('filterGenre').style.display = (viewingWishlist || viewingTierBoard || viewingTimeline) ? 'none' : '';
  document.getElementById('filterMood').style.display = (viewingWishlist || viewingTierBoard || viewingTimeline) ? 'none' : '';
  document.getElementById('sortBy').style.display = (viewingWishlist || viewingTierBoard || viewingTimeline) ? 'none' : '';
  document.getElementById('search').style.display = (viewingTierBoard || viewingTimeline) ? 'none' : '';
  archBtn.style.display = (viewingWishlist || viewingTierBoard || viewingTimeline) ? 'none' : '';
  wishBtn.style.display = (showArchived || viewingTierBoard || viewingTimeline) ? 'none' : '';
  tierBtn.style.display = (showArchived || viewingWishlist || viewingTimeline) ? 'none' : '';
  clusterFilterId = null;
  remindsFilterId = null;
}
function saveViewMode(){
  const mode = showArchived ? 'archive' : viewingWishlist ? 'wishlist' : viewingTierBoard ? 'tierboard' : viewingTimeline ? 'timeline' : 'cataloguex';
  localStorage.setItem('bayoutonefm-view-mode', mode);
}
document.getElementById('toggleArchive').addEventListener('click', ()=>{
  trackEvent('toggle_archive');
  showArchived = !showArchived;
  if(showArchived){ viewingWishlist = false; viewingTierBoard = false; viewingTimeline = false; }
  saveViewMode();
  updateViewUI();
  render();
});
document.getElementById('toggleWishlist').addEventListener('click', ()=>{
  trackEvent('toggle_wishlist');
  viewingWishlist = !viewingWishlist;
  if(viewingWishlist){ showArchived = false; viewingTierBoard = false; viewingTimeline = false; }
  saveViewMode();
  updateViewUI();
  render();
});
document.getElementById('toggleTierBoard').addEventListener('click', ()=>{
  trackEvent('toggle_tier_board');
  viewingTierBoard = !viewingTierBoard;
  if(viewingTierBoard){ showArchived = false; viewingWishlist = false; viewingTimeline = false; }
  saveViewMode();
  updateViewUI();
  render();
});
document.getElementById('toggleTimeline').addEventListener('click', ()=>{
  trackEvent('toggle_timeline');
  viewingTimeline = !viewingTimeline;
  if(viewingTimeline){ showArchived = false; viewingWishlist = false; viewingTierBoard = false; }
  saveViewMode();
  updateViewUI();
  render();
});
document.getElementById('openAddMusic').addEventListener('click', ()=>{
  trackEvent('open_add_music');
  openImportUrlScreen('song');
});
document.querySelectorAll('.empty-state-add-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    trackEvent('open_add_music_from_empty_state');
    openImportUrlScreen('song');
  });
});
let addMusicMode = null;
function openImportUrlScreen(mode){
  addMusicMode = 'song';
  const ov = document.getElementById('spotifyImportOverlay');
  ov.classList.add('open');
  const titleEl = document.getElementById('importModalTitle');
  const labelEl = ov.querySelector('label');
  titleEl.textContent = 'Add Music';
  labelEl.textContent = 'Paste a Spotify, Apple Music, YouTube, or Tidal link';
  document.getElementById('spotify-url-input').value = '';
  document.getElementById('spotifyImportResults').style.display = 'none';
  document.getElementById('spotifyImportError').style.display = 'none';
  document.getElementById('spotifyImportConfirmBtn').disabled = true;
  document.getElementById('spotifyImportCancelBtn').textContent = 'Cancel';
  document.getElementById('spotifyImportStopBtn').style.display = 'none';
  document.getElementById('spotifyImportPauseBtn').style.display = 'none';
  playlistImportedTracks = [];
  playlistImportService = 'spotify';
  playlistImportUrl = null;
  playlistImportLoadedUrl = null;
  playlistImportInProgress = false;
  stopImportProgressTimer();
  document.getElementById('spotify-url-input').focus();
}
document.getElementById('addMusicSongBtn').addEventListener('click', ()=>{
  trackEvent('add_song_single');
  addMusicMode = 'song';
  document.getElementById('addMusicOverlay').classList.remove('open');
  openImportUrlScreen('song');
});
document.getElementById('addMusicAlbumBtn').addEventListener('click', ()=>{
  trackEvent('add_song_album');
  addMusicMode = 'album';
  document.getElementById('addMusicOverlay').classList.remove('open');
  openImportUrlScreen('album');
});
document.getElementById('addMusicCancelBtn').addEventListener('click', ()=>{
  document.getElementById('addMusicOverlay').classList.remove('open');
});
/* ---- LONG-PRESS HELP TIPS ---- */
(function(){
  let tipEl=null, timer=null, active=null, suppressClick=false;
  function makeTip(){ tipEl=document.createElement('div'); tipEl.id='holdTip'; document.body.appendChild(tipEl); }
  function posTip(el){
    if(!tipEl) return;
    const r=el.getBoundingClientRect();
    let x=r.left+r.width/2, y=r.top-8;
    tipEl.style.left='0px'; tipEl.style.top='0px';
    const tw=tipEl.offsetWidth, th=tipEl.offsetHeight;
    x=Math.max(8, Math.min(x-tw/2, window.innerWidth-tw-8));
    if(y-th<8) y=r.bottom+8;
    else y=y-th;
    tipEl.style.left=x+'px'; tipEl.style.top=y+'px';
  }
  function show(el){
    const msg=el.getAttribute('data-help');
    if(!msg) return;
    if(!tipEl) makeTip();
    tipEl.textContent=msg;
    tipEl.classList.add('show');
    active=el;
    posTip(el);
    suppressClick=true;
  }
  function hide(){ if(tipEl){ tipEl.classList.remove('show'); } active=null; suppressClick=false; }
  function cancel(){ if(timer){ clearTimeout(timer); timer=null; } }
  document.addEventListener('pointerdown', function(e){
    const el=e.target.closest('[data-help]');
    if(!el){ cancel(); return; }
    cancel();
    active=el;
    timer=setTimeout(function(){ show(el); timer=null; }, 3000);
  }, {passive:true});
  ['pointerup','pointerleave','pointercancel'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      if(timer){ cancel(); }
      if(active && tipEl && tipEl.classList.contains('show')){
        setTimeout(hide, 1500);
      } else { hide(); }
    }, {passive:true});
  });
  document.addEventListener('click', function(e){
    if(suppressClick){ e.stopImmediatePropagation(); e.preventDefault(); suppressClick=false; return false; }
  }, true);
})();
/* ---- TOAST NOTIFICATIONS ---- */
function showToast(msg, duration){
  duration = duration || 5000;
  let t = document.getElementById('appToast');
  if(!t){
    t = document.createElement('div');
    t.id = 'appToast';
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    t.setAttribute('aria-atomic', 'true');
    t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);max-width:420px;width:calc(100% - 32px);padding:12px 20px;border-radius:8px;background:var(--ink);border:1px solid rgba(var(--on-paper-rgb),0.15);color:var(--paper);font-family:"Space Grotesk",sans-serif;font-size:13px;line-height:1.5;z-index:10002;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);opacity:0;transition:opacity 0.25s ease;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  if(t._timer) clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.style.opacity = '0'; }, duration);
}

/* ---- PLAYLIST IMPORT (Spotify / Apple Music / Tidal) ---- */
let playlistImportedTracks = [];
let playlistImportService = 'spotify';
let playlistImportUrl = null;
let playlistImportName = '';
let playlistImportInProgress = false;
let playlistImportLoadedUrl = null;
let importProgressTimer = null;
let importProgressState = null;

function fmtTime(sec){
  if(sec > 60) return Math.floor(sec/60) + 'm ' + (Math.floor(sec)%60) + 's';
  return Math.floor(sec) + 's';
}

function startImportProgressTimer(){
  stopImportProgressTimer();
  importProgressTimer = setInterval(()=>{
    if(!importProgressState || !importProgressState.active) return;
    const elapsed = (Date.now() - importProgressState.startTime) / 1000;
    const done = importProgressState.done;
    const total = importProgressState.total;
    const remaining = total - done;
    let etaStr;
    if(done > 0){
      const rate = elapsed / done;
      const etaSec = Math.round(remaining * rate);
      etaStr = fmtTime(etaSec) + ' remaining';
    } else {
      etaStr = 'calculating…';
    }
    const elapsedStr = fmtTime(elapsed);
    let cdStr = '';
    if(importProgressState.cooldownEnd && Date.now() < importProgressState.cooldownEnd){
      cdStr = ' · cooling down ' + Math.ceil((importProgressState.cooldownEnd - Date.now()) / 1000) + 's';
    }
    const msg = importProgressState.label + ` ${done}/${total}${cdStr} · ~${etaStr} (${elapsedStr} elapsed)`;
    if(importProgressState.statusEl){ importProgressState.statusEl.textContent = msg; }
    else if(importProgressState.listEl){ importProgressState.listEl.innerHTML = `<p class="profile-empty-note">${msg}</p>`; }
  }, 5000);
}

function stopImportProgressTimer(){
  if(importProgressTimer){ clearInterval(importProgressTimer); importProgressTimer = null; }
  importProgressState = null;
}
document.getElementById('addMusicSpotifyBtn').addEventListener('click', ()=>{
  trackEvent('open_playlist_import');
  document.getElementById('addMusicOverlay').classList.remove('open');
  openImportUrlScreen('playlist');
});
document.getElementById('spotifyImportCancelBtn').addEventListener('click', function(){
  if(playlistImportedTracks && playlistImportedTracks.length){
    playlistImportedTracks = [];
    playlistImportLoadedUrl = null;
    document.getElementById('spotifyImportResults').style.display = 'none';
    document.getElementById('spotifyImportConfirmBtn').disabled = true;
    document.getElementById('spotify-url-input').value = '';
    document.getElementById('importModalTitle').textContent = 'Import Playlist';
    playlistImportName = '';
    this.textContent = 'Close';
    return;
  }
  document.getElementById('spotifyImportOverlay').classList.remove('open');
  addMusicMode = null;
});
document.getElementById('spotifyImportStopBtn').addEventListener('click', ()=>{
  playlistImportedTracks = [];
  playlistImportInProgress = false;
  playlistImportUrl = null;
  playlistImportLoadedUrl = null;
  stopImportProgressTimer();
  document.getElementById('spotify-url-input').value = '';
  document.getElementById('spotifyImportResults').style.display = 'none';
  document.getElementById('spotifyImportError').style.display = 'none';
  document.getElementById('spotifyImportConfirmBtn').disabled = true;
  document.getElementById('spotifyImportStopBtn').style.display = 'none';
  document.getElementById('spotifyImportPauseBtn').style.display = 'none';
});
document.getElementById('spotifyImportPauseBtn').addEventListener('click', ()=>{
  if(importProgressState){
    importProgressState.paused = !importProgressState.paused;
    document.getElementById('spotifyImportPauseBtn').textContent = importProgressState.paused ? 'Resume' : 'Pause';
  }
});
async function fetchSpotifyToken(){
  const CLIENT_ID = 'd53cc1de9d0c4ac0a45483affc63f998';
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type:'client_credentials', client_id:CLIENT_ID })
  });
  if(!resp.ok) throw new Error('Could not authenticate with Spotify');
  const data = await resp.json();
  return data.access_token;
}

async function handleSingleUrl(url){
  const errEl = document.getElementById('spotifyImportError');
  const resultsEl = document.getElementById('spotifyImportResults');
  errEl.style.display = 'none';
  resultsEl.style.display = 'none';
  const isSpotifyTrack = /open\.spotify\.com\/track\//.test(url);
  const isSpotifyAlbum = /open\.spotify\.com\/album\//.test(url);
  const appleMatch = url.match(/music\.apple\.com\/.*\/album\/.*\/(\d+)(?:\?i=(\d+))?/);
  const isTidalTrack = /tidal\.com\/(?:browse\/)?track\/(\d+)/.test(url);
  const isTidalAlbum = /tidal\.com\/(?:browse\/)?album\/(\d+)/.test(url);
  const ytMatch = url.match(/(?:music\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+)/);
  try{
    if(isSpotifyTrack){
      const trackId = url.match(/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/)[1];
      const token = await fetchSpotifyToken();
      const resp = await fetch('https://api.spotify.com/v1/tracks/' + trackId, { headers:{ Authorization:'Bearer '+token } });
      if(!resp.ok) throw new Error('Track not found');
      const t = await resp.json();
      const trackData = { title:t.name, artists:(t.artists||[]).map(a=>a.name), album:(t.album&&t.album.name)||'', year:(t.album&&t.album.release_date)||'', releaseDate:(t.album&&t.album.release_date)||'', coverArt:(t.album&&t.album.images&&t.album.images[0]&&t.album.images[0].url)||null, explicit:!!t.explicit, spotifyUrl:t.external_urls&&t.external_urls.spotify||'' };
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      openAddFromData(trackData);
      if(trackData.spotifyUrl) document.getElementById('f-spotify').value = trackData.spotifyUrl;
      return;
    }
    if(isSpotifyAlbum){
      const albumId = url.match(/open\.spotify\.com\/album\/([a-zA-Z0-9]+)/)[1];
      const token = await fetchSpotifyToken();
      const resp = await fetch('https://api.spotify.com/v1/albums/' + albumId, { headers:{ Authorization:'Bearer '+token } });
      if(!resp.ok) throw new Error('Album not found');
      const a = await resp.json();
      const albumArtists = (a.artists||[]).map(x=>x.name);
      const albumName = a.name||'';
      const albumYear = a.release_date||'';
      const coverArt = (a.images&&a.images[0]&&a.images[0].url)||null;
      const albumTracks = (a.tracks&&a.tracks.items||[]).map(t=>({ title:t.name, artists:(t.artists||[]).map(x=>x.name), trackNumber:t.track_number, spotifyUrl:t.external_urls&&t.external_urls.spotify||'' }));
      const clusterId = uid();
      const now = Date.now();
      const allImported = albumTracks.map((t,i)=>({
        id: uid(), pinned:false, createdAt:now, clusterId, clusterName:albumName||'Album Import',
        title:t.title, artists:t.artists.length?t.artists:albumArtists, album:albumName,
        genres:[], why:'', credit:'', coverArt, tier:null, remindsOf:[], year:albumYear||null,
        trackNumber:t.trackNumber||(i+1), spotifyUrl:t.spotifyUrl||'',
        releaseDate:albumYear||null,
      }));
      const dupes = findDuplicates(allImported);
      const dupeKeys = new Set(dupes.map(d=>songKey(d)));
      const newSongs = allImported.filter(s=>!dupeKeys.has(songKey(s)));
      dupes.forEach(d=>{ const ex=songs.find(s=>songKey(s)===songKey(d)); if(ex && !ex.coverArt && d.coverArt) ex.coverArt=d.coverArt; });
      songs = [...newSongs, ...songs];
      save();
      upsertGlobalSongBatch(newSongs, currentUserId);
      syncToSongDbBatch(newSongs, currentUserId);
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      render();
      enrichImportedSongs(clusterId, 'Spotify');
      if(dupes.length>0) showToast('Imported '+newSongs.length+' songs. Skipped '+dupes.length+' duplicates.');
      else showToast('Imported '+newSongs.length+' songs from "'+albumName+'".');
      return;
    }
    if(appleMatch && appleMatch[2]){
      const resp = await fetch('https://itunes.apple.com/lookup?id=' + appleMatch[2] + '&entity=song');
      if(resp.ok){
        const d = await resp.json();
        if(d.results && d.results.length){
          const t = d.results[0];
          const trackData = { title:t.trackName, artists:[t.artistName], album:t.collectionName||'', year:t.releaseDate||'', releaseDate:t.releaseDate||'', coverArt:t.artworkUrl100||null, explicit:!!t.trackExplicitness, appleMusicUrl:t.trackViewUrl||'' };
          document.getElementById('spotifyImportOverlay').classList.remove('open');
          openAddFromData(trackData);
          if(trackData.appleMusicUrl) document.getElementById('f-apple').value = trackData.appleMusicUrl;
          return;
        }
      }
    }
    if(appleMatch && appleMatch[1] && !appleMatch[2]){
      const albumId = appleMatch[1];
      const albumResp = await fetch('https://itunes.apple.com/lookup?id=' + albumId + '&entity=album');
      if(albumResp.ok){
        const ad = await albumResp.json();
        const albumInfo = ad.results && ad.results.find(r=> r.wrapperType === 'collection');
        if(albumInfo){
          const trackResp = await fetch('https://itunes.apple.com/lookup?id=' + albumId + '&entity=song&limit=200');
          if(trackResp.ok){
            const td = await trackResp.json();
            const tracks = (td.results||[]).filter(r=> r.wrapperType === 'track' && r.collectionId == albumId).map((t,i)=>({ title:t.trackName, artists:[t.artistName], trackNumber:t.trackNumber, coverArt:t.artworkUrl100||null, appleMusicUrl:t.trackViewUrl||'' }));
            const albumName = albumInfo.collectionName || '';
            const albumArtist = albumInfo.artistName || '';
            const albumYear = albumInfo.releaseDate || '';
            const coverArt = albumInfo.artworkUrl100 ? albumInfo.artworkUrl100.replace('100x100','600x600') : null;
            const clusterId = uid();
            const now = Date.now();
            const allImported = tracks.map((t,i)=>({
              id: uid(), pinned:false, createdAt:now, clusterId, clusterName:albumName||'Album Import',
              title:t.title, artists:(t.artists&&t.artists.length)?t.artists:[albumArtist], album:albumName,
              genres:[], why:'', credit:'', coverArt:t.coverArt||coverArt, tier:null, remindsOf:[], year:albumYear||null,
              trackNumber:t.trackNumber||(i+1), appleMusicUrl:t.appleMusicUrl||'',
              releaseDate:albumYear||null,
            }));
            const dupes = findDuplicates(allImported);
            const dupeKeys = new Set(dupes.map(d=>songKey(d)));
            const newSongs = allImported.filter(s=>!dupeKeys.has(songKey(s)));
            dupes.forEach(d=>{ const ex=songs.find(s=>songKey(s)===songKey(d)); if(ex && !ex.coverArt && d.coverArt) ex.coverArt=d.coverArt; });
            songs = [...newSongs, ...songs];
            save();
            upsertGlobalSongBatch(newSongs, currentUserId);
            syncToSongDbBatch(newSongs, currentUserId);
            document.getElementById('spotifyImportOverlay').classList.remove('open');
            render();
            enrichImportedSongs(clusterId, 'Apple Music');
            if(dupes.length>0) showToast('Imported '+newSongs.length+' songs. Skipped '+dupes.length+' duplicates.');
            else showToast('Imported '+newSongs.length+' songs from "'+albumName+'".');
            return;
          }
        }
      }
    }
    if(isTidalTrack){
      const trackId = url.match(/tidal\.com\/(?:browse\/)?track\/(\d+)/)[1];
      try{
        const token = await getTidalToken();
        const resp = await fetch('https://openapi.tidal.com/v2/tracks?filter[id]='+trackId+'&include=artists,albums&countryCode=US', {
          headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/vnd.tidal.v2+json' }
        });
        if(resp.ok){
          const d = await resp.json();
          const artistMap = {};
          const albumMap = {};
          if(d.included){
            for(const inc of d.included){
              if(inc.type === 'artists' && inc.id) artistMap[inc.id] = inc.attributes && inc.attributes.name;
              if(inc.type === 'albums' && inc.id) albumMap[inc.id] = inc.attributes || {};
            }
          }
          if(d.data && d.data[0]){
            const t = d.data[0];
            const attrs = t.attributes || {};
            const artists = (t.relationships && t.relationships.artists && t.relationships.artists.data || [])
              .map(a => artistMap[a.id]).filter(Boolean);
            const albumRel = t.relationships && t.relationships.albums && t.relationships.albums.data;
            const albumAttr = (albumRel && albumRel[0] && albumMap[albumRel[0].id]) || {};
            const albumName = albumAttr.title || '';
            const year = albumAttr.releaseDate ? albumAttr.releaseDate.substring(0,4) : '';
            const coverArt = albumAttr.cover ? 'https://resources.tidal.com/images/'+albumAttr.cover.replace('/','-')+'/640x640.jpg' : null;
            const trackData = { title:attrs.title||'', artists:artists.length?artists:[], album:albumName, year, releaseDate:albumAttr.releaseDate||'', coverArt, tidalUrl:url, explicit:!!attrs.explicit };
            document.getElementById('spotifyImportOverlay').classList.remove('open');
            openAddFromData(trackData);
            if(trackData.tidalUrl) document.getElementById('f-tidal').value = trackData.tidalUrl;
            return;
          }
        } else {
          console.error('Tidal track API', resp.status, await resp.text().catch(()=>{}));
        }
      }catch(e){ console.error('Tidal track lookup error:', e); }
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      openAddFromData({ title:'', artists:[], tidalUrl:url });
      document.getElementById('f-tidal').value = url;
      return;
    }
    if(isTidalAlbum){
      const albumId = url.match(/tidal\.com\/(?:browse\/)?album\/(\d+)/)[1];
      try{
        const token = await getTidalToken();
        const resp = await fetch('https://openapi.tidal.com/v2/albums?filter[id]='+albumId+'&include=artists&countryCode=US', {
          headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/vnd.tidal.v2+json' }
        });
        if(resp.ok){
          const d = await resp.json();
          const artistMap = {};
          if(d.included){
            for(const inc of d.included){
              if(inc.type === 'artists' && inc.id) artistMap[inc.id] = inc.attributes && inc.attributes.name;
            }
          }
          if(d.data && d.data[0]){
            const a = d.data[0];
            const attrs = a.attributes || {};
            const albumArtists = (a.relationships && a.relationships.artists && a.relationships.artists.data || [])
              .map(x => artistMap[x.id]).filter(Boolean);
            const coverArt = attrs.cover ? 'https://resources.tidal.com/images/'+attrs.cover.replace('/','-')+'/640x640.jpg' : null;
            const albumName = attrs.title || '';
            const albumYear = attrs.releaseDate ? attrs.releaseDate.substring(0,4) : '';
            const trResp = await fetch('https://openapi.tidal.com/v2/albums/'+albumId+'/tracks?countryCode=US&limit=300', {
              headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/vnd.tidal.v2+json' }
            });
            let tracks = [];
            if(trResp && trResp.ok){
              const td = await trResp.json();
              const items = td.items || td.data || [];
              tracks = items.map((t,i)=>{
                const trAttrs = t.attributes || {};
                return { title:trAttrs.title||'', trackNumber:trAttrs.trackNumber||(i+1) };
              });
            }
            const clusterId = uid();
            const now = Date.now();
            const allImported = tracks.map((t,i)=>({
              id: uid(), pinned:false, createdAt:now, clusterId, clusterName:albumName||'Album Import',
              title:t.title, artists:albumArtists.length?albumArtists:[], album:albumName,
              genres:[], why:'', credit:'', coverArt, tier:null, remindsOf:[], year:albumYear||null,
              trackNumber:t.trackNumber||(i+1), tidalUrl:url,
              releaseDate:attrs.releaseDate||null,
            }));
            const dupes = findDuplicates(allImported);
            const dupeKeys = new Set(dupes.map(d=>songKey(d)));
            const newSongs = allImported.filter(s=>!dupeKeys.has(songKey(s)));
            dupes.forEach(d=>{ const ex=songs.find(s=>songKey(s)===songKey(d)); if(ex && !ex.coverArt && d.coverArt) ex.coverArt=d.coverArt; });
            songs = [...newSongs, ...songs];
            save();
            upsertGlobalSongBatch(newSongs, currentUserId);
            syncToSongDbBatch(newSongs, currentUserId);
            document.getElementById('spotifyImportOverlay').classList.remove('open');
            render();
            enrichImportedSongs(clusterId, 'Tidal');
            if(dupes.length>0) showToast('Imported '+newSongs.length+' songs. Skipped '+dupes.length+' duplicates.');
            else showToast('Imported '+newSongs.length+' songs from "'+albumName+'".');
            return;
          }
        }
      }catch(e){}
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      openAddFromData({ title:'', artists:[], tidalUrl:url });
      document.getElementById('f-tidal').value = url;
      return;
    }
    if(ytMatch){
      const videoId = ytMatch[1] || ytMatch[2];
      let title = '';
      try{
        const resp = await fetch('https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v='+videoId+'&format=json');
        if(resp.ok){ const d = await resp.json(); title = d.title || ''; }
      }catch(e){}
      const trackData = { title:title, artists:[], youtubeMusicUrl:url };
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      openAddFromData(trackData);
      document.getElementById('f-youtube').value = url;
      return;
    }
    if(detectPlaylistService(url)){
      await loadPlaylist(url);
      return;
    }
    errEl.style.display = 'block';
    errEl.innerHTML = '<p class="profile-empty-note">Could not look up this URL. Please check the link and try again.</p>';
  }catch(e){
    errEl.style.display = 'block';
    errEl.innerHTML = '<p class="profile-empty-note">' + escapeHtml(e.message||'Could not look up this URL.') + '</p>';
  }
}

function parseSpotifyPlaylistId(url){
  const m = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

async function fetchViaProxy(url){
  const proxies = [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
  ];
  for(const proxy of proxies){
    try{
      const resp = await fetch(proxy(url), { redirect:'follow' });
      if(resp.ok){
        const text = await resp.text();
        if(text && text.length > 50) return text;
      }
    }catch(e){ }
  }
  throw new Error('Could not fetch the playlist page. The proxy services may be down — try again in a moment.');
}

function detectPlaylistService(url){
  if(/spotify\.com\/playlist\//.test(url)) return 'spotify';
  if(/music\.apple\.com\/.*\/playlist\//.test(url)) return 'apple';
  if(/tidal\.com\/(browse\/)?playlist\//.test(url)) return 'tidal';
  if(/music\.youtube\.com\/playlist|youtube\.com\/playlist/.test(url)) return 'youtube';
  return null;
}

async function loadAppleMusicPlaylist(url){
  const html = await fetchViaProxy(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
  let tracks = [];
  let playlistName = 'Apple Music Playlist';
  let coverArt = null;
  for(const script of ldScripts){
    try{
      const data = JSON.parse(script.textContent);
      const candidates = Array.isArray(data) ? data : [data];
      for(const d of candidates){
        if(d && d['@type'] === 'MusicPlaylist' && d.track){
          playlistName = d.name || playlistName;
          if(d.image) coverArt = typeof d.image === 'string' ? d.image : (d.image && d.image.url) || null;
          const trackList = Array.isArray(d.track) ? d.track : [d.track];
          for(const t of trackList){
            if(!t || !t.name) continue;
            const artists = t.byArtist
              ? (Array.isArray(t.byArtist) ? t.byArtist : [t.byArtist]).map(a=>a.name).filter(Boolean)
              : [];
            const album = (t.inAlbum && t.inAlbum.name) || '';
            const trackCover = (t.inAlbum && t.inAlbum.image) || t.image || coverArt;
            tracks.push({ title:t.name, artists, album, coverArt:trackCover, durationMs:0 });
          }
        }
      }
    }catch(e){ }
  }
  if(tracks.length === 0) throw new Error('Could not parse tracks from the Apple Music page. The playlist may be private.');
  return { name:playlistName, tracks, coverArt };
}

const TIDAL_CLIENT_ID = '7n9d7FqPupVD9l9D';
const TIDAL_CLIENT_SECRET = 'TliyHzIbneRdGgOtzolIRQ7es1N8oI1wOltRInu5xZs=';
let tidalToken = null;
let tidalTokenExpiry = 0;

async function getTidalToken(){
  if(tidalToken && Date.now() < tidalTokenExpiry) return tidalToken;
  const body = new URLSearchParams({
    client_id: TIDAL_CLIENT_ID,
    client_secret: TIDAL_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const resp = await fetch('https://auth.tidal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if(!resp.ok) throw new Error('Failed to authenticate with Tidal API');
  const data = await resp.json();
  tidalToken = data.access_token;
  tidalTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return tidalToken;
}

async function loadTidalPlaylist(url){
  const playlistId = (url.match(/playlist\/([a-f0-9-]+)/i) || [])[1];
  if(!playlistId) throw new Error('Invalid Tidal playlist URL');
  const token = await getTidalToken();
  const authHeaders = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/vnd.api+json',
    'Accept': 'application/vnd.api+json',
  };

  const listEl = document.getElementById('spotifyTrackList');

  const plResp = await fetch(
    `https://openapi.tidal.com/v2/playlists?filter[id]=${playlistId}&countryCode=US`,
    { headers: authHeaders }
  );
  if(!plResp.ok) throw new Error('Could not find this Tidal playlist. Check the URL and make sure it is public.');
  const plData = await plResp.json();
  const plInfo = plData.data && plData.data[0];
  const playlistName = (plInfo && plInfo.attributes && plInfo.attributes.name) || 'Tidal Playlist';
  const totalItems = (plInfo && plInfo.attributes && plInfo.attributes.numberOfItems) || 0;
  if(totalItems === 0) throw new Error('This Tidal playlist is empty.');

  const totalPages = Math.ceil(totalItems / 20);
  const totalApiCalls = totalPages * 2;
  const initialEtaSec = totalApiCalls * 2;
  const initialEtaStr = fmtTime(initialEtaSec);
  if(listEl) listEl.innerHTML = `<p class="profile-empty-note">Loading ${totalItems} tracks from Tidal… ~${fmtTime(totalPages * 2)} estimated</p><div style="font-size:11px;opacity:0.6;padding:4px 0;font-family:IBM Plex Mono,monospace;">Total import time: ~${initialEtaStr}</div>`;

  const tidalStartTime = Date.now();
  const tidalProgressHtml = (main, extra)=>{
    return `<p class="profile-empty-note">${main}</p><div style="font-size:11px;opacity:0.6;padding:4px 0;font-family:IBM Plex Mono,monospace;">${extra}</div>`;
  };

  const tidalFetch = async (fetchUrl) => {
    let delay = 2000;
    for(let attempt = 0; attempt < 10; attempt++){
      try{
        const resp = await fetch(fetchUrl, { headers: authHeaders });
        if(resp.ok){ delay = Math.max(1500, delay - 200); return resp; }
        if(resp.status === 429){
          const retryAfter = parseInt(resp.headers.get('retry-after') || '5');
          const elapsed = (Date.now() - tidalStartTime) / 1000;
          const pagesDone = page || 0;
          const pagesRemaining = totalPages - pagesDone + 1;
          const totalRemaining = (pagesRemaining + totalPages) * 2 + retryAfter;
          if(listEl) listEl.innerHTML = tidalProgressHtml(`Rate limited — waiting ${retryAfter}s…`, `Total import time: ~${fmtTime(Math.round(elapsed + totalRemaining))}`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          delay = Math.min(5000, delay + 1000);
          continue;
        }
        return resp;
      }catch(e){
        if(attempt < 9){ await new Promise(r => setTimeout(r, delay)); continue; }
        throw e;
      }
    }
  };

  const trackIds = [];
  let nextUrl = `https://openapi.tidal.com/v2/playlists/${playlistId}/relationships/items?countryCode=US&limit=20`;
  let page = 0;
  while(nextUrl){
    page++;
    const resp = await tidalFetch(nextUrl);
    if(!resp || !resp.ok) break;
    const data = await resp.json();
    if(data.data){
      for(const item of data.data){
        if(item.type === 'tracks' && item.id) trackIds.push(item.id);
      }
    }
    if(listEl){
      const elapsed = (Date.now() - tidalStartTime) / 1000;
      const rate = page > 0 ? elapsed / page : 2;
      const remainingPages = totalPages - page;
      const etaSec = Math.round(remainingPages * rate);
      const totalRemaining = (remainingPages + totalPages) * 2;
      const totalEta = fmtTime(Math.round(elapsed + totalRemaining));
      listEl.innerHTML = tidalProgressHtml(
        `Loading tracks from Tidal… ${trackIds.length}/${totalItems} · ~${fmtTime(etaSec)} remaining (${fmtTime(Math.round(elapsed))} elapsed)`,
        `Total import time: ~${totalEta}`
      );
    }
    if(data.links && data.links.next){
      const nextPath = data.links.next;
      nextUrl = nextPath.startsWith('http') ? nextPath : 'https://openapi.tidal.com/v2' + nextPath;
    } else {
      nextUrl = null;
    }
  }

  if(trackIds.length === 0) throw new Error('No tracks found in this Tidal playlist.');
  const detailTotalBatches = Math.ceil(trackIds.length / 20);
  const detailStartTime = Date.now();
  if(listEl) listEl.innerHTML = `<p class="profile-empty-note">Fetching track details… 0/${trackIds.length}</p>`;

  const tracks = [];
  for(let i = 0; i < trackIds.length; i += 20){
    const batch = trackIds.slice(i, i + 20);
    const batchResp = await tidalFetch(
      `https://openapi.tidal.com/v2/tracks?filter[id]=${batch.join(',')}&include=artists,albums&countryCode=US`
    );
    if(!batchResp || !batchResp.ok) continue;
    const batchData = await batchResp.json();
    const artistMap = {};
    const albumMap = {};
    if(batchData.included){
      for(const inc of batchData.included){
        if(inc.type === 'artists' && inc.id) artistMap[inc.id] = inc.attributes && inc.attributes.name;
        if(inc.type === 'albums' && inc.id) albumMap[inc.id] = inc.attributes || {};
      }
    }
    if(batchData.data){
      for(const t of batchData.data){
        const attrs = t.attributes || {};
        const artists = (t.relationships && t.relationships.artists && t.relationships.artists.data || [])
          .map(a => artistMap[a.id]).filter(Boolean);
        const albumRel = t.relationships && t.relationships.albums && t.relationships.albums.data;
        const albumAttr = (albumRel && albumRel[0] && albumMap[albumRel[0].id]) || {};
        const album = albumAttr.title || '';
        const year = albumAttr.releaseDate ? parseInt(albumAttr.releaseDate.slice(0,4), 10) : null;
        const durationStr = attrs.duration || '';
        let durationMs = 0;
        const durMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if(durMatch){
          durationMs = ((parseInt(durMatch[1]||0)*3600) + (parseInt(durMatch[2]||0)*60) + parseInt(durMatch[3]||0)) * 1000;
        }
        tracks.push({
          title: attrs.title || 'Unknown',
          artists: artists.length ? artists : ['Unknown Artist'],
          album,
          coverArt: null,
          durationMs,
          year: year || null,
        });
      }
    }
    if(listEl){
      const batchesDone = Math.ceil(tracks.length / 20);
      const elapsed = (Date.now() - detailStartTime) / 1000;
      const rate = batchesDone > 0 ? elapsed / batchesDone : 2;
      const remainingBatches = detailTotalBatches - batchesDone;
      const etaSec = Math.round(remainingBatches * rate);
      const totalElapsed = (Date.now() - tidalStartTime) / 1000;
      const totalRemaining = remainingBatches * 2;
      listEl.innerHTML = tidalProgressHtml(
        `Fetching track details… ${tracks.length}/${trackIds.length} · ~${fmtTime(etaSec)} remaining (${fmtTime(Math.round(elapsed))} elapsed)`,
        `Total import time: ~${fmtTime(Math.round(totalElapsed + totalRemaining))}`
      );
    }
  }

  if(tracks.length === 0) throw new Error('Could not load track details from Tidal.');
  return { name:playlistName, tracks, coverArt:null };
}

function parseYouTubePlaylistId(url){
  const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function loadYouTubePlaylist(url){
  throw new Error('Sorry, we don\'t support YouTube Music playlist imports yet.');
}

async function loadPlaylist(url){
  const errEl = document.getElementById('spotifyImportError');
  const resultsEl = document.getElementById('spotifyImportResults');
  const confirmBtn = document.getElementById('spotifyImportConfirmBtn');
  const listEl = document.getElementById('spotifyTrackList');
  const infoEl = document.getElementById('spotifyPlaylistInfo');
  errEl.style.display = 'none';
  errEl.innerHTML = '';
  resultsEl.style.display = 'none';
  confirmBtn.disabled = true;
  playlistImportedTracks = [];
  playlistImportLoadedUrl = null;

  const service = detectPlaylistService(url);
  if(!service){
    errEl.style.display = 'block';
    errEl.innerHTML = '<p class="profile-empty-note">Please paste a Spotify, Apple Music, or Tidal playlist URL.</p>';
    return;
  }

  playlistImportService = service;
  playlistImportUrl = url;
  playlistImportInProgress = true;
  document.getElementById('spotifyImportStopBtn').style.display = '';
  document.getElementById('spotifyImportPauseBtn').style.display = '';
  document.getElementById('spotifyImportPauseBtn').textContent = 'Pause';
  const serviceLabel = service === 'spotify' ? 'Spotify' : service === 'apple' ? 'Apple Music' : service === 'youtube' ? 'YouTube Music' : 'Tidal';
  listEl.innerHTML = `<p class="profile-empty-note">Connecting to ${serviceLabel}…</p>`;
  resultsEl.style.display = 'block';
  const oldStatus = document.getElementById('plEnrichStatus');
  if(oldStatus) oldStatus.remove();

  try{
    let playlistName, tracks, coverArt;

    if(service === 'spotify'){
      const token = await fetchSpotifyToken();
      const playlistId = parseSpotifyPlaylistId(url);
      if(!playlistId) throw new Error('Invalid Spotify playlist URL');
      const plResp = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}?fields=name,images,tracks(total)`, {
        headers:{ Authorization:`Bearer ${token}` }
      });
      if(!plResp.ok) throw new Error('Playlist not found or is private');
      const plData = await plResp.json();
      coverArt = plData.images && plData.images.length ? plData.images[0].url : null;
      playlistName = plData.name || 'Spotify Playlist';
      tracks = [];
      let offset = 0;
      while(true){
        const tr = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(name,artists(name),album(name),preview_url,duration_ms))&limit=100&offset=${offset}`, {
          headers:{ Authorization:`Bearer ${token}` }
        });
        if(!tr.ok) break;
        const trData = await tr.json();
        const batch = (trData.items||[]).map(i=>i.track).filter(Boolean);
        if(batch.length === 0) break;
        batch.forEach(t=>{
          tracks.push({
            title: t.name,
            artists: (t.artists||[]).map(a=>a.name),
            album: t.album ? t.album.name : '',
            durationMs: t.duration_ms || 0,
            coverArt: coverArt
          });
        });
        if(batch.length < 100) break;
        offset += 100;
      }
    } else if(service === 'apple'){
      const result = await loadAppleMusicPlaylist(url);
      playlistName = result.name; tracks = result.tracks; coverArt = result.coverArt;
    } else if(service === 'tidal'){
      const result = await loadTidalPlaylist(url);
      playlistName = result.name; tracks = result.tracks; coverArt = result.coverArt;
    } else if(service === 'youtube'){
      const result = await loadYouTubePlaylist(url);
      playlistName = result.name; tracks = result.tracks; coverArt = result.coverArt;
    }

    if(!tracks || !tracks.length){
      listEl.innerHTML = '<p class="profile-empty-note">No tracks found in this playlist.</p>';
      document.getElementById('spotifyImportStopBtn').style.display = 'none';
      document.getElementById('spotifyImportPauseBtn').style.display = 'none';
      return;
    }

    playlistImportedTracks = tracks;
    playlistImportLoadedUrl = url;
    playlistImportInProgress = true;
    stopImportProgressTimer();
    document.getElementById('spotifyImportStopBtn').style.display = 'none';
    document.getElementById('spotifyImportPauseBtn').style.display = 'none';
    const serviceLabel = service === 'spotify' ? 'Spotify' : service === 'apple' ? 'Apple Music' : service === 'youtube' ? 'YouTube Music' : 'Tidal';
    infoEl.innerHTML = `
      ${coverArt ? `<img loading="lazy" decoding="async" src="${escapeAttr(coverArt)}" style="width:48px;height:48px;border-radius:6px;object-fit:cover;" alt="Album cover">` : ''}
      <div>
        <div style="font-weight:700; font-size:15px;">${escapeHtml(playlistName)}</div>
        <div style="font-size:12px; opacity:0.7;">${tracks.length} tracks · ${serviceLabel}</div>
      </div>`;
    renderPlaylistTrackList(listEl, tracks);
    document.getElementById('importModalTitle').textContent = playlistName;
    playlistImportName = playlistName;
    confirmBtn.disabled = false;
    document.getElementById('spotifyImportCancelBtn').textContent = 'Cancel';
    playlistImportInProgress = false;
    stopImportProgressTimer();
  }catch(e){
    playlistImportInProgress = false;
    stopImportProgressTimer();
    document.getElementById('spotifyImportStopBtn').style.display = 'none';
    document.getElementById('spotifyImportPauseBtn').style.display = 'none';
    listEl.innerHTML = '';
    errEl.style.display = 'block';
    errEl.innerHTML = `<p class="profile-empty-note">${escapeHtml(e.message || 'Could not load this playlist.')}</p>`;
  }
}

function renderPlaylistTrackList(listEl, tracks){
  const max = Math.min(tracks.length, 200);
  let html = '';
  for(let i = 0; i < max; i++){
    const t = tracks[i];
    html += `<div class="discover-row" style="cursor:default;" data-pl-idx="${i}">
      ${t.coverArt
        ? `<img loading="lazy" decoding="async" src="${escapeAttr(t.coverArt)}" style="width:36px;height:36px;border-radius:5px;object-fit:cover;flex-shrink:0;" alt="Album cover">`
        : `<span class="drow-fallback" style="font-size:11px;">${i+1}</span>`}
      <span style="flex:1;">
        <span class="drow-name">${escapeHtml(t.title)}</span><br>
        <span class="drow-bio">${escapeHtml((t.artists||[]).join(', '))}${t.album ? ' · ' + escapeHtml(t.album) : ''}</span>
      </span>
    </div>`;
  }
  if(tracks.length > max){
    html += `<p class="profile-empty-note" style="text-align:center;padding:8px;">Showing first ${max} of ${tracks.length} tracks. Scroll the list or import to add all.</p>`;
  }
  listEl.innerHTML = html;
}

async function enrichTracksFromItunes(tracks, listEl, statusEl){
  const startTime = Date.now();
  const BATCH_SIZE = 3;
  const BATCH_DELAY = 600;
  const totalBatches = Math.ceil(tracks.length / BATCH_SIZE);
  const initialEtaSec = Math.round(totalBatches * (BATCH_DELAY / 1000) + totalBatches * 0.3);
  const initialEtaStr = fmtTime(initialEtaSec);
  if(statusEl) statusEl.textContent = `Fetching artwork… 0/${tracks.length} · ~${initialEtaStr} estimated`;
  importProgressState = { active: true, label: 'Fetching artwork…', done: 0, total: tracks.length, startTime, statusEl };
  startImportProgressTimer();
  for(let batchNum = 0; batchNum < totalBatches; batchNum++){
    while(importProgressState && importProgressState.paused){ await new Promise(r=>setTimeout(r, 200)); }
    const i = batchNum * BATCH_SIZE;
    const batch = [];
    for(let j = 0; j < BATCH_SIZE && i + j < tracks.length; j++){
      const idx = i + j;
      const t = tracks[idx];
      batch.push((async ()=>{
        const term = t.title + ' ' + (t.artists[0] || '');
        try{
          const dzHits = await deezerSearch(term, 1);
          if(dzHits && dzHits.length){
            const dz = dzHits[0];
            if(dz.artworkUrl100) t.coverArt = dz.artworkUrl100;
            if(dz.collectionName && !t.album) t.album = dz.collectionName;
            if(dz.primaryGenreName) t.genres = [dz.primaryGenreName];
          } else {
            const hits = await itunesSearch(term, 'song', 1);
            if(hits && hits.length){
              const hit = hits[0];
              if(hit.artworkUrl100) t.coverArt = hit.artworkUrl100.replace('100x100', '150x150');
              if(hit.collectionName && !t.album) t.album = hit.collectionName;
              if(hit.primaryGenreName) t.genres = [hit.primaryGenreName];
            }
          }
        }catch(e){ }
        return idx;
      })());
    }
    const indices = await Promise.all(batch);
    const done = Math.min(i + BATCH_SIZE, tracks.length);
    if(statusEl){
      const batchesDone = batchNum + 1;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = batchesDone > 0 ? elapsed / batchesDone : 1;
      const remainingBatches = totalBatches - batchesDone;
      const etaSec = Math.round(remainingBatches * rate);
      const etaStr = fmtTime(etaSec);
      const elapsedStr = fmtTime(elapsed);
      statusEl.textContent = `Fetching artwork from iTunes… ${done}/${tracks.length} · ~${etaStr} remaining (${elapsedStr} elapsed)`;
    }
    if(importProgressState) importProgressState.done = done;
    if(listEl && done <= 200){
      for(const idx of indices){
        if(idx >= 200) break;
        const t = tracks[idx];
        if(t.coverArt){
          const row = listEl.querySelector(`[data-pl-idx="${idx}"]`);
          if(row){
            row.outerHTML = `<div class="discover-row" style="cursor:default;" data-pl-idx="${idx}">
              <img loading="lazy" decoding="async" src="${escapeAttr(t.coverArt)}" style="width:36px;height:36px;border-radius:5px;object-fit:cover;flex-shrink:0;" alt="Album cover">
              <span style="flex:1;">
                <span class="drow-name">${escapeHtml(t.title)}</span><br>
                <span class="drow-bio">${escapeHtml((t.artists||[]).join(', '))}${t.album ? ' · ' + escapeHtml(t.album) : ''}</span>
              </span>
            </div>`;
          }
        }
      }
    }
    await new Promise(r=>setTimeout(r, BATCH_DELAY));
    if(batchNum % 10 === 9) await new Promise(r=>setTimeout(r));
  }
  if(statusEl){
    statusEl.textContent = `Done! All ${tracks.length} tracks enriched.`;
    setTimeout(()=>{ if(statusEl) statusEl.remove(); }, 3000);
  }
}

let enrichClusterAbort = null;
let enrichGlobalAbort = null;
function enrichImportedSongs(clusterId, serviceLabel){
  if(enrichClusterAbort) enrichClusterAbort.aborted = true;
  const abort = { aborted: false };
  enrichClusterAbort = abort;
  const toEnrich = songs.filter(s => s.clusterId === clusterId && !s.coverArt);
  enrichSongsFromSearch(toEnrich, abort, 50);
}
function enrichSongsFromSearch(toEnrich, abort, saveEvery){
  if(!toEnrich.length) return;
  let done = 0;
  const total = toEnrich.length;
  const failed = new Set();
  saveEvery = saveEvery || 50;
  async function enrichLoop(){
    for(let i = 0; i < toEnrich.length; i++){
      if(abort && abort.aborted) return;
      const s = toEnrich[i];
      if(failed.has(s.id)) continue;
      const now = Date.now();
      if(now < deezerCooldownUntil && now < itunesCooldownUntil){ failed.add(s.id); continue; }
      const term = (s.title || '').replace(/\//g, ' ') + ' ' + (s.artists[0] || '');
      try{
        let gotArt = false;
        if(now > deezerCooldownUntil){
          const dzHits = await deezerSearch(term, 1);
          if(dzHits && dzHits.length){
            const dz = dzHits[0];
            if(dz.artworkUrl100){ s.coverArt = dz.artworkUrl100; gotArt = true; }
            if(dz.collectionName && !s.album) s.album = dz.collectionName;
            if(dz.primaryGenreName && (!s.genres || s.genres.length === 0)) s.genres = [dz.primaryGenreName];
          }
        }
        if(!gotArt && Date.now() > itunesCooldownUntil){
          const hits = await itunesSearch(term, 'song', 1);
          if(hits && hits.length){
            const hit = hits[0];
            if(hit.artworkUrl100) s.coverArt = hit.artworkUrl100.replace('100x100', '150x150');
            if(hit.collectionName && !s.album) s.album = hit.collectionName;
            if(hit.primaryGenreName && (!s.genres || s.genres.length === 0)) s.genres = [hit.primaryGenreName];
            if(hit.releaseDate && !s.year) s.year = parseInt(hit.releaseDate.slice(0,4), 10) || null;
          } else {
            failed.add(s.id);
          }
        } else if(!gotArt) {
          failed.add(s.id);
        }
      }catch(e){ failed.add(s.id); }
      done++;
      if(done % saveEvery === 0 || done === total){
        save();
        render();
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    save();
    render();
  }
  enrichLoop();
}
function enrichAllMissingArtwork(){
  if(enrichGlobalAbort) enrichGlobalAbort.aborted = true;
  const abort = { aborted: false };
  enrichGlobalAbort = abort;
  const toEnrich = songs.filter(s => !s.archived && !s.coverArt && s.title);
  if(toEnrich.length === 0) return;
  enrichSongsFromSearch(toEnrich, abort, 20);
}
document.addEventListener('visibilitychange', ()=>{
  if(!document.hidden && enrichGlobalAbort && enrichGlobalAbort.aborted){
    enrichAllMissingArtwork();
  }
});
let spotifyUrlDebounce = null;
document.getElementById('spotify-url-input').addEventListener('input', e=>{
  clearTimeout(spotifyUrlDebounce);
  const val = e.target.value.trim();
  if(!val){
    document.getElementById('spotifyImportResults').style.display = 'none';
    document.getElementById('spotifyImportError').style.display = 'none';
    document.getElementById('spotifyImportConfirmBtn').disabled = true;
    playlistImportedTracks = [];
    return;
  }
  if(playlistImportInProgress && val === playlistImportUrl){
    return;
  }
  spotifyUrlDebounce = setTimeout(()=>handleSingleUrl(val), 600);
});

document.getElementById('spotifyImportConfirmBtn').addEventListener('click', ()=>{
  if(playlistImportedTracks.length === 0) return;
  if(playlistImportInProgress){
    const proceed = confirm('This playlist is still loading artwork. Are you sure you want to import now? Some tracks may be missing artwork.');
    if(!proceed) return;
  }
  try{
    const serviceLabel = playlistImportService === 'spotify' ? 'Spotify' : playlistImportService === 'apple' ? 'Apple Music' : playlistImportService === 'youtube' ? 'YouTube Music' : 'Tidal';
    trackEvent('playlist_import', { service: playlistImportService, count: playlistImportedTracks.length });
    const clusterId = uid();
    const now = Date.now();
    const allImported = playlistImportedTracks.map(t=>({
      id: uid(),
      pinned: false,
      createdAt: now,
      clusterId,
      clusterName: playlistImportName || (serviceLabel + ' Import'),
      title: t.title,
      artists: t.artists || [],
      album: t.album || '',
      tags: [],
      genres: t.genres || [],
      why: '',
      credit: '',
      coverArt: t.coverArt || null,
      tier: null,
      remindsOf: [],
      year: t.year || null,
    }));
    const dupes = findDuplicates(allImported);
    const dupeKeys = new Set(dupes.map(d => songKey(d)));
    const newSongs = allImported.filter(s => !dupeKeys.has(songKey(s)));
    dupes.forEach(d => {
      const existing = songs.find(s => songKey(s) === songKey(d));
      if(existing && !existing.coverArt && d.coverArt){
        existing.coverArt = d.coverArt;
      }
    });
    const doImportSave = ()=>{
      songs = [...newSongs, ...songs];
      save();
    upsertGlobalSongBatch(newSongs, currentUserId);
    syncToSongDbBatch(newSongs, currentUserId);
      playlistImportedTracks = [];
      playlistImportInProgress = false;
      stopImportProgressTimer();
      document.getElementById('spotifyImportOverlay').classList.remove('open');
      render();
      if(document.getElementById('feedOverlay') && document.getElementById('feedOverlay').classList.contains('open')) loadFeed();
      enrichImportedSongs(clusterId, serviceLabel);
      if(dupes.length > 0){
        const importedCount = newSongs.length;
        const skippedList = dupes.slice(0, 5).map(d => `"${d.title}"`).join(', ');
        const moreText = dupes.length > 5 ? ` and ${dupes.length - 5} more` : '';
        showToast(`Imported ${importedCount} new song${importedCount === 1 ? '' : 's'}. Skipped ${dupes.length} already in your cataloguex: ${skippedList}${moreText}`);
      }
    };
    doImportSave();
  }catch(e){
    console.error('Import error:', e);
    const errEl = document.getElementById('spotifyImportError');
    if(errEl){ errEl.style.display = 'block'; errEl.innerHTML = `<p class="profile-empty-note">Import failed: ${escapeHtml(e.message)}</p>`; }
  }
});
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('overlay').addEventListener('click', e=>{
  if(e.target.id !== 'overlay') return;
  closeModal();
});
document.querySelectorAll('.overlay').forEach(ov=>{
  if(ov.id === 'overlay' || ov.id === 'termsGateOverlay' || ov.id === 'onboardingOverlay' || ov.id === 'spotifyImportOverlay') return;
  ov.addEventListener('click', e=>{
    if(e.target !== ov) return;
    ov.classList.remove('open');
  });
});
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('modalFavBtn').addEventListener('click', ()=>{
  currentFav = !currentFav;
  const btn = document.getElementById('modalFavBtn');
  btn.textContent = currentFav ? '♥' : '♡';
  btn.classList.toggle('on', currentFav);
});
document.getElementById('f-explicit-btn').addEventListener('click', ()=>{
  currentExplicit = !currentExplicit;
  const btn = document.getElementById('f-explicit-btn');
  const label = document.getElementById('f-explicit-label');
  btn.classList.toggle('on', currentExplicit);
  label.textContent = currentExplicit ? 'Explicit' : 'Not explicit';
});

function updateCamelotPreview(inputId, chipId){
  const chip = document.getElementById(chipId);
  if(!chip) return;
  const val = document.getElementById(inputId).value.trim();
  const cam = musicKeyToCamelot(val);
  if(cam){ chip.textContent = cam; chip.style.display = ''; }
  else { chip.style.display = 'none'; }
}
document.getElementById('f-key').addEventListener('input', ()=> updateCamelotPreview('f-key','f-key-camelot'));
document.getElementById('mf-key').addEventListener('input', ()=> updateCamelotPreview('mf-key','mf-key-camelot'));
