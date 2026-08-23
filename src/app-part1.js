
const SUPABASE_URL = 'https://aaqlnjdooeydtaihhdia.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_90hp8v69T6JrZKTQnKDIEA_Ku0J7eh0';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
window.sb = sb;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
