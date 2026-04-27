// ===================================================
// utils.js — Shared UI utilities
// ===================================================

// ── Toast Notifications ───────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── Modal ─────────────────────────────────────────
function openModal(id = 'globalModal') {
  const m = document.getElementById(id);
  if (m) { m.classList.add('active'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id = 'globalModal') {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// ── Copy to Clipboard ─────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Berjaya disalin ke clipboard!', 'success');
  } catch {
    const el = document.createElement('textarea');
    el.value = text; el.style.position = 'fixed'; el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Berjaya disalin!', 'success');
  }
}

// ── Export .txt ───────────────────────────────────
function exportAsTxt(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename + '.txt';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Fail .txt dimuat turun!', 'success');
}

// ── Open in Claude ────────────────────────────────
function openInClaude(promptText) {
  const encoded = encodeURIComponent(promptText.slice(0, 8000));
  window.open(`https://claude.ai/new?q=${encoded}`, '_blank');
}

// ── Open in ChatGPT ───────────────────────────────
function openInChatGPT(promptText) {
  window.open('https://chat.openai.com/', '_blank');
  copyToClipboard(promptText);
  showToast('Prompt disalin! Tampal dalam ChatGPT.', 'info', 5000);
}

// ── Confirm Dialog ────────────────────────────────
function confirmAction(message, onConfirm) {
  const overlay = document.getElementById('confirmModal');
  const msg     = document.getElementById('confirmMessage');
  const okBtn   = document.getElementById('confirmOk');
  if (!overlay || !msg || !okBtn) { if (confirm(message)) onConfirm(); return; }

  msg.textContent = message;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  const handler = () => {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    okBtn.removeEventListener('click', handler);
    onConfirm();
  };
  okBtn.addEventListener('click', handler);
}

function closeConfirmModal() {
  const m = document.getElementById('confirmModal');
  if (m) { m.classList.remove('active'); document.body.style.overflow = ''; }
}

// ── Sidebar Toggle ────────────────────────────────
function initSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const hamburger= document.getElementById('hamburger');

  function openSidebar()  { sidebar?.classList.add('open'); overlay?.classList.add('open'); }
  function closeSidebar() { sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }

  hamburger?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);
}

// ── Mark active nav ───────────────────────────────
function markActiveNav() {
  const current = window.location.pathname.split('/').pop();
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    link.classList.toggle('active', href === current || href.endsWith(current));
  });
}

// ── Validate email ────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Set button loading state ──────────────────────
function setButtonLoading(btn, loading, label = '') {
  if (loading) {
    btn.disabled = true;
    btn._origHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Sila tunggu...`;
  } else {
    btn.disabled  = false;
    btn.innerHTML = label || btn._origHTML || label;
  }
}

// ── Format date (Malay) ───────────────────────────
function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('ms-MY', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Auto-init when DOM ready ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  markActiveNav();

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      logout();
    });
  });

  // Global modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });
});
