Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'Spotify client credentials are not configured on the server.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const basic = btoa(`${clientId}:${clientSecret}`);
  const tokenResp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await tokenResp.json().catch(() => ({}));
  if (!tokenResp.ok) {
    return new Response(
      JSON.stringify({ error: data.error_description || data.error || 'Spotify authentication failed.' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  return new Response(
    JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in, token_type: data.token_type }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});