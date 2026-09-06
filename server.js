// Signaling & Community Server for Aadan-Pradan
// 1. WebRTC Signaling: Relays small handshake messages between two browsers.
//    Never handles or inspects file content. Direct browser-to-browser P2P.
// 2. Community Wall: Stores, moderates, and broadcasts shared notes/snippets in real time.

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const CODE_TTL_MS = 10 * 60 * 1000; // unclaimed codes expire after 10 minutes
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

// In-memory rooms: code -> { host: ws|null, receiver: ws|null, createdAt }
const rooms = new Map();

// --- Rate Limiting for Community Wall ---
const rateLimits = new Map(); // ip -> { lastPostTime, countThisHour, hourResetTime }
const MIN_POST_INTERVAL_MS = 4000; // 4 seconds between posts
const MAX_POSTS_PER_HOUR = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  let record = rateLimits.get(ip);
  if (!record) {
    record = { lastPostTime: 0, countThisHour: 0, hourResetTime: now + 3600 * 1000 };
    rateLimits.set(ip, record);
  }

  if (now > record.hourResetTime) {
    record.countThisHour = 0;
    record.hourResetTime = now + 3600 * 1000;
  }

  if (now - record.lastPostTime < MIN_POST_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_POST_INTERVAL_MS - (now - record.lastPostTime)) / 1000);
    return { allowed: false, message: `Please wait ${waitSec}s before posting again.` };
  }

  if (record.countThisHour >= MAX_POSTS_PER_HOUR) {
    return { allowed: false, message: 'Hourly posting limit reached. Please try again later.' };
  }

  record.lastPostTime = now;
  record.countThisHour += 1;
  return { allowed: true };
}

// Clean up old rate limit entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimits.entries()) {
    if (now - record.lastPostTime > 3600 * 1000) {
      rateLimits.delete(ip);
    }
  }
}, 15 * 60 * 1000);

// --- Community Snippets Store ---
const DATA_DIR = path.join(__dirname, 'data');
const COMMUNITY_FILE = path.join(DATA_DIR, 'community.json');
const MAX_COMMUNITY_POSTS = 200;
const MAX_POST_LENGTH = 5000;
const MAX_AUTHOR_LENGTH = 30;

let communityPosts = [];

function loadCommunityPosts() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(COMMUNITY_FILE)) {
      const raw = fs.readFileSync(COMMUNITY_FILE, 'utf8');
      communityPosts = JSON.parse(raw);
    } else {
      // Seed with initial community welcome notes
      communityPosts = [
        {
          id: 'seed-1',
          author: 'Aadan-Pradan',
          text: 'Welcome to Aadan-Pradan! Direct browser-to-browser file sharing and community clipboard. Zero cloud storage — your transfers stay strictly between connected devices.',
          tag: 'Note',
          createdAt: Date.now() - 1000 * 60 * 45,
          reportCount: 0,
          hidden: false
        },
        {
          id: 'seed-2',
          author: 'DevTip',
          text: 'git config --global alias.undo "reset --soft HEAD~1"\n// Quick alias to undo your last local commit while keeping staged changes intact.',
          tag: 'Code',
          createdAt: Date.now() - 1000 * 60 * 20,
          reportCount: 0,
          hidden: false
        },
        {
          id: 'seed-3',
          author: 'WebRTC Hub',
          text: 'https://webrtc.org\nOfficial documentation and architectural overview for WebRTC real-time browser communication.',
          tag: 'Link',
          createdAt: Date.now() - 1000 * 60 * 5,
          reportCount: 0,
          hidden: false
        }
      ];
      saveCommunityPosts();
    }
  } catch (err) {
    console.error('Error loading community data, using in-memory store:', err.message);
    communityPosts = [];
  }
}

function saveCommunityPosts() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(COMMUNITY_FILE, JSON.stringify(communityPosts.slice(0, MAX_COMMUNITY_POSTS), null, 2), 'utf8');
  } catch (err) {
    console.error('Error persisting community posts:', err.message);
  }
}

loadCommunityPosts();

// Safe public projection (strips private deleteKey and hidden posts)
function toPublicPost(post) {
  return {
    id: post.id,
    author: post.author,
    text: post.text,
    tag: post.tag,
    createdAt: post.createdAt
  };
}

