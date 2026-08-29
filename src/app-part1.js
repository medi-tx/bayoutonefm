
const SUPABASE_URL = 'https://aaqlnjdooeydtaihhdia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_90hp8v69T6JrZKTQnKDIEA_Ku0J7eh0';

const BTF_VERSION = '__BTF_VERSION__';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
  (function(){ const v = document.getElementById('btfVersion'); if(v) v.textContent = BTF_VERSION; })();
