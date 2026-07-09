# Direct Link — code-based P2P file sharing

Send files straight from one browser to another using a short 5-character
call sign. The server never touches the file — it only relays the small
WebRTC handshake messages needed for two browsers to find each other, then
gets out of the way.

## How it works

1. **Sender** picks file(s) and clicks **Generate call sign**. The server
   hands back a 5-character code (e.g. `DTS6G`) and opens a "room".
2. **Receiver** enters that code and clicks **Connect**.
3. The server relays a WebRTC offer/answer and ICE candidates between the
   two browsers (this is the only data that passes through the server —
   a few KB of connection metadata).
4. Once the direct WebRTC connection is up, the file is streamed in 16KB
   chunks straight from sender to receiver over a `RTCDataChannel`, with
   backpressure handling so large files don't overrun memory.
5. The receiver's browser assembles the chunks into a `Blob` and triggers
   a download automatically. The code is invalidated once used or after
   10 minutes if nobody joins.

## Run it locally

```bash
npm install
node server.js
```

Then open `http://localhost:3000` in two browser tabs (or two devices on
your network, pointing at your machine's LAN IP instead of localhost).

## Deploying it publicly

This is a single small Node process (`server.js`) serving both the static
frontend and the WebSocket signaling endpoint on one port — it runs
happily on any Node host (Render, Railway, Fly.io, a small VPS, etc.).
Just make sure:

- The platform supports **WebSockets** (most do; a few free tiers don't).
- You put it behind **HTTPS/WSS** in production — browsers require a
  secure context for `navigator.clipboard` and, on some setups, for
  WebRTC. Any reverse proxy (Caddy, Nginx, or the platform's own TLS) in
  front of the Node process handles this.
- `PORT` is read from the environment, so hosts that inject their own
  port assignment work without changes.

## About NAT traversal (important for a public product)

This build ships with only public STUN servers (Google's). STUN is enough
for most home/office networks, but it cannot help when a network uses
**symmetric NAT** — common on some corporate networks and a portion of
mobile carriers. On those networks, a direct peer-to-peer path genuinely
doesn't exist, and no amount of retrying fixes it; a **TURN** relay server
is the only real fix.

Recommended: add a TURN server config to `ICE_SERVERS` in
`public/app.js`:

```js
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:your-turn-host:3478', username: '...', credential: '...' },
];
```

Options for a TURN server: self-host [coturn](https://github.com/coturn/coturn)
on a small VPS, or use a managed TURN provider. Without one, a meaningful
share of "across networks" transfers on a public product will fail to
connect — worth budgeting for before wide launch.

## Known limitations / things to harden before a real public launch

- **No rate limiting** on code creation — add some (e.g. per-IP) before
  opening this up publicly, to prevent room-creation spam.
- **No file size cap** — the browser will happily try to send huge files;
  consider warning or capping in the UI for very large files, since some
  mobile browsers limit in-memory Blob assembly.
- **Single sender→receiver pairing per code** — this is intentional (keeps
  it simple and private), but means it's not built for one-to-many
  broadcast.
- **No persistence** — if the browser tab closes mid-transfer, the
  transfer is gone. This is by design (nothing is ever stored), but you
  may want to add a "reconnect within N seconds" grace period later.

## File structure

```
p2p-share/
├── server.js          # Static file server + WebSocket signaling relay
├── package.json
└── public/
    ├── index.html      # Send / Receive panels
    ├── style.css       # Visual design (dark "signal deck" theme)
    └── app.js          # WebSocket + WebRTC + chunked transfer logic
```