function getPublicPosts() {
  return communityPosts
    .filter(p => !p.hidden)
    .slice(0, MAX_COMMUNITY_POSTS)
    .map(toPublicPost);
}

function validateAndSanitizeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

function addCommunityPost({ author, text, tag }) {
  const cleanAuthor = String(author || 'Anonymous').trim().slice(0, MAX_AUTHOR_LENGTH) || 'Anonymous';
  let cleanText = String(text || '').trim();
  const validTags = ['Note', 'Code', 'Link', 'Message'];
  const cleanTag = validTags.includes(tag) ? tag : 'Note';

  if (!cleanText) return { error: 'Text content cannot be empty.' };
  if (cleanText.length > MAX_POST_LENGTH) {
    return { error: `Content exceeds maximum length of ${MAX_POST_LENGTH} characters.` };
  }

  // If Link tag, ensure valid HTTP/HTTPS url
  if (cleanTag === 'Link') {
    const firstLine = cleanText.split('\n')[0].trim();
    if (!validateAndSanitizeUrl(firstLine)) {
      const candidate = 'https://' + firstLine;
      if (!validateAndSanitizeUrl(candidate)) {
        return { error: 'Please enter a valid web URL starting with http:// or https://' };
      }
    }
  }

  const deleteKey = crypto.randomBytes(12).toString('hex');
  const newPost = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    author: cleanAuthor,
    text: cleanText,
    tag: cleanTag,
    deleteKey: deleteKey,
    reportCount: 0,
    hidden: false,
    createdAt: Date.now()
  };

  communityPosts.unshift(newPost);
  if (communityPosts.length > MAX_COMMUNITY_POSTS) {
    communityPosts = communityPosts.slice(0, MAX_COMMUNITY_POSTS);
  }
  saveCommunityPosts();

  return { post: newPost, deleteKey };
}

function deleteCommunityPost(id, deleteKey) {
  if (!id || !deleteKey) return false;
  const index = communityPosts.findIndex(p => p.id === id);
  if (index === -1) return false;

  const post = communityPosts[index];
  if (post.deleteKey && post.deleteKey === deleteKey) {
    communityPosts.splice(index, 1);
    saveCommunityPosts();
    return true;
  }
  return false;
}

function reportCommunityPost(id) {
  if (!id) return { success: false, error: 'Missing post ID' };
  const post = communityPosts.find(p => p.id === id);
  if (!post) return { success: false, error: 'Post not found' };

  post.reportCount = (post.reportCount || 0) + 1;
  let hidden = false;
  if (post.reportCount >= 3) {
    post.hidden = true;
    hidden = true;
  }
  saveCommunityPosts();
  return { success: true, hidden };
}

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 5 }, () =>
      CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(wss, msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    }
  });
}

function broadcastStats(wss) {
  broadcast(wss, {
    type: 'stats',
    onlineUsers: wss.clients.size,
    postCount: getPublicPosts().length
  });
}

function cleanupRoom(code) {
  rooms.delete(code);
}

// Periodically clear unclaimed/expired rooms
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.createdAt > CODE_TTL_MS && !(room.host && room.receiver)) {
      cleanupRoom(code);
    }
  }
}, 60 * 1000);

// --- Static file & REST API server ---
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp'
};

