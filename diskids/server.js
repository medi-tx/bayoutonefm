import express from 'express';
import session from 'express-session';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname as pathDirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { Server } from 'socket.io';

import * as db from './db.js';
import {
  hashPassword,
  verifyPassword,
  checkParentalPin,
  validUsername,
  validPassword,
  pickAvatarColor,
  usingDefaultPin,
} from './auth.js';
import { sanitize } from './safety.js';

const __dirname = pathDirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const DEFAULT_ICON = String.fromCodePoint(0x1f308); // rainbow

const app = express();
app.use(express.json());

const sessionMiddleware = session({
  name: 'diskids.sid',
  secret: process.env.SESSION_SECRET || 'diskids-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
});
app.use(sessionMiddleware);

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  req.user = db.getUserById(req.session.userId);
  if (!req.user) {
    delete req.session.userId;
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

// --------------- Auth routes ---------------
app.post('/api/register', (req, res) => {
  const { username, password, parentalPin } = req.body ?? {};
  if (!validUsername(username))
    return res.status(400).json({ error: 'Pick a name with 3-20 letters, numbers, or underscores (no bad words!).' });
  if (!validPassword(password))
    return res.status(400).json({ error: 'Password must be 6-72 characters.' });
  if (!checkParentalPin(parentalPin))
    return res.status(403).json({ error: 'Wrong parental PIN. Ask a grown-up for help!' });

  if (db.getUserByUsername(username))
    return res.status(409).json({ error: 'That name is already taken!' });

  const user = db.createUser(username, hashPassword(password), pickAvatarColor());
  req.session.userId = user.id;
  res.json({ user });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const row = db.getUserByUsername(username);
  if (!row || !verifyPassword(password, row.password_hash))
    return res.status(401).json({ error: 'Wrong name or password.' });
  req.session.userId = row.id;
  const user = db.getUserById(row.id);
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  delete req.session.userId;
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.getUserById(req.session.userId);
  res.json({ user: user ?? null });
});

// --------------- Server routes ---------------
app.get('/api/servers', requireAuth, (req, res) => {
  res.json({ servers: db.getServersForUser(req.user.id) });
});

app.post('/api/servers', requireAuth, (req, res) => {
  const { name, icon, parentalPin } = req.body ?? {};
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 24)
    return res.status(400).json({ error: 'Server name must be 2-24 characters.' });
  if (!checkParentalPin(parentalPin))
    return res.status(403).json({ error: 'Wrong parental PIN. Ask a grown-up for help!' });
  const safeIcon = (icon && typeof icon === 'string' && icon.length <= 8) ? icon : DEFAULT_ICON;
  const server = db.createServer(name.trim(), safeIcon, req.user.id);
  res.json({ server });
});

app.post('/api/servers/:id/join', requireAuth, (req, res) => {
  const server = db.getServerById(Number(req.params.id));
  if (!server) return res.status(404).json({ error: 'Server not found.' });
  db.joinServer(server.id, req.user.id);
  res.json({ server });
});

// --------------- Channel routes ---------------
app.get('/api/servers/:id/channels', requireAuth, (req, res) => {
  const server = db.getServerById(Number(req.params.id));
  if (!server) return res.status(404).json({ error: 'Server not found.' });
  res.json({ channels: db.getChannelsForServer(server.id) });
});

app.post('/api/servers/:id/channels', requireAuth, (req, res) => {
  const server = db.getServerById(Number(req.params.id));
  if (!server) return res.status(404).json({ error: 'Server not found.' });
  const { name, topic } = req.body ?? {};
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 24)
    return res.status(400).json({ error: 'Channel name must be 1-24 characters.' });
  const safeTopic = (topic && typeof topic === 'string') ? topic.slice(0, 80) : '';
  const channel = db.createChannel(server.id, name.trim().toLowerCase().replace(/\s+/g, '-'), safeTopic);
  res.json({ channel });
  // notify members a channel was added
  io.to(`server:${server.id}`).emit('channel_added', { serverId: server.id, channel });
});

// --------------- Message routes ---------------
app.get('/api/channels/:id/messages', requireAuth, (req, res) => {
  const channel = db.getChannelById(Number(req.params.id));
  if (!channel) return res.status(404).json({ error: 'Channel not found.' });
  res.json({ messages: db.getMessagesForChannel(channel.id) });
});

// --------------- Static + SPA fallback (production) ---------------
const distPath = join(__dirname, 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

// --------------- Socket.io (real-time chat) ---------------
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: true, credentials: true } });
io.engine.use(sessionMiddleware);

// Rate limiting: max 5 messages per 5s, min 350ms spacing.
const burstBuckets = new Map(); // socketId -> {first, count}
const lastMsgAt = new Map(); // socketId -> ts
function messageAllowed(socketId) {
  const now = Date.now();
  const last = lastMsgAt.get(socketId) ?? 0;
  if (now - last < 350) return false;
  lastMsgAt.set(socketId, now);
  let bucket = burstBuckets.get(socketId);
  if (!bucket || now - bucket.first > 5000) {
    bucket = { first: now, count: 1 };
    burstBuckets.set(socketId, bucket);
  } else {
    bucket.count++;
    if (bucket.count > 5) return false;
  }
  return true;
}

io.on('connection', (socket) => {
  const session = socket.request.session;
  if (!session?.userId) {
    socket.emit('auth_error', { error: 'Please log in first.' });
    socket.disconnect(true);
    return;
  }
  const user = db.getUserById(session.userId);
  if (!user) {
    socket.disconnect(true);
    return;
  }
  socket.data.user = user;

  socket.on('join_channel', ({ channelId } = {}) => {
    const channel = db.getChannelById(Number(channelId));
    if (!channel) return;
    for (const room of [...socket.rooms]) {
      if (room.startsWith('channel:')) socket.leave(room);
    }
    socket.join(`channel:${channel.id}`);
    socket.join(`server:${channel.server_id}`);
    socket.emit('joined_channel', { channelId: channel.id });
  });

  socket.on('message', ({ channelId, content } = {}) => {
    if (typeof content !== 'string' || content.trim().length === 0)
      return socket.emit('message_error', { error: 'Type something first!' });
    if (content.length > 500)
      return socket.emit('message_error', { error: 'Keep messages under 500 characters.' });

    if (!messageAllowed(socket.id))
      return socket.emit('rate_limited', { error: 'Slow down a moment!' });

    const channel = db.getChannelById(Number(channelId));
    if (!channel) return;

    const { cleaned, flagged, reasons } = sanitize(content.trim());
    const msg = db.addMessage(channel.id, user, cleaned, flagged, reasons.join(', '));
    const payload = {
      id: msg.id,
      channelId: msg.channel_id,
      userId: msg.user_id,
      username: msg.username,
      avatarColor: msg.avatar_color,
      content: msg.content,
      flagged: !!msg.flagged,
      reasons: msg.reasons,
      createdAt: msg.created_at,
    };
    io.to(`channel:${channel.id}`).emit('message', payload);
    if (flagged) db.logFlaggedMessage(msg);
  });

  socket.on('disconnect', () => {
    burstBuckets.delete(socket.id);
    lastMsgAt.delete(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`DisKids server running -> http://localhost:${PORT}`);
  if (usingDefaultPin()) {
    console.log('');
    console.log('  !! WARNING: using the DEFAULT parental PIN "0000". !!');
    console.log('  !! Set PARENTAL_PIN in your environment to something   !!');
    console.log('  !! only a grown-up knows before sharing this app.     !!');
    console.log('');
  }
});