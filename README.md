# Direct Link — P2P File Transfer & Community Wall

Send files straight from one browser to another using a short 5-character call sign with zero cloud storage, plus share text, snippets, commands, and notes on the live **Community Wall** where anyone can read and copy with 1 click.

## Features

- **⚡ Direct WebRTC P2P Transfer**: End-to-end browser-to-browser encrypted file transfers. The server only relays the tiny initial handshake.
- **🌐 Community Wall & Public Clipboard**: Share code snippets, notes, commands, or links with your name/handle.
- **📋 1-Click Copy**: Any community snippet can be copied instantly with automatic visual confirmation and toast feedback.
- **📱 Universal Responsive UI**: Cyberpunk & Aurora glassmorphic theme designed to look attractive and fit seamlessly across mobile, tablet, and desktop screens.
- **📷 Mobile QR Code**: Generate an instant QR code on the sender screen for mobile devices to join and receive files without typing.
- **🟢 Live Network Stats**: Real-time connected peer counter and live community updates powered by WebSockets.

## How it works

### P2P File Transfer
1. **Sender** picks file(s) and clicks **Generate call sign**. The server generates a 5-character room code (e.g. `DTS6G`).
2. **Receiver** enters that code or scans the QR code and clicks **Connect**.
3. Direct WebRTC `RTCDataChannel` connection is negotiated and files stream directly peer-to-peer in 16KB chunks.
4. Auto-downloads on receiver's device once received.

### Community Wall
1. Switch to the **Community Wall** tab.
2. Enter your name/handle (saved automatically for your next visits), choose a category (`Note`, `Code`, `Link`, `Message`), and type your snippet.
3. Click **Publish Snippet** — it broadcasts in real-time to everyone online!
4. Filter by category, search by author or keyword, and click **Copy Text** to copy anything to your clipboard.

## Run it locally

```bash
npm install
node server.js
```

Then open `http://localhost:3000` in your browser.

## File structure

```
p2p-share/
├── server.js          # Static server + WebRTC signaling + Community REST/WS
├── package.json
├── data/
│   └── community.json # Persisted community posts store
└── public/
    ├── index.html     # Responsive P2P transfer & Community wall
    ├── style.css      # Modern dark aurora / cyberpunk glassmorphic styles
    └── app.js         # Real-time WebSocket, WebRTC, clipboard & community logic
```