const server = http.createServer((req, res) => {
  // Enable CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- REST API ENDPOINTS ---
  if (pathname === '/api/community') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, posts: getPublicPosts() }));
    }

    if (req.method === 'POST') {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: rateCheck.message }));
      }

      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy(); // 1MB flood protection
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const result = addCommunityPost(parsed);
          if (result.error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: result.error }));
          }

          const publicPost = toPublicPost(result.post);

          // Broadcast to connected WebSocket clients
          broadcast(wss, { type: 'community-new', post: publicPost });
          broadcastStats(wss);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({
            success: true,
            post: publicPost,
            deleteKey: result.deleteKey
          }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/community/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id, deleteKey } = JSON.parse(body);
        const ok = deleteCommunityPost(id, deleteKey);
        if (ok) {
          broadcast(wss, { type: 'community-deleted', id });
          broadcastStats(wss);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true }));
        } else {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Unauthorized or post not found.' }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
      }
    });
    return;
  }

  if (pathname === '/api/community/report' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        const result = reportCommunityPost(id);
        if (result.success) {
          if (result.hidden) {
            broadcast(wss, { type: 'community-deleted', id });
            broadcastStats(wss);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, hidden: result.hidden }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: result.error }));
        }
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, error: 'Invalid request' }));
      }
    });
    return;
  }

  if (pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      onlineUsers: wss.clients.size,
      postCount: getPublicPosts().length
    }));
  }

  if (pathname === '/api/qr') {
    const text = parsedUrl.searchParams.get('text') || '';
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing text query parameter');
    }
    // High contrast clean QR SVG with light background padding
    QRCode.toString(text, {
      type: 'svg',
      margin: 1,
      width: 240,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
      .then(svg => {
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
        res.end(svg);
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('QR generation error');
      });
    return;
  }

  // --- Static Files ---
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, reqPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  ws.role = null;
  ws.code = null;
  ws.clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '127.0.0.1';

  // Send initial stats & community post list on connection
  send(ws, {
    type: 'stats',
    onlineUsers: wss.clients.size,
    postCount: getPublicPosts().length
  });

  // Broadcast updated count to all
  broadcastStats(wss);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      // Community: Fetch list
      case 'community-get': {
        send(ws, { type: 'community-list', posts: getPublicPosts() });
        break;
      }

      // Community: Create new post
      case 'community-post': {
        const rateCheck = checkRateLimit(ws.clientIp);
        if (!rateCheck.allowed) {
          send(ws, { type: 'error', message: rateCheck.message });
          return;
        }

        const result = addCommunityPost(msg);
        if (result.error) {
          send(ws, { type: 'error', message: result.error });
          return;
        }

        const publicPost = toPublicPost(result.post);
        // Reply to creator with deleteKey
        send(ws, {
          type: 'community-post-success',
          post: publicPost,
          deleteKey: result.deleteKey
        });

        // Broadcast to all
        broadcast(wss, { type: 'community-new', post: publicPost });
        broadcastStats(wss);
        break;
      }

      // Sender asks for a fresh code
      case 'create': {
        if (ws.code) {
          cleanupRoom(ws.code);
        }
        const code = generateCode();
        rooms.set(code, { host: ws, receiver: null, createdAt: Date.now() });
        ws.role = 'host';
        ws.code = code;
        send(ws, { type: 'created', code });
        break;
      }

      // Receiver tries to join with a code
      case 'join': {
        const code = (msg.code || '').toUpperCase().trim();
        const room = rooms.get(code);
        if (!room || !room.host) {
          send(ws, {
            type: 'error',
            message: 'Invalid or expired Call Sign. Please check the code and try again.'
          });
          return;
        }
        if (room.receiver) {
          send(ws, {
            type: 'error',
            message: 'This Call Sign is already in use by another receiver.'
          });
          return;
        }
        room.receiver = ws;
        ws.role = 'receiver';
        ws.code = code;
        send(ws, { type: 'joined', code });
        send(room.host, { type: 'peer-joined' }); // tells sender to start WebRTC offer
        break;
      }

      // Relay WebRTC signaling data (offer/answer/ICE candidates) to the other peer
      case 'signal': {
        const room = rooms.get(ws.code);
        if (!room) return;
        const target = ws.role === 'host' ? room.receiver : room.host;
        send(target, { type: 'signal', data: msg.data });
        break;
      }

      case 'cancel': {
        if (ws.code) {
          const room = rooms.get(ws.code);
          if (room) {
            const other = ws.role === 'host' ? room.receiver : room.host;
            send(other, { type: 'peer-left' });
            cleanupRoom(ws.code);
          }
          ws.role = null;
          ws.code = null;
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (ws.code) {
      const room = rooms.get(ws.code);
      if (room) {
        const other = ws.role === 'host' ? room.receiver : room.host;
        send(other, { type: 'peer-left' });
        cleanupRoom(ws.code);
      }
    }
    broadcastStats(wss);
  });
});

server.listen(PORT, () => {
  console.log(`Aadan-Pradan Signaling & Community Server listening on http://localhost:${PORT}`);
});
