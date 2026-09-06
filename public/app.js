(() => {
  'use strict';

  // ============================================================
  // CONFIGURATION & CONSTANTS
  // ============================================================
  const CHUNK_SIZE = 16 * 1024; // 16KB per WebRTC data channel chunk
  const BUFFERED_AMOUNT_HIGH = 1 * 1024 * 1024; // 1MB pause threshold
  const BUFFERED_AMOUNT_LOW = 256 * 1024; // 256KB resume threshold

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // Reusable Connection Status Definitions (Human-readable, zero unnecessary jargon)
  const CONNECTION_STATES = {
    initializing: {
      type: 'initializing',
      dotClass: 'dot-initializing',
      title: 'Initializing…',
      desc: 'Setting up direct WebRTC connection resources.',
      allowRetry: false,
      allowCancel: true
    },
    waiting: {
      type: 'waiting',
      dotClass: 'dot-waiting',
      title: 'Waiting for Receiver…',
      desc: 'Share your 5-character Call Sign or QR code with the receiving device.',
      allowRetry: false,
      allowCancel: true
    },
    connecting: {
      type: 'connecting',
      dotClass: 'dot-connecting',
      title: 'Connecting…',
      desc: 'Establishing encrypted peer-to-peer data channel directly between browsers.',
      allowRetry: false,
      allowCancel: true
    },
    connected: {
      type: 'connected',
      dotClass: 'dot-connected',
      title: 'Connected',
      desc: 'Direct connection established! Ready to transfer files.',
      allowRetry: false,
      allowCancel: false
    },
    transferring: {
      type: 'transferring',
      dotClass: 'dot-transferring',
      title: 'Transferring Files…',
      desc: 'Files are streaming directly browser-to-browser without touching cloud storage.',
      allowRetry: false,
      allowCancel: true
    },
    completed: {
      type: 'completed',
      dotClass: 'dot-completed',
      title: 'Transfer Complete',
      desc: 'All files were transferred and verified successfully.',
      allowRetry: false,
      allowCancel: false
    },
    disconnected: {
      type: 'disconnected',
      dotClass: 'dot-disconnected',
      title: 'Peer Disconnected',
      desc: 'The other device closed their tab or disconnected from the session.',
      allowRetry: true,
      allowCancel: false
    },
    failed: {
      type: 'failed',
      dotClass: 'dot-failed',
      title: 'Connection Failed',
      desc: "We couldn't establish a direct peer connection. Network or firewall restrictions may be blocking WebRTC traffic.",
      allowRetry: true,
      allowCancel: false
    }
  };

  // ============================================================
  // DOM ELEMENT REFERENCES
  // ============================================================
  const toastContainer = document.getElementById('toastContainer');
  const logoClickable = document.getElementById('logoClickable');
  const onlineCountText = document.getElementById('onlineCountText');

  // Navigation
  const tabTransferBtn = document.getElementById('tabTransferBtn');
  const tabCommunityBtn = document.getElementById('tabCommunityBtn');
  const transferTabPane = document.getElementById('transferTabPane');
  const communityTabPane = document.getElementById('communityTabPane');
  const communityCountBadge = document.getElementById('communityCountBadge');

  // Hero Section
  const heroSection = document.getElementById('heroSection');
  const heroSendActionBtn = document.getElementById('heroSendActionBtn');
  const heroRecvActionBtn = document.getElementById('heroRecvActionBtn');

  // Toolbar & Mode Switcher
  const transferToolbar = document.getElementById('transferToolbar');
  const backToHeroBtn = document.getElementById('backToHeroBtn');
  const modeBothBtn = document.getElementById('modeBothBtn');
  const modeSendBtn = document.getElementById('modeSendBtn');
  const modeRecvBtn = document.getElementById('modeRecvBtn');
  const transferGrid = document.getElementById('transferGrid');
  const sendCard = document.getElementById('sendCard');
  const recvCard = document.getElementById('recvCard');

  // Signal Rail
  const nodeSend = document.getElementById('nodeSend');
  const nodeRecv = document.getElementById('nodeRecv');
  const pulse = document.getElementById('pulse');

  // Sender Elements
  const senderStagingSection = document.getElementById('senderStagingSection');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectedFilesCard = document.getElementById('selectedFilesCard');
  const selectedCountText = document.getElementById('selectedCountText');
  const clearFilesBtn = document.getElementById('clearFilesBtn');
  const fileListEl = document.getElementById('fileList');
  const createBtn = document.getElementById('createBtn');

  const callsignPlate = document.getElementById('callsignPlate');
  const sendStateTag = document.getElementById('sendStateTag');
  const plateCode = document.getElementById('plateCode');
  const copyBtn = document.getElementById('copyBtn');
  const copyBtnText = document.getElementById('copyBtnText');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyLinkBtnText = document.getElementById('copyLinkBtnText');
  const qrToggleBtn = document.getElementById('qrToggleBtn');
  const qrContainer = document.getElementById('qrContainer');
  const qrImage = document.getElementById('qrImage');
  const cancelSendBtn = document.getElementById('cancelSendBtn');
  const sendStatus = document.getElementById('sendStatus');

  // Sender Live Transfer Monitor
  const sendTransferMonitor = document.getElementById('sendTransferMonitor');
  const sendMonitorHeading = document.getElementById('sendMonitorHeading');
  const sendAbortBtn = document.getElementById('sendAbortBtn');
  const sendOverallFilesCount = document.getElementById('sendOverallFilesCount');
  const sendOverallPctText = document.getElementById('sendOverallPctText');
  const sendOverallProgressBar = document.getElementById('sendOverallProgressBar');
  const sendTransferredBytesText = document.getElementById('sendTransferredBytesText');
  const sendSpeedText = document.getElementById('sendSpeedText');
  const sendRemainingTimeText = document.getElementById('sendRemainingTimeText');
  const sendFilesBreakdownList = document.getElementById('sendFilesBreakdownList');

  // Sender Completion Screen
  const sendCompletionCard = document.getElementById('sendCompletionCard');
  const sendCompletionSummary = document.getElementById('sendCompletionSummary');
  const sendMoreFilesBtn = document.getElementById('sendMoreFilesBtn');
  const sendCompletionHomeBtn = document.getElementById('sendCompletionHomeBtn');

  // Receiver Elements
  const receiverFormSection = document.getElementById('receiverFormSection');
  const codeInput = document.getElementById('codeInput');
  const pasteCodeBtn = document.getElementById('pasteCodeBtn');
  const joinBtn = document.getElementById('joinBtn');
  const joinBtnText = document.getElementById('joinBtnText');
  const scanQrBtn = document.getElementById('scanQrBtn');
  const recvStatus = document.getElementById('recvStatus');

  // Reusable Connection Status Component (Receiver)
  const connectionStatusCard = document.getElementById('connectionStatusCard');
  const statusDot = document.getElementById('statusDot');
  const statusHeading = document.getElementById('statusHeading');
  const statusExplanation = document.getElementById('statusExplanation');
  const statusActionsRow = document.getElementById('statusActionsRow');
  const statusRetryBtn = document.getElementById('statusRetryBtn');
  const statusCancelBtn = document.getElementById('statusCancelBtn');

  // Receiver Live Transfer Monitor
  const recvTransferMonitor = document.getElementById('recvTransferMonitor');
  const recvMonitorHeading = document.getElementById('recvMonitorHeading');
  const recvAbortBtn = document.getElementById('recvAbortBtn');
  const recvOverallFilesCount = document.getElementById('recvOverallFilesCount');
  const recvOverallPctText = document.getElementById('recvOverallPctText');
  const recvOverallProgressBar = document.getElementById('recvOverallProgressBar');
  const recvTransferredBytesText = document.getElementById('recvTransferredBytesText');
  const recvSpeedText = document.getElementById('recvSpeedText');
  const recvRemainingTimeText = document.getElementById('recvRemainingTimeText');
  const recvFilesBreakdownList = document.getElementById('recvFilesBreakdownList');

  // Receiver Completion Screen
  const recvCompletionCard = document.getElementById('recvCompletionCard');
  const downloadAllFilesBtn = document.getElementById('downloadAllFilesBtn');
  const recvFileList = document.getElementById('recvFileList');
  const recvMoreFilesBtn = document.getElementById('recvMoreFilesBtn');
  const recvCompletionHomeBtn = document.getElementById('recvCompletionHomeBtn');

  // QR Scanner Modal
  const qrScannerModal = document.getElementById('qrScannerModal');
  const closeQrModalBtn = document.getElementById('closeQrModalBtn');
  const qrVideo = document.getElementById('qrVideo');
  const qrCanvas = document.getElementById('qrCanvas');
  const scannerStatusText = document.getElementById('scannerStatusText');
  const qrFileInput = document.getElementById('qrFileInput');

  // Community Wall Elements
  const communityForm = document.getElementById('communityForm');
  const authorInput = document.getElementById('authorInput');
  const selectedTagInput = document.getElementById('selectedTag');
  const tagSelector = document.getElementById('tagSelector');
  const snippetTextInput = document.getElementById('snippetTextInput');
  const charCount = document.getElementById('charCount');
  const submitSnippetBtn = document.getElementById('submitSnippetBtn');
  const communitySearchInput = document.getElementById('communitySearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const filterChips = document.querySelectorAll('.chip');
  const communityPostsList = document.getElementById('communityPostsList');
  const feedCountTitle = document.getElementById('feedCountTitle');
  const refreshFeedBtn = document.getElementById('refreshFeedBtn');

  // ============================================================
  // GLOBAL STATE
  // ============================================================
  let mainSocket = null;
  let allCommunityPosts = [];
  let currentCommunityFilter = 'all';
  let communitySearchQuery = '';

  // WebRTC Sender State
  let stagedFiles = [];
  let sendSocket = null;
  let sendPC = null;
  let sendChannel = null;
  let sendIceQueue = [];
  let senderAborted = false;

  // WebRTC Receiver State
  let recvSocket = null;
  let recvPC = null;
  let recvIceQueue = [];
  let lastAttemptedCode = '';
  let receiverAborted = false;
  let incomingManifest = null;
  let activeIncomingFile = null;
  let receivedFilesCollection = []; // { name, size, mime, blob, url }

  // Active Camera Stream for QR Scanner
  let qrCameraStream = null;
  let qrScanAnimationId = null;

  // ============================================================
  // UTILITY HELPERS
  // ============================================================
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function fmtBytes(n) {
    if (typeof n !== 'number' || isNaN(n) || n <= 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
  }

  function fmtSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0) return '0.0 MB/s';
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  function fmtRemainingTime(remainingBytes, bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 100 || remainingBytes <= 0) {
      return 'Calculating…';
    }
    const secs = Math.ceil(remainingBytes / bytesPerSec);
    if (secs < 1) return '< 1 second';
    if (secs === 1) return '~1 second remaining';
    if (secs < 60) return `~${secs} seconds remaining`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) {
      return `~${mins}m ${remSecs}s remaining`;
    }
    return `~${(secs / 3600).toFixed(1)} hours remaining`;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  }

  function formatRelativeTime(timestamp) {
    const elapsedSec = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsedSec < 15) return 'just now';
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const elapsedMin = Math.floor(elapsedSec / 60);
    if (elapsedMin < 60) return `${elapsedMin}m ago`;
    const elapsedHours = Math.floor(elapsedMin / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 30) return `${elapsedDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 65%, 40%)`;
  }

  function getInitials(name) {
    const parts = (name || 'Anonymous').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0].slice(0, 2) || 'AP').toUpperCase();
  }

  function showToast(message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : '!';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fallback
      }
    }
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    } catch {
      return false;
    }
  }

  function setRailActive(sendOn, recvOn) {
    if (nodeSend) nodeSend.classList.toggle('active', sendOn);
    if (nodeRecv) nodeRecv.classList.toggle('active', recvOn);
    if (pulse) pulse.classList.toggle('traveling', sendOn && recvOn);
  }

  function setStatusMsg(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg' + (kind ? ` ${kind}` : '');
  }

  // ============================================================
  // REUSABLE CONNECTION STATUS MANAGER
  // ============================================================
  function updateConnectionStatus(stateKey, customDesc = null) {
    const state = CONNECTION_STATES[stateKey];
    if (!state || !connectionStatusCard) return;

    connectionStatusCard.hidden = false;

    if (statusDot) {
      statusDot.className = `status-indicator-dot ${state.dotClass}`;
    }
    if (statusHeading) {
      statusHeading.textContent = state.title;
    }
    if (statusExplanation) {
      statusExplanation.textContent = customDesc || state.desc;
    }

    if (statusActionsRow) {
      const showAnyAction = state.allowRetry || state.allowCancel;
      statusActionsRow.hidden = !showAnyAction;

      if (statusRetryBtn) {
        statusRetryBtn.hidden = !state.allowRetry;
      }
      if (statusCancelBtn) {
        statusCancelBtn.hidden = !state.allowCancel;
      }
    }
  }

  function hideConnectionStatus() {
    if (connectionStatusCard) connectionStatusCard.hidden = true;
  }

  // ============================================================
  // ACCURATE REAL-TIME SPEED & ETA TRACKER (NON-FAKED)
  // ============================================================
  class RealtimeTransferTracker {
    constructor(totalBytes) {
      this.totalBytes = totalBytes;
      this.totalTransferred = 0;
      this.startTime = Date.now();
      this.samples = []; // Array of { time, bytes }
      this.currentSpeed = 0; // Bytes per second
    }

    update(transferredBytes) {
      const now = Date.now();
      this.totalTransferred = transferredBytes;

      this.samples.push({ time: now, bytes: transferredBytes });

      // Keep only samples from the last 1.5 seconds for snappy, accurate instantaneous speed
      const cutoff = now - 1500;
      while (this.samples.length > 2 && this.samples[0].time < cutoff) {
        this.samples.shift();
      }

      if (this.samples.length >= 2) {
        const oldest = this.samples[0];
        const deltaBytes = transferredBytes - oldest.bytes;
        const deltaSec = (now - oldest.time) / 1000;
        if (deltaSec > 0.05) {
          this.currentSpeed = Math.max(0, deltaBytes / deltaSec);
        }
      }

      const remainingBytes = Math.max(0, this.totalBytes - this.totalTransferred);
      const pct = this.totalBytes > 0
        ? Math.min(100, Math.round((this.totalTransferred / this.totalBytes) * 100))
        : 0;

      return {
        pct,
        speedText: fmtSpeed(this.currentSpeed),
        remainingText: fmtRemainingTime(remainingBytes, this.currentSpeed),
        transferredText: `${fmtBytes(this.totalTransferred)} / ${fmtBytes(this.totalBytes)}`
      };
    }
  }

  // ============================================================
  // TAB & MODE NAVIGATION (HOMEPAGE HERO INTERACTION)
  // ============================================================
  function switchTab(tab) {
    if (tab === 'community') {
      tabCommunityBtn.classList.add('active');
      tabTransferBtn.classList.remove('active');
      communityTabPane.classList.add('active');
      transferTabPane.classList.remove('active');
      tabCommunityBtn.setAttribute('aria-selected', 'true');
      tabTransferBtn.setAttribute('aria-selected', 'false');
      location.hash = 'community';
    } else {
      tabTransferBtn.classList.add('active');
      tabCommunityBtn.classList.remove('active');
      transferTabPane.classList.add('active');
      communityTabPane.classList.remove('active');
      tabTransferBtn.setAttribute('aria-selected', 'true');
      tabCommunityBtn.setAttribute('aria-selected', 'false');
      if (location.hash === '#community') {
        location.hash = 'transfer';
      }
    }
  }

  tabTransferBtn.addEventListener('click', () => switchTab('transfer'));
  tabCommunityBtn.addEventListener('click', () => switchTab('community'));

  function setTransferMode(mode) {
    if (!modeBothBtn || !modeSendBtn || !modeRecvBtn || !transferGrid) return;

    modeBothBtn.classList.toggle('active', mode === 'both');
    modeSendBtn.classList.toggle('active', mode === 'send');
    modeRecvBtn.classList.toggle('active', mode === 'recv');

    transferGrid.classList.remove('mode-send', 'mode-recv');
    if (mode === 'send') transferGrid.classList.add('mode-send');
    if (mode === 'recv') transferGrid.classList.add('mode-recv');

    // Hide hero section once a specific mode is engaged
    if (mode === 'send' || mode === 'recv') {
      if (heroSection) heroSection.hidden = true;
      if (backToHeroBtn) backToHeroBtn.hidden = false;
    } else {
      if (heroSection) heroSection.hidden = false;
      if (backToHeroBtn) backToHeroBtn.hidden = true;
    }
  }

  if (modeBothBtn) modeBothBtn.addEventListener('click', () => setTransferMode('both'));
  if (modeSendBtn) modeSendBtn.addEventListener('click', () => setTransferMode('send'));
  if (modeRecvBtn) modeRecvBtn.addEventListener('click', () => setTransferMode('recv'));

  // Hero card actions
  if (heroSendActionBtn) {
    heroSendActionBtn.addEventListener('click', () => {
      setTransferMode('send');
      dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (heroRecvActionBtn) {
    heroRecvActionBtn.addEventListener('click', () => {
      setTransferMode('recv');
      setTimeout(() => codeInput.focus(), 150);
      codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  if (backToHeroBtn) {
    backToHeroBtn.addEventListener('click', () => {
      setTransferMode('both');
      if (heroSection) {
        heroSection.hidden = false;
        heroSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  if (logoClickable) {
    logoClickable.addEventListener('click', () => {
      switchTab('transfer');
      setTransferMode('both');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ============================================================
  // GLOBAL REAL-TIME WEBSOCKET (COMMUNITY + LIVE STATS)
  // ============================================================
  function connectMainSocket() {
    try {
      mainSocket = new WebSocket(wsUrl());

      mainSocket.addEventListener('open', () => {
        if (onlineCountText) onlineCountText.textContent = 'Ready';
        mainSocket.send(JSON.stringify({ type: 'community-get' }));
      });

      mainSocket.addEventListener('message', (evt) => {
        let msg;
        try { msg = JSON.parse(evt.data); } catch { return; }

        if (msg.type === 'stats') {
          const count = msg.onlineUsers || 1;
          if (onlineCountText) {
            onlineCountText.textContent = `${count} Online`;
          }
          if (msg.postCount !== undefined && communityCountBadge) {
            communityCountBadge.textContent = msg.postCount;
          }
        } else if (msg.type === 'community-list') {
          if (Array.isArray(msg.posts)) {
            allCommunityPosts = msg.posts;
            renderCommunityPosts();
          }
        } else if (msg.type === 'community-new') {
          if (msg.post && !allCommunityPosts.some(p => p.id === msg.post.id)) {
            allCommunityPosts.unshift(msg.post);
            renderCommunityPosts();
            showToast(`New ${msg.post.tag} from ${msg.post.author}!`, 'success');
          }
        } else if (msg.type === 'community-deleted') {
          allCommunityPosts = allCommunityPosts.filter(p => p.id !== msg.id);
          renderCommunityPosts();
        } else if (msg.type === 'community-post-success') {
          if (msg.post && msg.deleteKey) {
            savePostDeleteKey(msg.post.id, msg.deleteKey);
            if (!allCommunityPosts.some(p => p.id === msg.post.id)) {
              allCommunityPosts.unshift(msg.post);
              renderCommunityPosts();
            }
          }
        } else if (msg.type === 'error') {
          showToast(msg.message, 'error');
        }
      });

      mainSocket.addEventListener('close', () => {
        if (onlineCountText) onlineCountText.textContent = 'Reconnecting…';
        setTimeout(connectMainSocket, 3500);
      });

      mainSocket.addEventListener('error', () => {
        if (onlineCountText) onlineCountText.textContent = 'Offline';
      });
    } catch {
      setTimeout(connectMainSocket, 5000);
    }
  }

  connectMainSocket();

  // ============================================================
  // COMMUNITY WALL LOGIC (SECURITY, XSS PROTECTION, DELETION)
  // ============================================================
  const savedAuthor = localStorage.getItem('p2p_author_name') || '';
  if (authorInput && savedAuthor) {
    authorInput.value = savedAuthor;
  }

  function getSavedDeleteKeys() {
    try {
      return JSON.parse(localStorage.getItem('ap_delete_keys') || '{}');
    } catch {
      return {};
    }
  }

  function savePostDeleteKey(postId, deleteKey) {
    const keys = getSavedDeleteKeys();
    keys[postId] = deleteKey;
    localStorage.setItem('ap_delete_keys', JSON.stringify(keys));
  }

  function removePostDeleteKey(postId) {
    const keys = getSavedDeleteKeys();
    delete keys[postId];
    localStorage.setItem('ap_delete_keys', JSON.stringify(keys));
  }

  // Tag selector click
  if (tagSelector) {
    tagSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-pill');
      if (!btn) return;
      tagSelector.querySelectorAll('.tag-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTagInput.value = btn.dataset.tag;
    });
  }

  // Character counter
  if (snippetTextInput && charCount) {
    snippetTextInput.addEventListener('input', () => {
      const len = snippetTextInput.value.length;
      charCount.textContent = `${len.toLocaleString()} / 5,000`;
    });
  }

  async function fetchCommunityPosts() {
    try {
      const res = await fetch('/api/community');
      if (res.ok) {
        const data = await res.json();
        if (data.posts) {
          allCommunityPosts = data.posts;
          renderCommunityPosts();
        }
      }
    } catch (e) {
      console.warn('REST fetch failed, relying on WebSocket:', e);
    }
  }
  fetchCommunityPosts();

  // Filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCommunityFilter = chip.dataset.filter;
      renderCommunityPosts();
    });
  });

  // Search input
  if (communitySearchInput) {
    communitySearchInput.addEventListener('input', () => {
      communitySearchQuery = communitySearchInput.value.trim().toLowerCase();
      if (clearSearchBtn) {
        clearSearchBtn.hidden = communitySearchQuery.length === 0;
      }
      renderCommunityPosts();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      communitySearchInput.value = '';
      communitySearchQuery = '';
      clearSearchBtn.hidden = true;
      renderCommunityPosts();
      communitySearchInput.focus();
    });
  }

  if (refreshFeedBtn) {
    refreshFeedBtn.addEventListener('click', () => {
      fetchCommunityPosts();
      showToast('Feed refreshed!');
    });
  }

  // Safe URL extraction
  function getSafeUrl(text) {
    try {
      const firstToken = (text || '').trim().split(/\s+/)[0];
      const parsed = new URL(firstToken);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.href;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Render Community Posts (Strict XSS protection, zero unescaped HTML)
  function renderCommunityPosts() {
    if (!communityPostsList) return;

    let filtered = allCommunityPosts;

    if (currentCommunityFilter !== 'all') {
      filtered = filtered.filter(p => p.tag === currentCommunityFilter);
    }

    if (communitySearchQuery) {
      filtered = filtered.filter(p =>
        (p.author && p.author.toLowerCase().includes(communitySearchQuery)) ||
        (p.text && p.text.toLowerCase().includes(communitySearchQuery)) ||
        (p.tag && p.tag.toLowerCase().includes(communitySearchQuery))
      );
    }

    if (communityCountBadge) {
      communityCountBadge.textContent = allCommunityPosts.length;
    }
    if (feedCountTitle) {
      feedCountTitle.textContent = `Community Feed (${filtered.length})`;
    }

    if (filtered.length === 0) {
      communityPostsList.innerHTML = `
        <div class="empty-feed-card">
          <p>No community posts match your search or filter.</p>
        </div>
      `;
      return;
    }

    const myKeys = getSavedDeleteKeys();
    communityPostsList.innerHTML = '';

    filtered.forEach(post => {
      const article = document.createElement('article');
      article.className = 'post-card';
      article.dataset.postId = post.id;

      const avatarColor = getAvatarColor(post.author || 'Anonymous');
      const initials = getInitials(post.author || 'Anonymous');
      const relTime = formatRelativeTime(post.createdAt || Date.now());
      const charLen = (post.text || '').length;
      const isMyPost = Boolean(myKeys[post.id]);
      const safeUrl = post.tag === 'Link' ? getSafeUrl(post.text) : null;

      // Card Header
      const topRow = document.createElement('div');
      topRow.className = 'post-card-top';

      const authorGroup = document.createElement('div');
      authorGroup.className = 'post-author-group';

      const avatar = document.createElement('div');
      avatar.className = 'author-avatar';
      avatar.style.backgroundColor = avatarColor;
      avatar.textContent = initials;

      const authorDetails = document.createElement('div');
      authorDetails.className = 'author-details';

      const authorName = document.createElement('span');
      authorName.className = 'author-name';
      authorName.textContent = post.author || 'Anonymous';

      const postTime = document.createElement('span');
      postTime.className = 'post-time';
      postTime.textContent = relTime;

      authorDetails.appendChild(authorName);
      authorDetails.appendChild(postTime);
      authorGroup.appendChild(avatar);
      authorGroup.appendChild(authorDetails);

      const tagBadge = document.createElement('span');
      tagBadge.className = `post-tag-badge tag-${post.tag || 'Note'}`;
      tagBadge.textContent = post.tag || 'Note';

      topRow.appendChild(authorGroup);
      topRow.appendChild(tagBadge);
      article.appendChild(topRow);

      // Card Content
      const contentWrap = document.createElement('div');
      contentWrap.className = 'post-content-wrap';

      if (post.tag === 'Code') {
        const pre = document.createElement('pre');
        pre.className = 'post-code-block';
        const code = document.createElement('code');
        code.textContent = post.text;
        pre.appendChild(code);
        contentWrap.appendChild(pre);
      } else if (post.tag === 'Link' && safeUrl) {
        const linkCard = document.createElement('div');
        linkCard.className = 'post-link-card';

        const a = document.createElement('a');
        a.className = 'safe-external-link';
        a.href = safeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = safeUrl;

        linkCard.appendChild(a);

        // Remainder text if any
        const remainder = post.text.replace(safeUrl, '').trim();
        if (remainder) {
          const desc = document.createElement('p');
          desc.className = 'link-extra-text';
          desc.textContent = remainder;
          linkCard.appendChild(desc);
        }
        contentWrap.appendChild(linkCard);
      } else {
        const p = document.createElement('p');
        p.className = 'post-content-text';
        p.textContent = post.text;
        contentWrap.appendChild(p);
      }
      article.appendChild(contentWrap);

      // Card Footer / Actions
      const bottomRow = document.createElement('div');
      bottomRow.className = 'post-card-bottom';

      const metaSpan = document.createElement('span');
      metaSpan.className = 'post-stats-text';
      metaSpan.textContent = `${charLen.toLocaleString()} chars`;
      bottomRow.appendChild(metaSpan);

      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'post-actions-group';

      // Copy Button
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-copy-snippet';
      copyBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>${post.tag === 'Code' ? 'Copy Code' : (post.tag === 'Link' ? 'Copy Link' : 'Copy Text')}</span>
      `;
      copyBtn.addEventListener('click', async () => {
        const textToCopy = safeUrl || post.text;
        const success = await copyToClipboard(textToCopy);
        if (success) {
          copyBtn.classList.add('copied');
          copyBtn.querySelector('span').textContent = '✓ Copied!';
          showToast('Copied to clipboard!', 'success');
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('span').textContent = post.tag === 'Code' ? 'Copy Code' : (post.tag === 'Link' ? 'Copy Link' : 'Copy Text');
          }, 2000);
        }
      });
      actionsGroup.appendChild(copyBtn);

      // Open Link button if category is Link
      if (post.tag === 'Link' && safeUrl) {
        const openBtn = document.createElement('a');
        openBtn.className = 'btn-open-link';
        openBtn.href = safeUrl;
        openBtn.target = '_blank';
        openBtn.rel = 'noopener noreferrer';
        openBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          <span>Open Link</span>
        `;
        actionsGroup.appendChild(openBtn);
      }

      // Report button
      const reportBtn = document.createElement('button');
      reportBtn.type = 'button';
      reportBtn.className = 'btn-report-post';
      reportBtn.title = 'Report inappropriate content or spam';
      reportBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        <span>Report</span>
      `;
      reportBtn.addEventListener('click', async () => {
        if (!confirm('Report this post for review?')) return;
        try {
          const res = await fetch('/api/community/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: post.id })
          });
          if (res.ok) {
            article.style.opacity = '0.3';
            showToast('Post reported. Thank you for keeping the community safe.');
          }
        } catch {
          showToast('Unable to report post right now.', 'error');
        }
      });
      actionsGroup.appendChild(reportBtn);

      // Delete button if authored by current user
      if (isMyPost) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-post';
        deleteBtn.title = 'Delete your post';
        deleteBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Delete</span>
        `;
        deleteBtn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to delete this post?')) return;
          const deleteKey = myKeys[post.id];
          try {
            const res = await fetch('/api/community/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: post.id, deleteKey })
            });
            if (res.ok) {
              removePostDeleteKey(post.id);
              allCommunityPosts = allCommunityPosts.filter(p => p.id !== post.id);
              renderCommunityPosts();
              showToast('Post deleted successfully.');
            } else {
              showToast('Could not delete post.', 'error');
            }
          } catch {
            showToast('Network error while deleting.', 'error');
          }
        });
        actionsGroup.appendChild(deleteBtn);
      }

      bottomRow.appendChild(actionsGroup);
      article.appendChild(bottomRow);

      communityPostsList.appendChild(article);
    });
  }

  // Submit Community Form
  if (communityForm) {
    communityForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const author = (authorInput.value || '').trim() || 'Anonymous';
      const text = (snippetTextInput.value || '').trim();
      const tag = selectedTagInput.value || 'Note';

      if (!text) {
        showToast('Please enter some text, code, or a link to share.', 'error');
        return;
      }

      localStorage.setItem('p2p_author_name', author);

      submitSnippetBtn.disabled = true;
      submitSnippetBtn.querySelector('span').textContent = 'Publishing…';

      try {
        const response = await fetch('/api/community', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, text, tag })
        });

        const resData = await response.json();

        if (response.ok && resData.success) {
          snippetTextInput.value = '';
          if (charCount) charCount.textContent = '0 / 5,000';
          showToast('Published to community wall!', 'success');

          if (resData.deleteKey && resData.post) {
            savePostDeleteKey(resData.post.id, resData.deleteKey);
          }

          if (resData.post && !allCommunityPosts.some(p => p.id === resData.post.id)) {
            allCommunityPosts.unshift(resData.post);
            renderCommunityPosts();
          }
        } else {
          showToast(resData.error || 'Error publishing snippet.', 'error');
        }
      } catch {
        // Fallback to WebSocket
        if (mainSocket && mainSocket.readyState === WebSocket.OPEN) {
          mainSocket.send(JSON.stringify({ type: 'community-post', author, text, tag }));
          snippetTextInput.value = '';
          showToast('Published via real-time WebSocket!', 'success');
        } else {
          showToast('Server unavailable. Please try again.', 'error');
        }
      } finally {
        submitSnippetBtn.disabled = false;
        submitSnippetBtn.querySelector('span').textContent = 'Publish Snippet';
      }
    });
  }

  // Periodic relative time updater
  setInterval(() => {
    document.querySelectorAll('.post-card').forEach(card => {
      const id = card.dataset.postId;
      const post = allCommunityPosts.find(p => p.id === id);
      if (post) {
        const timeEl = card.querySelector('.post-time');
        if (timeEl) timeEl.textContent = formatRelativeTime(post.createdAt);
      }
    });
  }, 30000);

  // ============================================================
  // MULTI-FILE BREAKDOWN RENDERER
  // ============================================================
  function renderFileBreakdown(containerEl, filesArray, activeIndex = -1, activeFileTransferred = 0) {
    if (!containerEl) return;
    containerEl.innerHTML = '';

    filesArray.forEach((file, idx) => {
      const li = document.createElement('li');
      li.className = 'transfer-file-item';

      let statusBadge = '';
      let pct = 0;

      if (idx < activeIndex) {
        statusBadge = '<span class="file-state-tag state-done">✓ Completed</span>';
        pct = 100;
      } else if (idx === activeIndex) {
        pct = file.size > 0 ? Math.min(100, Math.round((activeFileTransferred / file.size) * 100)) : 0;
        statusBadge = `<span class="file-state-tag state-active">↻ ${pct}%</span>`;
      } else {
        statusBadge = '<span class="file-state-tag state-waiting">○ Waiting</span>';
        pct = 0;
      }

      li.innerHTML = `
        <div class="file-item-summary">
          <div class="file-name-group">
            <svg class="file-row-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="breakdown-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
          </div>
          <div class="file-item-right">
            <span class="breakdown-file-size">${fmtBytes(file.size)}</span>
            ${statusBadge}
          </div>
        </div>
        <div class="file-item-progress-track">
          <div class="file-item-progress-fill" style="width: ${pct}%;"></div>
        </div>
      `;
      containerEl.appendChild(li);
    });
  }

  // ============================================================
  // SENDER FLOW & WEBRTC ENGINE
  // ============================================================
  function renderStagedFileList() {
    if (!fileListEl || !selectedFilesCard || !createBtn) return;
    fileListEl.innerHTML = '';
    const totalBytes = stagedFiles.reduce((sum, f) => sum + f.size, 0);

    if (stagedFiles.length === 0) {
      selectedFilesCard.hidden = true;
      createBtn.disabled = true;
      return;
    }

    selectedFilesCard.hidden = false;
    selectedCountText.textContent = `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''} staged (${fmtBytes(totalBytes)})`;
    createBtn.disabled = false;

    stagedFiles.forEach((f, idx) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      li.innerHTML = `
        <div class="file-item-left">
          <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
        </div>
        <div class="file-meta">
          <span class="file-size">${fmtBytes(f.size)}</span>
          <button type="button" class="file-remove-btn" data-index="${idx}" title="Remove file">✕</button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    fileListEl.querySelectorAll('.file-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        stagedFiles.splice(idx, 1);
        renderStagedFileList();
      });
    });
  }

  if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', () => {
      stagedFiles = [];
      fileInput.value = '';
      renderStagedFileList();
      showToast('Staged files cleared');
    });
  }

  // Dropzone events
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragover', 'dragenter'].forEach(evt =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      })
    );

    ['dragleave', 'drop'].forEach(evt =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      })
    );

    dropZone.addEventListener('drop', (e) => {
      const dropped = Array.from(e.dataTransfer.files || []);
      if (dropped.length) {
        stagedFiles = stagedFiles.concat(dropped);
        renderStagedFileList();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        stagedFiles = stagedFiles.concat(Array.from(fileInput.files));
        renderStagedFileList();
      }
    });
  }

  // Reset sender session
  function resetSenderState() {
    senderAborted = true;
    if (sendSocket) {
      try { sendSocket.send(JSON.stringify({ type: 'cancel' })); } catch { /* ignore */ }
      sendSocket.close();
      sendSocket = null;
    }
    if (sendPC) {
      try { sendPC.close(); } catch { /* ignore */ }
      sendPC = null;
    }
    sendChannel = null;
    sendIceQueue = [];

    if (senderStagingSection) senderStagingSection.hidden = false;
    if (sendTransferMonitor) sendTransferMonitor.hidden = true;
    if (sendCompletionCard) sendCompletionCard.hidden = true;
    if (callsignPlate) callsignPlate.hidden = true;
    if (qrContainer) qrContainer.hidden = true;
    if (plateCode) plateCode.textContent = '-----';
    if (createBtn) createBtn.disabled = stagedFiles.length === 0;
    setStatusMsg(sendStatus, '');
    setRailActive(false, false);
  }

  if (cancelSendBtn) {
    cancelSendBtn.addEventListener('click', () => {
      resetSenderState();
      showToast('Sender session reset.');
    });
  }

  if (sendAbortBtn) {
    sendAbortBtn.addEventListener('click', () => {
      resetSenderState();
      showToast('File transfer cancelled.');
    });
  }

  if (sendMoreFilesBtn) {
    sendMoreFilesBtn.addEventListener('click', () => {
      resetSenderState();
      stagedFiles = [];
      fileInput.value = '';
      renderStagedFileList();
    });
  }

  if (sendCompletionHomeBtn) {
    sendCompletionHomeBtn.addEventListener('click', () => {
      resetSenderState();
      stagedFiles = [];
      fileInput.value = '';
      renderStagedFileList();
      setTransferMode('both');
    });
  }

  // Sender: Generate Call Sign
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      if (!stagedFiles.length) return;
      createBtn.disabled = true;
      senderAborted = false;
      setStatusMsg(sendStatus, 'Requesting connection code from signaling server…');

      sendSocket = new WebSocket(wsUrl());

      sendSocket.addEventListener('open', () => {
        sendSocket.send(JSON.stringify({ type: 'create' }));
      });

      sendSocket.addEventListener('message', (evt) => {
        try {
          handleSenderSignal(JSON.parse(evt.data));
        } catch (err) {
          console.error('Send signal parse error:', err);
        }
      });

      sendSocket.addEventListener('close', () => {
        if (!senderAborted && (!sendChannel || sendChannel.readyState !== 'open')) {
          setStatusMsg(sendStatus, 'Signaling server disconnected.', 'err');
          setRailActive(false, false);
          createBtn.disabled = false;
        }
      });
    });
  }

  // Copy buttons
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = plateCode.textContent;
      const success = await copyToClipboard(code);
      if (success) {
        copyBtn.classList.add('copied');
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        showToast(`Call Sign ${code} copied to clipboard!`);
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copy Code';
        }, 2000);
      }
    });
  }

  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const code = plateCode.textContent;
      const directUrl = `${location.origin}/#join=${code}`;
      const success = await copyToClipboard(directUrl);
      if (success) {
        copyLinkBtn.classList.add('copied');
        if (copyLinkBtnText) copyLinkBtnText.textContent = 'Copied Link!';
        showToast('Direct link copied! Send it to the receiver.');
        setTimeout(() => {
          copyLinkBtn.classList.remove('copied');
          if (copyLinkBtnText) copyLinkBtnText.textContent = 'Copy Link';
        }, 2000);
      }
    });
  }

  // Toggle QR Code on sender
  if (qrToggleBtn) {
    qrToggleBtn.addEventListener('click', () => {
      const isHidden = qrContainer.hidden;
      qrContainer.hidden = !isHidden;
      if (!qrContainer.hidden && qrImage) {
        const code = plateCode.textContent;
        const shareUrl = `${location.origin}/#join=${code}`;
        qrImage.src = `/api/qr?text=${encodeURIComponent(shareUrl)}`;
      }
    });
  }

  function handleSenderSignal(msg) {
    switch (msg.type) {
      case 'created':
        if (callsignPlate) callsignPlate.hidden = false;
        if (plateCode) plateCode.textContent = msg.code;
        if (sendStateTag) {
          sendStateTag.textContent = 'Ready to pair';
          sendStateTag.style.color = '#10B981';
        }
        setStatusMsg(sendStatus, 'Share this code or QR with the receiver…');
        setRailActive(true, false);
        break;

      case 'peer-joined':
        if (sendStateTag) {
          sendStateTag.textContent = 'Receiver joined';
          sendStateTag.style.color = '#06B6D4';
        }
        setStatusMsg(sendStatus, 'Receiver joined! Negotiating direct WebRTC channel…');
        setRailActive(true, true);
        startSendPeerConnection();
        break;

      case 'signal':
        onSenderRemoteSignal(msg.data);
        break;

      case 'peer-left':
        if (sendStateTag) {
          sendStateTag.textContent = 'Disconnected';
          sendStateTag.style.color = '#EF4444';
        }
        setStatusMsg(sendStatus, 'The receiver disconnected.', 'err');
        setRailActive(false, false);
        break;

      case 'error':
        setStatusMsg(sendStatus, msg.message, 'err');
        createBtn.disabled = false;
        break;
    }
  }

  async function startSendPeerConnection() {
    sendPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    sendIceQueue = [];

    sendChannel = sendPC.createDataChannel('file', { ordered: true });
    sendChannel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW;

    sendPC.addEventListener('icecandidate', (e) => {
      if (e.candidate && sendSocket && sendSocket.readyState === WebSocket.OPEN) {
        sendSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'ice', payload: e.candidate } }));
      }
    });

    sendPC.addEventListener('connectionstatechange', () => {
      if (['failed', 'disconnected'].includes(sendPC.connectionState)) {
        setStatusMsg(sendStatus, 'Direct P2P connection lost.', 'err');
        setRailActive(false, false);
      }
    });

    sendChannel.addEventListener('open', () => {
      setStatusMsg(sendStatus, 'Direct P2P channel open! Streaming files…', 'ok');
      executeFileStreamSend();
    });

    const offer = await sendPC.createOffer();
    await sendPC.setLocalDescription(offer);
    sendSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'offer', payload: offer } }));
  }

  async function onSenderRemoteSignal(data) {
    if (!sendPC) return;

    if (data.kind === 'answer') {
      await sendPC.setRemoteDescription(new RTCSessionDescription(data.payload));
      while (sendIceQueue.length > 0) {
        const cand = sendIceQueue.shift();
        try { await sendPC.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
      }
    } else if (data.kind === 'ice' && data.payload) {
      if (!sendPC.remoteDescription) {
        sendIceQueue.push(data.payload);
      } else {
        try { await sendPC.addIceCandidate(new RTCIceCandidate(data.payload)); } catch { /* ignore */ }
      }
    }
  }

  function waitForBufferLow(channel) {
    if (channel.bufferedAmount <= BUFFERED_AMOUNT_HIGH) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (channel.bufferedAmount <= BUFFERED_AMOUNT_LOW) {
          channel.removeEventListener('bufferedamountlow', check);
          resolve();
        }
      };
      channel.addEventListener('bufferedamountlow', check);
    });
  }

  // Sender: Stream all staged files over WebRTC
  async function executeFileStreamSend() {
    const totalBytes = stagedFiles.reduce((sum, f) => sum + f.size, 0);
    const tracker = new RealtimeTransferTracker(totalBytes);
    let totalSent = 0;

    // Transition UI to Active Transfer Monitor
    if (senderStagingSection) senderStagingSection.hidden = true;
    if (sendTransferMonitor) sendTransferMonitor.hidden = false;
    if (sendOverallFilesCount) {
      sendOverallFilesCount.textContent = `${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}`;
    }

    renderFileBreakdown(sendFilesBreakdownList, stagedFiles, 0, 0);

    try {
      // 1. Send manifest packet so receiver knows the entire batch upfront
      const manifest = {
        type: 'manifest',
        totalFiles: stagedFiles.length,
        totalBytes: totalBytes,
        files: stagedFiles.map((f, i) => ({
          index: i,
          name: f.name,
          size: f.size,
          mime: f.type || 'application/octet-stream'
        }))
      };
      sendChannel.send(JSON.stringify(manifest));

      // 2. Stream files sequentially
      for (let i = 0; i < stagedFiles.length; i++) {
        const file = stagedFiles[i];
        if (senderAborted || !sendChannel || sendChannel.readyState !== 'open') {
          throw new Error('Transfer aborted');
        }

        // Meta packet for this file
        sendChannel.send(JSON.stringify({
          type: 'meta',
          fileIndex: i,
          totalFiles: stagedFiles.length,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream'
        }));

        let fileOffset = 0;
        let lastUiUpdate = Date.now();

        while (fileOffset < file.size) {
          if (senderAborted || !sendChannel || sendChannel.readyState !== 'open') {
            throw new Error('Transfer aborted');
          }

          await waitForBufferLow(sendChannel);
          const slice = file.slice(fileOffset, fileOffset + CHUNK_SIZE);
          const buf = await slice.arrayBuffer();
          sendChannel.send(buf);

          fileOffset += buf.byteLength;
          totalSent += buf.byteLength;

          // Throttle UI update to ~60ms for smooth 60fps rendering without DOM thrashing
          const now = Date.now();
          if (now - lastUiUpdate > 60 || fileOffset === file.size) {
            lastUiUpdate = now;
            const metrics = tracker.update(totalSent);

            if (sendOverallProgressBar) sendOverallProgressBar.style.width = `${metrics.pct}%`;
            if (sendOverallPctText) sendOverallPctText.textContent = `${metrics.pct}%`;
            if (sendTransferredBytesText) sendTransferredBytesText.textContent = metrics.transferredText;
            if (sendSpeedText) sendSpeedText.textContent = metrics.speedText;
            if (sendRemainingTimeText) sendRemainingTimeText.textContent = metrics.remainingText;

            renderFileBreakdown(sendFilesBreakdownList, stagedFiles, i, fileOffset);
          }
        }

        sendChannel.send(JSON.stringify({ type: 'file-end', fileIndex: i }));
      }

      // 3. Finalize
      sendChannel.send(JSON.stringify({ type: 'all-done' }));

      // Reveal Completion Screen
      if (sendTransferMonitor) sendTransferMonitor.hidden = true;
      if (sendCompletionCard) sendCompletionCard.hidden = false;

      if (sendCompletionSummary) {
        sendCompletionSummary.innerHTML = `
          <div class="summary-line">
            <span class="summary-label">Total Files Transferred:</span>
            <span class="summary-val">${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}</span>
          </div>
          <div class="summary-line">
            <span class="summary-label">Total Data Transferred:</span>
            <span class="summary-val">${fmtBytes(totalBytes)}</span>
          </div>
          <div class="summary-line">
            <span class="summary-label">Protocol:</span>
            <span class="summary-val">WebRTC Direct Stream (Encrypted)</span>
          </div>
        `;
      }

      setRailActive(true, true);
      showToast('All files transferred successfully!', 'success');
    } catch (err) {
      if (!senderAborted) {
        console.error('Send error:', err);
        showToast('Transfer failed or was interrupted.', 'error');
        resetSenderState();
      }
    }
  }

  // ============================================================
  // RECEIVER FLOW & WEBRTC ENGINE
  // ============================================================
  if (codeInput) {
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    });

    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        joinBtn.click();
      }
    });
  }

  if (pasteCodeBtn) {
    pasteCodeBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const clean = text.trim().toUpperCase().replace(/.*JOIN=/, '').replace(/[^A-Z0-9]/g, '').slice(0, 5);
          if (clean.length === 5) {
            codeInput.value = clean;
            showToast(`Pasted Call Sign: ${clean}`);
          } else {
            showToast('No valid 5-character Call Sign found in clipboard.', 'error');
          }
        }
      } catch {
        showToast('Clipboard access unavailable. Please paste manually.', 'error');
      }
    });
  }

  function resetReceiverState() {
    receiverAborted = true;
    if (recvSocket) {
      try { recvSocket.send(JSON.stringify({ type: 'cancel' })); } catch { /* ignore */ }
      recvSocket.close();
      recvSocket = null;
    }
    if (recvPC) {
      try { recvPC.close(); } catch { /* ignore */ }
      recvPC = null;
    }
    recvIceQueue = [];
    incomingManifest = null;
    activeIncomingFile = null;

    if (receiverFormSection) receiverFormSection.hidden = false;
    if (recvTransferMonitor) recvTransferMonitor.hidden = true;
    if (recvCompletionCard) recvCompletionCard.hidden = true;
    if (joinBtn) joinBtn.disabled = false;
    if (joinBtnText) joinBtnText.textContent = 'Connect';

    hideConnectionStatus();
    setRailActive(false, false);
  }

  if (statusCancelBtn) {
    statusCancelBtn.addEventListener('click', () => {
      resetReceiverState();
      showToast('Connection cancelled.');
    });
  }

  if (recvAbortBtn) {
    recvAbortBtn.addEventListener('click', () => {
      resetReceiverState();
      showToast('File transfer cancelled.');
    });
  }

  if (statusRetryBtn) {
    statusRetryBtn.addEventListener('click', () => {
      if (lastAttemptedCode) {
        initiateReceiverConnection(lastAttemptedCode);
      } else {
        codeInput.focus();
      }
    });
  }

  if (recvMoreFilesBtn) {
    recvMoreFilesBtn.addEventListener('click', () => {
      resetReceiverState();
      receivedFilesCollection = [];
      codeInput.value = '';
      codeInput.focus();
    });
  }

  if (recvCompletionHomeBtn) {
    recvCompletionHomeBtn.addEventListener('click', () => {
      resetReceiverState();
      receivedFilesCollection = [];
      codeInput.value = '';
      setTransferMode('both');
    });
  }

  // Connect button click
  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const code = (codeInput.value || '').trim().toUpperCase();
      if (code.length !== 5) {
        updateConnectionStatus('failed', 'Please enter a valid 5-character Call Sign.');
        showToast('Call Sign must be 5 characters.', 'error');
        return;
      }
      initiateReceiverConnection(code);
    });
  }

  function initiateReceiverConnection(code) {
    lastAttemptedCode = code;
    receiverAborted = false;
    joinBtn.disabled = true;
    if (joinBtnText) joinBtnText.textContent = 'Connecting…';

    updateConnectionStatus('connecting', `Connecting to sender with Call Sign ${code}…`);

    recvSocket = new WebSocket(wsUrl());

    recvSocket.addEventListener('open', () => {
      recvSocket.send(JSON.stringify({ type: 'join', code }));
    });

    recvSocket.addEventListener('message', (evt) => {
      try {
        handleReceiverSignal(JSON.parse(evt.data));
      } catch (err) {
        console.error('Recv signal parse error:', err);
      }
    });

    recvSocket.addEventListener('close', () => {
      if (!receiverAborted && (!recvPC || !['connected', 'completed'].includes(recvPC.connectionState))) {
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
      }
    });
  }

  async function handleReceiverSignal(msg) {
    switch (msg.type) {
      case 'joined':
        updateConnectionStatus('connecting', 'Joined room! Waiting for sender to initiate WebRTC stream…');
        setRailActive(true, true);
        setupReceiverPeerConnection();
        break;

      case 'signal':
        await onReceiverRemoteSignal(msg.data);
        break;

      case 'peer-left':
        updateConnectionStatus('disconnected', 'The sender disconnected.');
        setRailActive(false, false);
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
        break;

      case 'error':
        updateConnectionStatus('failed', msg.message);
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
        showToast(msg.message, 'error');
        break;
    }
  }

  function setupReceiverPeerConnection() {
    recvPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    recvIceQueue = [];

    recvPC.addEventListener('icecandidate', (e) => {
      if (e.candidate && recvSocket && recvSocket.readyState === WebSocket.OPEN) {
        recvSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'ice', payload: e.candidate } }));
      }
    });

    recvPC.addEventListener('connectionstatechange', () => {
      if (recvPC.connectionState === 'connected') {
        updateConnectionStatus('connected', 'Direct P2P channel active. Receiving file stream…');
      } else if (['failed', 'disconnected'].includes(recvPC.connectionState)) {
        updateConnectionStatus('failed', 'Direct WebRTC connection failed. Network may be blocking P2P streams.');
        setRailActive(false, false);
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
      }
    });

    recvPC.addEventListener('datachannel', (e) => {
      const channel = e.channel;
      channel.binaryType = 'arraybuffer';
      channel.addEventListener('message', (evt) => handleReceiverIncomingData(evt.data));
      channel.addEventListener('open', () => {
        updateConnectionStatus('connected', 'Encrypted data channel open! Receiving file data…');
      });
    });
  }

  async function onReceiverRemoteSignal(data) {
    if (!recvPC) setupReceiverPeerConnection();

    if (data.kind === 'offer') {
      await recvPC.setRemoteDescription(new RTCSessionDescription(data.payload));
      while (recvIceQueue.length > 0) {
        const cand = recvIceQueue.shift();
        try { await recvPC.addIceCandidate(new RTCIceCandidate(cand)); } catch { /* ignore */ }
      }
      const answer = await recvPC.createAnswer();
      await recvPC.setLocalDescription(answer);
      recvSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'answer', payload: answer } }));
    } else if (data.kind === 'ice' && data.payload) {
      if (!recvPC.remoteDescription) {
        recvIceQueue.push(data.payload);
      } else {
        try { await recvPC.addIceCandidate(new RTCIceCandidate(data.payload)); } catch { /* ignore */ }
      }
    }
  }

  // Receiver Data Stream Handler
  let receiverTracker = null;
  let totalReceivedBytes = 0;
  let lastReceiverUiUpdate = 0;

  function handleReceiverIncomingData(data) {
    // 1. Text control messages
    if (typeof data === 'string') {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      if (msg.type === 'manifest') {
        incomingManifest = msg;
        totalReceivedBytes = 0;
        receiverTracker = new RealtimeTransferTracker(msg.totalBytes);

        // Switch to receiver transfer monitor
        if (receiverFormSection) receiverFormSection.hidden = true;
        if (recvTransferMonitor) recvTransferMonitor.hidden = false;
        if (recvOverallFilesCount) {
          recvOverallFilesCount.textContent = `${msg.files.length} file${msg.files.length > 1 ? 's' : ''}`;
        }

        renderFileBreakdown(recvFilesBreakdownList, msg.files, 0, 0);
        updateConnectionStatus('transferring', `Receiving ${msg.files.length} files (${fmtBytes(msg.totalBytes)})…`);
      } else if (msg.type === 'meta') {
        activeIncomingFile = {
          fileIndex: msg.fileIndex,
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
          chunks: [],
          receivedBytes: 0
        };
        const manifestFiles = incomingManifest ? incomingManifest.files : [{ name: msg.name, size: msg.size }];
        renderFileBreakdown(recvFilesBreakdownList, manifestFiles, msg.fileIndex, 0);
      } else if (msg.type === 'file-end') {
        finalizeIncomingFile();
      } else if (msg.type === 'all-done') {
        finalizeAllIncomingTransfers();
      }
      return;
    }

    // 2. Binary ArrayBuffer chunks
    if (!activeIncomingFile) return;

    activeIncomingFile.chunks.push(data);
    activeIncomingFile.receivedBytes += data.byteLength;
    totalReceivedBytes += data.byteLength;

    const now = Date.now();
    if (now - lastReceiverUiUpdate > 60) {
      lastReceiverUiUpdate = now;

      if (receiverTracker) {
        const metrics = receiverTracker.update(totalReceivedBytes);

        if (recvOverallProgressBar) recvOverallProgressBar.style.width = `${metrics.pct}%`;
        if (recvOverallPctText) recvOverallPctText.textContent = `${metrics.pct}%`;
        if (recvTransferredBytesText) recvTransferredBytesText.textContent = metrics.transferredText;
        if (recvSpeedText) recvSpeedText.textContent = metrics.speedText;
        if (recvRemainingTimeText) recvRemainingTimeText.textContent = metrics.remainingText;
      }

      const manifestFiles = incomingManifest ? incomingManifest.files : [{ name: activeIncomingFile.name, size: activeIncomingFile.size }];
      renderFileBreakdown(recvFilesBreakdownList, manifestFiles, activeIncomingFile.fileIndex, activeIncomingFile.receivedBytes);
    }
  }

  function finalizeIncomingFile() {
    if (!activeIncomingFile) return;

    const blob = new Blob(activeIncomingFile.chunks, { type: activeIncomingFile.mime });
    const url = URL.createObjectURL(blob);

    receivedFilesCollection.push({
      name: activeIncomingFile.name,
      size: activeIncomingFile.size,
      mime: activeIncomingFile.mime,
      blob,
      url
    });

    // Auto-download file
    const a = document.createElement('a');
    a.href = url;
    a.download = activeIncomingFile.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    activeIncomingFile = null;
  }

  function finalizeAllIncomingTransfers() {
    updateConnectionStatus('completed', 'All files downloaded successfully.');
    if (recvTransferMonitor) recvTransferMonitor.hidden = true;
    if (recvCompletionCard) recvCompletionCard.hidden = false;

    if (recvFileList) {
      recvFileList.innerHTML = '';
      receivedFilesCollection.forEach(item => {
        const li = document.createElement('li');
        li.className = 'file-item';
        li.innerHTML = `
          <div class="file-item-left">
            <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          </div>
          <div class="file-meta">
            <span class="file-size">${fmtBytes(item.size)}</span>
            <a href="${item.url}" download="${escapeHtml(item.name)}" class="btn-download-single">Save</a>
          </div>
        `;
        recvFileList.appendChild(li);
      });
    }

    showToast('All files downloaded successfully!', 'success');
  }

  // Batch download all received blobs
  if (downloadAllFilesBtn) {
    downloadAllFilesBtn.addEventListener('click', () => {
      if (!receivedFilesCollection.length) return;
      receivedFilesCollection.forEach((item, index) => {
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = item.url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, index * 250); // slight stagger to ensure browser handles multiple downloads cleanly
      });
      showToast('Downloading all received files…');
    });
  }

  // ============================================================
  // CAMERA QR SCANNER MODAL (FOR RECEIVER)
  // ============================================================
  if (scanQrBtn) {
    scanQrBtn.addEventListener('click', () => {
      openQrScannerModal();
    });
  }

  if (closeQrModalBtn) {
    closeQrModalBtn.addEventListener('click', () => {
      closeQrScannerModal();
    });
  }

  async function openQrScannerModal() {
    if (!qrScannerModal) return;
    qrScannerModal.hidden = false;
    if (scannerStatusText) scannerStatusText.textContent = 'Starting camera…';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (scannerStatusText) {
        scannerStatusText.textContent = 'Camera not supported in this browser. Please use the image upload button below or enter the code manually.';
      }
      return;
    }

    try {
      qrCameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      if (qrVideo) {
        qrVideo.srcObject = qrCameraStream;
        await qrVideo.play();
        if (scannerStatusText) {
          scannerStatusText.textContent = 'Point camera at sender QR code…';
        }
        startQrDetectionLoop();
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      if (scannerStatusText) {
        scannerStatusText.textContent = 'Camera permission denied or camera not found. Please upload a screenshot or enter code manually.';
      }
    }
  }

  function closeQrScannerModal() {
    if (qrScanAnimationId) {
      cancelAnimationFrame(qrScanAnimationId);
      qrScanAnimationId = null;
    }
    if (qrCameraStream) {
      qrCameraStream.getTracks().forEach(track => track.stop());
      qrCameraStream = null;
    }
    if (qrVideo) qrVideo.srcObject = null;
    if (qrScannerModal) qrScannerModal.hidden = true;
  }

  // Native BarcodeDetector support loop
  async function startQrDetectionLoop() {
    if (!('BarcodeDetector' in window)) {
      if (scannerStatusText) {
        scannerStatusText.textContent = 'Scanning active (use your native camera app or upload an image if automatic detection is unavailable).';
      }
      return;
    }

    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      async function scanFrame() {
        if (!qrVideo || qrVideo.readyState < 2 || !qrCameraStream) return;
        try {
          const codes = await detector.detect(qrVideo);
          if (codes && codes.length > 0) {
            const rawVal = codes[0].rawValue;
            handleScannedQrResult(rawVal);
            return;
          }
        } catch {
          // ignore detection tick errors
        }
        qrScanAnimationId = requestAnimationFrame(scanFrame);
      }

      qrScanAnimationId = requestAnimationFrame(scanFrame);
    } catch (e) {
      console.warn('BarcodeDetector error:', e);
    }
  }

  function handleScannedQrResult(resultText) {
    closeQrScannerModal();
    const clean = (resultText || '').toUpperCase().replace(/.*JOIN=/, '').replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (clean.length === 5) {
      codeInput.value = clean;
      showToast(`QR Code scanned: ${clean}! Connecting…`, 'success');
      setTransferMode('recv');
      setTimeout(() => joinBtn.click(), 300);
    } else {
      showToast('Could not find a valid 5-character Call Sign in this QR code.', 'error');
    }
  }

  // Scan from uploaded file / screenshot fallback
  if (qrFileInput) {
    qrFileInput.addEventListener('change', async () => {
      if (!qrFileInput.files || !qrFileInput.files[0]) return;
      const file = qrFileInput.files[0];

      if ('BarcodeDetector' in window) {
        try {
          const imgBitmap = await createImageBitmap(file);
          const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          const barcodes = await detector.detect(imgBitmap);
          if (barcodes.length > 0) {
            handleScannedQrResult(barcodes[0].rawValue);
            return;
          }
        } catch (e) {
          console.warn('Bitmap scan error:', e);
        }
      }
      showToast('Could not automatically decode QR code. Please enter the 5-character code manually.', 'error');
    });
  }

  // ============================================================
  // URL HASH ROUTING (AUTO-CONNECT & DIRECT LINKS)
  // ============================================================
  function checkUrlHash() {
    const hash = location.hash;
    if (hash.startsWith('#join=')) {
      const code = hash.replace('#join=', '').toUpperCase().slice(0, 5);
      if (codeInput) codeInput.value = code;
      switchTab('transfer');
      setTransferMode('recv');
      showToast(`Call sign ${code} loaded! Click Connect.`, 'success');
      setTimeout(() => codeInput.focus(), 300);
    } else if (hash === '#community') {
      switchTab('community');
    }
  }

  window.addEventListener('hashchange', checkUrlHash);
  checkUrlHash();

})();
