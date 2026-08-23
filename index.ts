// Supabase Edge Function: audd-proxy
//
// Purpose: let every bayoutonefm user use "Listen" (song identification) without
// signing up for their own AudD account. This function holds ONE AudD api_token as a
// server-side secret and forwards audio to AudD on the user's behalf, capped at a
// small number of identifications per user per day so the shared quota isn't burned
// by a handful of people.
//
// Deploy:
//   supabase functions deploy audd-proxy
//   supabase secrets set AUDD_API_TOKEN=your_audd_token_here
//
// Requires the SQL in audd_usage.sql to be run once (creates the rate-limit table).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AUDD_API_TOKEN = Deno.env.get("AUDD_API_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Free identifications per user per UTC day. Tune this to match your AudD plan's
// monthly quota divided across your active users (AudD's free tier is ~300/month
// as of writing — verify current limits at https://dashboard.audd.io/ before deploying).
const DAILY_LIMIT = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!AUDD_API_TOKEN) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Identify the caller from their Supabase auth token (this is what makes
  // per-user rate limiting possible; anonymous requests are rejected).
  const authHeader = req.headers.get("authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "not_signed_in" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Rate limit: one row per user per UTC day, incremented atomically via RPC.
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { data: usageCount, error: usageErr } = await admin.rpc(
    "increment_audd_usage",
    { p_user_id: userId, p_day: today, p_limit: DAILY_LIMIT },
  );
  if (usageErr) {
    console.error("usage rpc error", usageErr);
    return new Response(JSON.stringify({ error: "usage_check_failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // increment_audd_usage returns null/false when the caller is already over DAILY_LIMIT.
  if (!usageCount) {
    return new Response(JSON.stringify({ error: "rate_limited", limit: DAILY_LIMIT }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Forward the audio to AudD using our shared server-side token.
  const incomingForm = await req.formData();
  const audio = incomingForm.get("audio");
  if (!audio) {
    return new Response(JSON.stringify({ error: "missing_audio" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const auddForm = new FormData();
  auddForm.append("api_token", AUDD_API_TOKEN);
  auddForm.append("audio", audio as Blob, "clip.webm");
  auddForm.append("return", "apple_music,spotify");

  try {
    const auddRes = await fetch("https://api.audd.io/", {
      method: "POST",
      body: auddForm,
    });
    const data = await auddRes.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("audd fetch failed", e);
    return new Response(JSON.stringify({ error: "audd_unreachable" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
