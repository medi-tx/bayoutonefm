# AudD shared-listener proxy

This removes the "everyone needs their own AudD account" friction from the Listen
feature. The app now defaults to a free shared listener (a few identifies per day,
no signup) and only asks someone to paste their own token if they want unlimited use
or the shared quota runs out.

## What you need

1. One AudD API token for yourself, from https://dashboard.audd.io/ (same place users
   were being sent before). This becomes the shared server-side secret.
2. The Supabase CLI installed and logged in to your project.

## Deploy steps

```bash
# from your project root, with this folder's index.ts at supabase/functions/audd-proxy/index.ts
supabase functions deploy audd-proxy

supabase secrets set AUDD_API_TOKEN=your_audd_token_here
```

Then run `audd_usage.sql` once in the Supabase SQL editor (Dashboard → SQL Editor) to
create the rate-limit table and its increment function.

## Tuning the daily limit

`DAILY_LIMIT` in `index.ts` (currently 5) controls how many free identifies each user
gets per day. AudD's free tier is roughly 300 requests/month — divide that by your
expected active users and days per month to pick a sane number, then adjust and
redeploy (`supabase functions deploy audd-proxy`) as your user base grows. Bumping to
a paid AudD plan raises the ceiling if 5/day feels tight.

## How the client uses it

`index.html` already calls this function (`identifyViaSharedProxy`) whenever someone
hasn't saved a personal AudD token. If the function isn't deployed yet, Listen will
fail with a generic error until you deploy it — the "paste your own token" fallback
still works in the meantime, so nothing is broken while you set this up.
