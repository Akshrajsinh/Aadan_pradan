# Aadan-Pradan — Direct Browser-to-Browser File Sharing & Community Wall

> **Send files directly between devices — fast, private, and without uploading your files to cloud storage.**

Aadan-Pradan is a production-grade browser-to-browser P2P file-sharing application and community clipboard. Transfers stream directly peer-to-peer using WebRTC `RTCDataChannel`, with zero intermediate cloud storage.

---

## Key Features

- **⚡ Direct WebRTC P2P Transfer**: Direct browser-to-browser encrypted transfers. Zero cloud storage — files stream directly between peers in 16KB data chunks.
- **🎯 Streamlined Homepage & Hero**: Instant selection between **Send Files** and **Receive Files** with clear guidance.
- **🏷️ 5-Character Connection Code (Call Sign)**: Unique, unambiguous alphanumeric codes (e.g. `AB7KQ`) with 1-click **Copy Code**, **Copy Link**, and **Show QR**.
- **📷 Instant QR Code & Camera Scanner**: Senders generate high-contrast QR codes; receivers can join by scanning with their camera or uploading a QR screenshot.
- **📊 Real-Time Transfer Metrics (Non-Faked)**:
  - Instantaneous transfer speed (`MB/s` or `KB/s`)
  - Accurate estimated remaining time (ETA)
  - Amount transferred vs total file size (`176 MB / 245 MB`)
  - Multi-file progress tracking (`✓ Completed`, `↻ 72%`, `○ Waiting`) plus overall batch percentage
- **🎉 Distinct Completion Screen**: Dedicated celebration view upon transfer completion with individual file downloads, **Save All Files** batch action, **Transfer More Files**, and **Back to Home**.
- **🔄 Reusable Connection Status**: Human-readable status indicators for all 8 states (`Initializing`, `Waiting for peer`, `Connecting`, `Connected`, `Transferring`, `Completed`, `Disconnected`, `Failed`) with context-sensitive Retry and Cancel actions.
- **💬 Community Wall & Public Clipboard**: Share and browse notes, code snippets, web links, and messages.
  - Category filtering (`All`, `Note`, `Code`, `Link`, `Message`) and instant keyword search
  - 1-click **Copy Code** and secure **Open Link**
  - **Author Post Deletion**: Authors retain a secure client-side delete key in `localStorage` to delete their posts
  - **Community Reporting**: User-driven moderation to flag and auto-hide inappropriate content
  - **Security & Rate Limiting**: Strict input bounds (5,000 char max), XSS-safe DOM rendering, safe URL whitelist, and server-side IP rate limiting
- **📱 Fully Responsive SaaS Aesthetic**: Modern, accessible dark theme optimized across mobile, tablet, laptop, and desktop viewports.

---

## How It Works

### 1. Sender Flow
1. Click **Send Files** or drop files into the staging zone.
2. Click **Generate Call Sign** to request a 5-character connection code from the signaling server.
3. Share the code, direct link (`/#join=CODE`), or QR code with the receiver.
4. Once the receiver connects, a direct WebRTC `RTCDataChannel` is negotiated.
5. The sender first sends a `manifest` packet detailing all files, followed by 16KB binary chunks with real-time speed and ETA calculation.
6. The celebration screen confirms: *"✓ All files transferred successfully."*

### 2. Receiver Flow
1. Click **Receive Files** or open a shared direct link.
2. Enter the 5-character Call Sign or scan the sender's QR code with the built-in scanner.
3. Click **Connect**. The status component indicates 🟡 *Connecting…* then 🟢 *Connected*.
4. Files stream directly into memory, auto-download upon completion, and are presented in the **Transfer Complete** view with individual and batch download options.

### 3. Community Wall
1. Switch to the **Community Wall** tab.
2. Enter your author handle, choose a category (`Note`, `Code`, `Link`, `Message`), and type your snippet.
3. Click **Publish Snippet** — it broadcasts in real-time to all connected users via WebSockets.

---

## Local Development

```bash
# Install dependencies
npm install

# Start the signaling & community server
node server.js
```

Then navigate to `http://localhost:3000` in your web browser.

---

## Project Structure

```
p2p-share/
├── server.js          # HTTP static server + WebSocket signaling + REST API (with rate-limiting)
├── package.json       # Project dependencies (ws, qrcode)
├── data/
│   └── community.json # Persisted community posts store
└── public/
    ├── index.html     # Semantic, accessible UI (Hero, Sender, Receiver, Community Wall, QR Modal)
    ├── style.css      # Developer SaaS design system (Slate/obsidian palette, responsive)
    └── app.js         # WebRTC engine, speed/ETA tracker, connection manager, QR scanner, community logic
```

---

## Security & Architecture Notes

- **Zero Cloud Storage**: File data never touches the signaling server. All data transfers occur strictly over encrypted WebRTC `RTCDataChannel` peer-to-peer connections.
- **XSS Prevention**: User-generated community content is escaped and safely mounted to the DOM using text nodes and strict protocol checks (`http:` and `https:` only).
- **IP Rate Limiting**: The community posting endpoint enforces rate limits per IP to protect against spam flooding.
