(() => {
  'use strict';

  // ---- Configuration ----
  const CHUNK_SIZE = 16 * 1024; // 16KB per WebRTC data channel chunk
  const BUFFERED_AMOUNT_HIGH = 1 * 1024 * 1024; // 1MB pause threshold
  const BUFFERED_AMOUNT_LOW = 256 * 1024; // 256KB resume threshold

  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // ---- DOM Elements ----
  // Toast
  const toastContainer = document.getElementById('toastContainer');

  // Navigation
  const tabTransferBtn = document.getElementById('tabTransferBtn');
  const tabCommunityBtn = document.getElementById('tabCommunityBtn');
  const transferTabPane = document.getElementById('transferTabPane');
  const communityTabPane = document.getElementById('communityTabPane');
  const communityCountBadge = document.getElementById('communityCountBadge');
  const onlineCountText = document.getElementById('onlineCountText');

  // Transfer Mode Switcher
  const modeBothBtn = document.getElementById('modeBothBtn');
  const modeSendBtn = document.getElementById('modeSendBtn');
  const modeRecvBtn = document.getElementById('modeRecvBtn');
  const transferGrid = document.getElementById('transferGrid');
  const sendCard = document.getElementById('sendCard');
  const recvCard = document.getElementById('recvCard');

  // P2P Signal Rail
  const nodeSend = document.getElementById('nodeSend');
  const nodeRecv = document.getElementById('nodeRecv');
  const pulse = document.getElementById('pulse');

  // Send Side
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
  const sendPctText = document.getElementById('sendPctText');
  const sendProgress = document.getElementById('sendProgress');
  const sendProgressBar = document.getElementById('sendProgressBar');

  // Receive Side
  const codeInput = document.getElementById('codeInput');
  const pasteCodeBtn = document.getElementById('pasteCodeBtn');
  const joinBtn = document.getElementById('joinBtn');
  const joinBtnText = document.getElementById('joinBtnText');
  const recvActionRow = document.getElementById('recvActionRow');
  const cancelRecvBtn = document.getElementById('cancelRecvBtn');
  const recvStatus = document.getElementById('recvStatus');
  const recvPctText = document.getElementById('recvPctText');
  const recvProgress = document.getElementById('recvProgress');
  const recvProgressBar = document.getElementById('recvProgressBar');
  const recvFileList = document.getElementById('recvFileList');

  // Community Wall
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

  // ---- State ----
  let allCommunityPosts = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let mainSocket = null;

  // ============================================================
  // UTILITY HELPERS
  // ============================================================
  function wsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function fmtBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
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
    return `hsl(${h}, 70%, 45%)`;
  }

  function getInitials(name) {
    const parts = (name || 'Anonymous').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (parts[0].slice(0, 2) || 'AN').toUpperCase();
  }

  // Toast notifications
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

  // Robust Clipboard copy with fallback
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

  // Visual Rail Control
  function setRailActive(sendOn, recvOn) {
    if (nodeSend) nodeSend.classList.toggle('active', sendOn);
    if (nodeRecv) nodeRecv.classList.toggle('active', recvOn);
    if (pulse) pulse.classList.toggle('traveling', sendOn && recvOn);
  }

  function setStatus(el, text, kind) {
    if (!el) return;
    el.textContent = text;
    el.className = 'status-msg' + (kind ? ` ${kind}` : '');
  }

  // ============================================================
  // TAB NAVIGATION
  // ============================================================
  function switchTab(tab) {
    if (tab === 'community') {
      tabCommunityBtn.classList.add('active');
      tabTransferBtn.classList.remove('active');
      communityTabPane.classList.add('active');
      transferTabPane.classList.remove('active');
      location.hash = 'community';
    } else {
      tabTransferBtn.classList.add('active');
      tabCommunityBtn.classList.remove('active');
      transferTabPane.classList.add('active');
      communityTabPane.classList.remove('active');
      location.hash = 'transfer';
    }
  }

  tabTransferBtn.addEventListener('click', () => switchTab('transfer'));
  tabCommunityBtn.addEventListener('click', () => switchTab('community'));

  // ============================================================
  // TRANSFER MODE SWITCHER (ALL / SEND ONLY / RECEIVE ONLY)
  // ============================================================
  function setTransferMode(mode) {
    if (!modeBothBtn || !modeSendBtn || !modeRecvBtn || !transferGrid) return;
    modeBothBtn.classList.toggle('active', mode === 'both');
    modeSendBtn.classList.toggle('active', mode === 'send');
    modeRecvBtn.classList.toggle('active', mode === 'recv');

    transferGrid.classList.remove('mode-send', 'mode-recv');
    if (mode === 'send') transferGrid.classList.add('mode-send');
    if (mode === 'recv') transferGrid.classList.add('mode-recv');
  }

  if (modeBothBtn) modeBothBtn.addEventListener('click', () => setTransferMode('both'));
  if (modeSendBtn) modeSendBtn.addEventListener('click', () => setTransferMode('send'));
  if (modeRecvBtn) modeRecvBtn.addEventListener('click', () => setTransferMode('recv'));

  // On small mobile screens (<768px), default to Send mode initially
  if (window.innerWidth < 768) {
    setTransferMode('send');
  }

  // ============================================================
  // GLOBAL REAL-TIME WEBSOCKET (COMMUNITY + STATS)
  // ============================================================
  function connectMainSocket() {
    try {
      mainSocket = new WebSocket(wsUrl());

      mainSocket.addEventListener('open', () => {
        if (onlineCountText) onlineCountText.textContent = 'Connected';
        // Request community list
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
          if (msg.post) {
            // Check if already present
            if (!allCommunityPosts.some(p => p.id === msg.post.id)) {
              allCommunityPosts.unshift(msg.post);
              renderCommunityPosts();
              showToast(`New ${msg.post.tag} from ${msg.post.author}!`, 'success');
            }
          }
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
  // COMMUNITY WALL LOGIC
  // ============================================================
  // Load stored author name
  const savedAuthor = localStorage.getItem('p2p_author_name') || '';
  if (authorInput && savedAuthor) {
    authorInput.value = savedAuthor;
  }

  // Tag selector click handling
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
      charCount.textContent = `${len.toLocaleString()} / 20,000`;
    });
  }

  // Fetch initial community posts via REST
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

  // Filter chips click
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderCommunityPosts();
    });
  });

  // Search input
  if (communitySearchInput) {
    communitySearchInput.addEventListener('input', () => {
      searchQuery = communitySearchInput.value.trim().toLowerCase();
      if (clearSearchBtn) {
        clearSearchBtn.hidden = searchQuery.length === 0;
      }
      renderCommunityPosts();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      communitySearchInput.value = '';
      searchQuery = '';
      clearSearchBtn.hidden = true;
      renderCommunityPosts();
      communitySearchInput.focus();
    });
  }

  if (refreshFeedBtn) {
    refreshFeedBtn.addEventListener('click', () => {
      fetchCommunityPosts();
      showToast('Refreshing community posts…');
    });
  }

  // Render Community Posts
  function renderCommunityPosts() {
    if (!communityPostsList) return;

    let filtered = allCommunityPosts;

    if (currentFilter !== 'all') {
      filtered = filtered.filter(p => p.tag === currentFilter);
    }

    if (searchQuery) {
      filtered = filtered.filter(p =>
        (p.author && p.author.toLowerCase().includes(searchQuery)) ||
        (p.text && p.text.toLowerCase().includes(searchQuery)) ||
        (p.tag && p.tag.toLowerCase().includes(searchQuery))
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
          <p>No community snippets match your filter or search.</p>
        </div>
      `;
      return;
    }

    communityPostsList.innerHTML = filtered.map(post => {
      const avatarColor = getAvatarColor(post.author || 'Anonymous');
      const initials = getInitials(post.author || 'Anonymous');
      const relTime = formatRelativeTime(post.createdAt || Date.now());
      const charLen = (post.text || '').length;
      const wordLen = (post.text || '').trim().split(/\s+/).filter(Boolean).length;

      return `
        <article class="post-card" data-post-id="${escapeHtml(post.id)}">
          <div class="post-card-top">
            <div class="post-author-group">
              <div class="author-avatar" style="background-color: ${avatarColor};">
                ${escapeHtml(initials)}
              </div>
              <div class="author-details">
                <span class="author-name">${escapeHtml(post.author || 'Anonymous')}</span>
                <span class="post-time">${relTime}</span>
              </div>
            </div>
            <span class="post-tag-badge tag-${escapeHtml(post.tag || 'Note')}">${escapeHtml(post.tag || 'Note')}</span>
          </div>

          <div class="post-content-wrap">
            <pre class="post-content-text"><code>${escapeHtml(post.text)}</code></pre>
          </div>

          <div class="post-card-bottom">
            <span class="post-stats-text">${charLen.toLocaleString()} chars · ${wordLen.toLocaleString()} words</span>
            <button type="button" class="btn-copy-snippet" data-content="${encodeURIComponent(post.text)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy Text</span>
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Attach copy event listeners
    communityPostsList.querySelectorAll('.btn-copy-snippet').forEach(btn => {
      btn.addEventListener('click', async () => {
        const raw = decodeURIComponent(btn.dataset.content || '');
        const success = await copyToClipboard(raw);
        if (success) {
          btn.classList.add('copied');
          btn.querySelector('span').textContent = '✓ Copied!';
          if (navigator.vibrate) navigator.vibrate(30);
          showToast('Snippet copied to clipboard!', 'success');
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.querySelector('span').textContent = 'Copy Text';
          }, 2000);
        } else {
          showToast('Failed to copy to clipboard', 'error');
        }
      });
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
        showToast('Please enter some text or code to share', 'error');
        return;
      }

      // Save author handle to localStorage
      localStorage.setItem('p2p_author_name', author);

      submitSnippetBtn.disabled = true;
      submitSnippetBtn.querySelector('span').textContent = 'Publishing…';

      try {
        const response = await fetch('/api/community', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author, text, tag })
        });

        if (response.ok) {
          const resData = await response.json();
          snippetTextInput.value = '';
          if (charCount) charCount.textContent = '0 / 20,000';
          showToast('Published to community wall!', 'success');

          if (resData.post && !allCommunityPosts.some(p => p.id === resData.post.id)) {
            allCommunityPosts.unshift(resData.post);
            renderCommunityPosts();
          }
        } else {
          showToast('Error publishing snippet', 'error');
        }
      } catch (err) {
        console.error('Error publishing:', err);
        // Fallback to WebSocket
        if (mainSocket && mainSocket.readyState === WebSocket.OPEN) {
          mainSocket.send(JSON.stringify({
            type: 'community-post',
            author,
            text,
            tag
          }));
          snippetTextInput.value = '';
          showToast('Published via WebSocket!', 'success');
        } else {
          showToast('Failed to reach server', 'error');
        }
      } finally {
        submitSnippetBtn.disabled = false;
        submitSnippetBtn.querySelector('span').textContent = 'Publish Snippet';
      }
    });
  }

  // Periodically refresh relative times
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
  // P2P FILE TRANSFER LOGIC (ROBUST WEBRTC)
  // ============================================================
  let selectedFiles = [];
  let sendSocket = null;
  let sendPC = null;
  let sendChannel = null;
  let sendIceQueue = [];
  let transferDoneSend = false;

  // Render Staged Files List (Separated from dropZone)
  function renderFileList() {
    if (!fileListEl || !selectedFilesCard || !createBtn) return;
    fileListEl.innerHTML = '';
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);

    if (selectedFiles.length === 0) {
      selectedFilesCard.hidden = true;
      createBtn.disabled = true;
      return;
    }

    selectedFilesCard.hidden = false;
    selectedCountText.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} staged (${fmtBytes(totalBytes)})`;
    createBtn.disabled = false;

    selectedFiles.forEach((f, idx) => {
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
          <button type="button" class="file-remove-btn" data-index="${idx}" title="Remove this file">✕</button>
        </div>
      `;
      fileListEl.appendChild(li);
    });

    fileListEl.querySelectorAll('.file-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        selectedFiles.splice(idx, 1);
        renderFileList();
      });
    });
  }

  if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', () => {
      selectedFiles = [];
      fileInput.value = '';
      renderFileList();
      showToast('Staged files cleared');
    });
  }

  // Dropzone click & drag handlers
  if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragover', 'dragenter'].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      })
    );

    ['dragleave', 'drop'].forEach((evt) =>
      dropZone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
      })
    );

    dropZone.addEventListener('drop', (e) => {
      const dropped = Array.from(e.dataTransfer.files || []);
      if (dropped.length) {
        selectedFiles = selectedFiles.concat(dropped);
        renderFileList();
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        const newFiles = Array.from(fileInput.files);
        selectedFiles = selectedFiles.concat(newFiles);
        renderFileList();
      }
    });
  }

  // Reset Send State
  function resetSendState() {
    if (sendSocket) {
      try { sendSocket.send(JSON.stringify({ type: 'cancel' })); } catch { /* ignore */ }
      sendSocket.close();
      sendSocket = null;
    }
    if (sendPC) {
      sendPC.close();
      sendPC = null;
    }
    sendChannel = null;
    sendIceQueue = [];
    transferDoneSend = false;

    if (callsignPlate) callsignPlate.hidden = true;
    if (qrContainer) qrContainer.hidden = true;
    if (plateCode) plateCode.textContent = '-----';
    if (createBtn) createBtn.disabled = selectedFiles.length === 0;
    if (sendProgress) sendProgress.hidden = true;
    if (sendProgressBar) sendProgressBar.style.width = '0%';
    if (sendPctText) sendPctText.hidden = true;
    setStatus(sendStatus, '');
    setRailActive(false, false);
  }

  if (cancelSendBtn) {
    cancelSendBtn.addEventListener('click', () => {
      resetSendState();
      showToast('Transfer session reset');
    });
  }

  // Call Sign Generation
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      if (!selectedFiles.length) return;
      createBtn.disabled = true;
      setStatus(sendStatus, 'Requesting call sign from signaling server…');
      if (sendProgress) sendProgress.hidden = true;
      if (sendProgressBar) sendProgressBar.style.width = '0%';
      if (sendPctText) sendPctText.hidden = true;

      sendSocket = new WebSocket(wsUrl());

      sendSocket.addEventListener('open', () => {
        sendSocket.send(JSON.stringify({ type: 'create' }));
      });

      sendSocket.addEventListener('message', (evt) => {
        try {
          handleSendSignal(JSON.parse(evt.data));
        } catch (err) {
          console.error('Send signal parse error:', err);
        }
      });

      sendSocket.addEventListener('close', () => {
        if (!transferDoneSend) {
          setStatus(sendStatus, 'Signaling connection closed.', 'err');
          setRailActive(false, false);
          createBtn.disabled = false;
        }
      });
    });
  }

  // Copy Call Sign
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const code = plateCode.textContent;
      const success = await copyToClipboard(code);
      if (success) {
        copyBtn.classList.add('copied');
        if (copyBtnText) copyBtnText.textContent = 'Copied!';
        showToast(`Call sign ${code} copied to clipboard!`);
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copyBtnText) copyBtnText.textContent = 'Copy Code';
        }, 2000);
      }
    });
  }

  // Copy Direct Link
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', async () => {
      const code = plateCode.textContent;
      const directUrl = `${location.origin}/#join=${code}`;
      const success = await copyToClipboard(directUrl);
      if (success) {
        copyLinkBtn.classList.add('copied');
        if (copyLinkBtnText) copyLinkBtnText.textContent = 'Copied Link!';
        showToast('Direct link copied! Send this to recipient.');
        setTimeout(() => {
          copyLinkBtn.classList.remove('copied');
          if (copyLinkBtnText) copyLinkBtnText.textContent = 'Copy Link';
        }, 2000);
      }
    });
  }

  // Toggle QR Code
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

  function handleSendSignal(msg) {
    switch (msg.type) {
      case 'created':
        if (callsignPlate) callsignPlate.hidden = false;
        if (plateCode) plateCode.textContent = msg.code;
        if (sendStateTag) {
          sendStateTag.textContent = 'Ready to pair';
          sendStateTag.style.color = '#6EE7B7';
        }
        setStatus(sendStatus, 'Share this call sign or direct link with recipient…');
        setRailActive(true, false);
        break;

      case 'peer-joined':
        if (sendStateTag) {
          sendStateTag.textContent = 'Peer connected';
          sendStateTag.style.color = '#22D3EE';
        }
        setStatus(sendStatus, 'Recipient connected! Negotiating direct WebRTC channel…');
        setRailActive(true, true);
        startSendPeerConnection();
        break;

      case 'signal':
        onSendRemoteSignal(msg.data);
        break;

      case 'peer-left':
        if (sendStateTag) {
          sendStateTag.textContent = 'Disconnected';
          sendStateTag.style.color = '#FDA4AF';
        }
        setStatus(sendStatus, 'The recipient disconnected.', 'err');
        setRailActive(false, false);
        break;

      case 'error':
        setStatus(sendStatus, msg.message, 'err');
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
        setStatus(sendStatus, 'Direct connection lost. Network may be blocking P2P traffic.', 'err');
        setRailActive(false, false);
      }
    });

    sendChannel.addEventListener('open', () => {
      setStatus(sendStatus, 'Direct P2P channel established! Streaming files…', 'ok');
      sendAllFiles();
    });

    const offer = await sendPC.createOffer();
    await sendPC.setLocalDescription(offer);
    sendSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'offer', payload: offer } }));
  }

  async function onSendRemoteSignal(data) {
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

  async function sendAllFiles() {
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    let sentBytes = 0;
    if (sendProgress) sendProgress.hidden = false;
    if (sendPctText) sendPctText.hidden = false;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (sendChannel.readyState !== 'open') throw new Error('Channel closed');

        sendChannel.send(JSON.stringify({
          type: 'meta',
          fileIndex: i,
          totalFiles: selectedFiles.length,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
        }));

        let offset = 0;
        while (offset < file.size) {
          if (sendChannel.readyState !== 'open') throw new Error('Channel closed');
          await waitForBufferLow(sendChannel);
          const slice = file.slice(offset, offset + CHUNK_SIZE);
          const buf = await slice.arrayBuffer();
          sendChannel.send(buf);
          offset += buf.byteLength;
          sentBytes += buf.byteLength;

          const pct = Math.min(100, Math.round((sentBytes / totalBytes) * 100));
          if (sendProgressBar) sendProgressBar.style.width = `${pct}%`;
          if (sendPctText) sendPctText.textContent = `${pct}%`;
          setStatus(sendStatus, `Sending "${file.name}" (${fmtBytes(sentBytes)} / ${fmtBytes(totalBytes)})…`, 'ok');
        }

        sendChannel.send(JSON.stringify({ type: 'file-end', fileIndex: i }));
      }

      sendChannel.send(JSON.stringify({ type: 'all-done' }));
      transferDoneSend = true;
      if (sendProgressBar) sendProgressBar.style.width = '100%';
      if (sendPctText) sendPctText.textContent = '100%';
      setStatus(sendStatus, 'All files transferred successfully!', 'ok');
      setRailActive(true, true);
      showToast('All files sent successfully!', 'success');
    } catch (err) {
      console.error('Send error:', err);
      setStatus(sendStatus, 'Transfer failed or was interrupted.', 'err');
    }
  }

  // ============================================================
  // RECEIVE SIDE LOGIC
  // ============================================================
  let recvSocket = null;
  let recvPC = null;
  let recvIceQueue = [];
  let incoming = null;

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
            showToast(`Pasted call sign ${clean}`);
          } else {
            showToast('No valid 5-character code found in clipboard', 'error');
          }
        }
      } catch {
        showToast('Clipboard access unavailable. Please paste manually.', 'error');
      }
    });
  }

  function resetRecvState() {
    if (recvSocket) {
      try { recvSocket.send(JSON.stringify({ type: 'cancel' })); } catch { /* ignore */ }
      recvSocket.close();
      recvSocket = null;
    }
    if (recvPC) {
      recvPC.close();
      recvPC = null;
    }
    recvIceQueue = [];
    incoming = null;

    if (joinBtn) joinBtn.disabled = false;
    if (joinBtnText) joinBtnText.textContent = 'Connect';
    if (recvActionRow) recvActionRow.hidden = true;
    if (recvProgress) recvProgress.hidden = true;
    if (recvProgressBar) recvProgressBar.style.width = '0%';
    if (recvPctText) recvPctText.hidden = true;
    setStatus(recvStatus, '');
    setRailActive(false, false);
  }

  if (cancelRecvBtn) {
    cancelRecvBtn.addEventListener('click', () => {
      resetRecvState();
      showToast('Connection cancelled');
    });
  }

  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const code = (codeInput.value || '').trim();
      if (code.length !== 5) {
        setStatus(recvStatus, 'Please enter the full 5-character call sign.', 'err');
        return;
      }

      joinBtn.disabled = true;
      if (joinBtnText) joinBtnText.textContent = 'Connecting…';
      if (recvActionRow) recvActionRow.hidden = false;
      setStatus(recvStatus, `Connecting to call sign ${code}…`);

      recvSocket = new WebSocket(wsUrl());

      recvSocket.addEventListener('open', () => {
        recvSocket.send(JSON.stringify({ type: 'join', code }));
      });

      recvSocket.addEventListener('message', (evt) => {
        try {
          handleRecvSignal(JSON.parse(evt.data));
        } catch (err) {
          console.error('Recv signal parse error:', err);
        }
      });

      recvSocket.addEventListener('close', () => {
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
      });
    });
  }

  async function handleRecvSignal(msg) {
    switch (msg.type) {
      case 'joined':
        setStatus(recvStatus, 'Joined room! Waiting for sender to start WebRTC…');
        setRailActive(true, true);
        setupRecvPeerConnection();
        break;

      case 'signal':
        await onRecvRemoteSignal(msg.data);
        break;

      case 'peer-left':
        setStatus(recvStatus, 'The sender disconnected.', 'err');
        setRailActive(false, false);
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
        break;

      case 'error':
        setStatus(recvStatus, msg.message, 'err');
        joinBtn.disabled = false;
        if (joinBtnText) joinBtnText.textContent = 'Connect';
        if (recvActionRow) recvActionRow.hidden = true;
        break;
    }
  }

  function setupRecvPeerConnection() {
    recvPC = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    recvIceQueue = [];

    recvPC.addEventListener('icecandidate', (e) => {
      if (e.candidate && recvSocket && recvSocket.readyState === WebSocket.OPEN) {
        recvSocket.send(JSON.stringify({ type: 'signal', data: { kind: 'ice', payload: e.candidate } }));
      }
    });

    recvPC.addEventListener('connectionstatechange', () => {
      if (['failed', 'disconnected'].includes(recvPC.connectionState)) {
        setStatus(recvStatus, 'Direct connection failed or was blocked by firewall.', 'err');
        setRailActive(false, false);
      }
    });

    recvPC.addEventListener('datachannel', (e) => {
      const channel = e.channel;
      channel.binaryType = 'arraybuffer';
      channel.addEventListener('message', (evt) => handleIncomingData(evt.data));
      channel.addEventListener('open', () => {
        setStatus(recvStatus, 'Direct P2P channel established! Receiving…', 'ok');
        if (recvProgress) recvProgress.hidden = false;
        if (recvPctText) recvPctText.hidden = false;
      });
    });
  }

  async function onRecvRemoteSignal(data) {
    if (!recvPC) setupRecvPeerConnection();

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

  function handleIncomingData(data) {
    if (typeof data === 'string') {
      const msg = JSON.parse(data);
      if (msg.type === 'meta') {
        incoming = { name: msg.name, size: msg.size, mime: msg.mime, chunks: [], received: 0 };
        setStatus(recvStatus, `Receiving "${msg.name}" (${fmtBytes(msg.size)})…`, 'ok');
      } else if (msg.type === 'file-end') {
        finalizeIncomingFile();
      } else if (msg.type === 'all-done') {
        setStatus(recvStatus, 'All incoming files received successfully!', 'ok');
        if (recvProgressBar) recvProgressBar.style.width = '100%';
        if (recvPctText) recvPctText.textContent = '100%';
        showToast('All files downloaded successfully!', 'success');
      }
      return;
    }

    if (!incoming) return;
    incoming.chunks.push(data);
    incoming.received += data.byteLength;
    const pct = incoming.size ? Math.min(100, Math.round((incoming.received / incoming.size) * 100)) : 0;
    if (recvProgressBar) recvProgressBar.style.width = `${pct}%`;
    if (recvPctText) recvPctText.textContent = `${pct}%`;
    setStatus(recvStatus, `Receiving "${incoming.name}" (${pct}%)…`, 'ok');
  }

  function finalizeIncomingFile() {
    if (!incoming) return;
    const blob = new Blob(incoming.chunks, { type: incoming.mime });
    const url = URL.createObjectURL(blob);

    const emptyNotice = recvFileList.querySelector('.empty-list-notice');
    if (emptyNotice) emptyNotice.remove();

    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <div class="file-item-left">
        <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span class="file-name">${escapeHtml(incoming.name)}</span>
      </div>
      <div class="file-meta">
        <span class="file-size">${fmtBytes(incoming.size)}</span>
        <a href="${url}" download="${escapeHtml(incoming.name)}" class="btn-icon-labeled" title="Save file to disk">Save</a>
      </div>
    `;
    recvFileList.appendChild(li);

    // Auto trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = incoming.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    incoming = null;
  }

  // Handle URL parameters or hashes (e.g. #community or #join=CODE)
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

