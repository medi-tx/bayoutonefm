# DisKids

A **kid-friendly Discord-style chat app** with safety features baked in.

## Features

- **Servers & channels** - Create friendly "clubs" with text channels, just like Discord.
- **Real-time chat** - Messages appear instantly via WebSockets (Socket.io).
- **User accounts** - Nickname + password login, with colorful avatars.
- **Profanity filter** - Bad words are automatically masked (with leetspeak/bypass detection).
- **No phone numbers or emails** - Automatically detected and hidden from messages.
- **No private messages** - Only group channels; no DMs between kids.
- **Anti-spam** - Rate limiting stops flooding (max 5 messages / 5 seconds).
- **Parental PIN** - A grown-up's PIN is required to create accounts, servers, and channels.
- **Moderation log** - Filtered/flagged messages are logged for review.

## Tech stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express + Socket.io
- **Database:** SQLite via Node's built-in `node:sqlite` module (no native compilation needed)

> Requires Node.js 22.5+ (for the `node:sqlite` module). No build tools or Python required.

## Getting started

```bash
cd diskids
npm install
npm run dev
```

Then open **http://localhost:5173**.

> The app runs two dev servers: Vite (frontend, port 5173) and the API/WebSocket
> server (port 3001). Vite proxies API and socket traffic to the backend automatically.

## The parental PIN (important!)

Account and server creation is **gated behind a parental PIN** so a grown-up must
be involved. The default PIN is `0000` (clearly insecure - a warning is printed at
startup). **Before sharing this with kids, set a real PIN:**

```bash
# Windows (PowerShell)
$env:PARENTAL_PIN="your-secret-pin"; npm run dev

# macOS / Linux
PARENTAL_PIN="your-secret-pin" npm run dev
```

## Production build

```bash
npm run build      # builds the React app into dist/
npm start          # serves the built app + API on http://localhost:3001
```

## Default account

There is no pre-seeded account. The first user must **register** (with the parental PIN).
After that, log in with the nickname + password.

## Project structure

```
diskids/
  server.js          Express + Socket.io server (API + real-time chat)
  db.js              SQLite schema and data access (via node:sqlite)
  auth.js            Password hashing, parental PIN, validation
  safety.js          Profanity filter (leetspeak + bypass aware) + phone/email redaction
  words.js           Blocklist of profane words
  src/
    main.jsx         React entry point
    App.jsx          Auth gate (login vs chat)
    api.js           REST + Socket.io client helpers
    icons.js         Emoji constants (defined via code points, safe from transcoding)
    index.css        Kid-friendly theme
    components/
      AuthScreen.jsx      Login / register screen
      ChatApp.jsx         Main chat layout & state
      ServerBar.jsx       Server list (left rail)
      ChannelBar.jsx      Channel list
      MessageList.jsx     Message feed
      MessageInput.jsx    Composer
      Modal.jsx           Create server/channel dialogs
```

## Customizing

- **Blocked words:** edit `words.js` and restart the server.
- **Rate limits:** tweak `messageAllowed()` in `server.js`.
- **Emoji icons:** edit `src/icons.js` (uses `String.fromCodePoint(...)` so the
  source stays ASCII and won't be altered by tooling).
- **Theme/colors:** edit the CSS variables at the top of `src/index.css`.

---

Made with care for safe, friendly chatting.