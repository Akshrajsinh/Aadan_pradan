// Signaling & Community Server for P2P Share ("Direct Link")
// 1. WebRTC Signaling: Relays small handshake messages between two browsers.
//    Never handles or inspects file content.
// 2. Community Board: Stores and broadcasts shared notes/snippets in real time.

const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
const CODE_TTL_MS = 10 * 60 * 1000; // unclaimed codes expire after 10 minutes
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

// In-memory rooms: code -> { host: ws|null, receiver: ws|null, createdAt }
const rooms = new Map();

// --- Community Snippets Store ---
const DATA_DIR = path.join(__dirname, 'data');
const COMMUNITY_FILE = path.join(DATA_DIR, 'community.json');
const MAX_COMMUNITY_POSTS = 200;

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
          author: 'Alex (Creator)',
          text: 'Welcome to the P2P Community Board! Share code snippets, notes, terminal commands, or links here. Anyone can view and copy with 1 click.',
          tag: 'Note',
          createdAt: Date.now() - 1000 * 60 * 45
        },
        {
          id: 'seed-2',
          author: 'DevTip',
          text: 'git config --global alias.undo "reset --soft HEAD~1"\n// Quick command to undo your last local commit while keeping changes staged!',
          tag: 'Code',
          createdAt: Date.now() - 1000 * 60 * 20
        },
        {
          id: 'seed-3',
          author: 'Community Hub',
          text: 'Need to transfer heavy files directly peer-to-peer? Use the Transfer tab above. No file size limits and zero server storage!',
          tag: 'Message',
          createdAt: Date.now() - 1000 * 60 * 5
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

function addCommunityPost({ author, text, tag }) {
  const cleanAuthor = String(author || 'Anonymous').trim().slice(0, 40) || 'Anonymous';
  const cleanText = String(text || '').trim();
  const validTags = ['Note', 'Code', 'Link', 'Message'];
  const cleanTag = validTags.includes(tag) ? tag : 'Note';

  if (!cleanText) return null;

  const newPost = {
    id: 'post_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    author: cleanAuthor,
    text: cleanText.slice(0, 20000),
    tag: cleanTag,
    createdAt: Date.now()
  };

  communityPosts.unshift(newPost);
  if (communityPosts.length > MAX_COMMUNITY_POSTS) {
    communityPosts = communityPosts.slice(0, MAX_COMMUNITY_POSTS);
  }
  saveCommunityPosts();
  return newPost;
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
    postCount: communityPosts.length
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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- REST API ENDPOINTS ---
  if (pathname === '/api/community') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, posts: communityPosts }));
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy(); // 1MB flood protection
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const newPost = addCommunityPost(parsed);
          if (!newPost) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Text content cannot be empty' }));
          }
          // Broadcast to connected WebSocket clients
          broadcast(wss, { type: 'community-new', post: newPost });
          broadcastStats(wss);

          res.writeHead(201, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: true, post: newPost }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, error: 'Invalid JSON body' }));
        }
      });
      return;
    }
  }

  if (pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      onlineUsers: wss.clients.size,
      postCount: communityPosts.length
    }));
  }

  if (pathname === '/api/qr') {
    const text = parsedUrl.searchParams.get('text') || '';
    if (!text) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('Missing text query parameter');
    }
    QRCode.toString(text, { type: 'svg', margin: 2, width: 220 })
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

wss.on('connection', (ws) => {
  ws.role = null;
  ws.code = null;

  // Send initial stats & community post list on connection
  send(ws, {
    type: 'stats',
    onlineUsers: wss.clients.size,
    postCount: communityPosts.length
  });

  // Broadcast updated count to all
  broadcastStats(wss);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      // Community: Fetch list
      case 'community-get': {
        send(ws, { type: 'community-list', posts: communityPosts });
        break;
      }

      // Community: Create new post
      case 'community-post': {
        const newPost = addCommunityPost(msg);
        if (newPost) {
          broadcast(wss, { type: 'community-new', post: newPost });
          broadcastStats(wss);
        }
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
          send(ws, { type: 'error', message: 'Invalid or expired call sign.' });
          return;
        }
        if (room.receiver) {
          send(ws, { type: 'error', message: 'This call sign is already in use.' });
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
    // Update online count
    broadcastStats(wss);
  });
});

server.listen(PORT, () => {
  console.log(`Signaling server listening on http://localhost:${PORT}`);
});
