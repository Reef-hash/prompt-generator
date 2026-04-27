// ===================================================
// storage.js — CRUD for prompts
// ===================================================

const STORAGE_KEY = 'pgp_data';

function loadAllData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"prompts":[]}');
  } catch {
    return { prompts: [] };
  }
}

function saveAllData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Save new prompt ───────────────────────────────
function savePrompt(promptData) {
  const session = getSession();
  if (!session) return null;

  const allData = loadAllData();

  const newPrompt = {
    id             : 'prompt_' + Date.now(),
    userId         : session.userId,
    title          : promptData.title || promptData.formData?.businessName || 'Tanpa Tajuk',
    businessType   : promptData.businessType,
    businessTypeLabel: promptData.businessTypeLabel,
    formData       : promptData.formData || {},
    generatedPrompt: promptData.generatedPrompt || '',
    tags           : promptData.tags || [],
    isFavourite    : false,
    version        : 1,
    createdAt      : new Date().toISOString(),
    updatedAt      : new Date().toISOString()
  };

  allData.prompts.push(newPrompt);
  saveAllData(allData);
  updateUserStats(session.userId);
  return newPrompt;
}

// ── Get all prompts for current user ─────────────
function getUserPrompts(userId = null) {
  const session = getSession();
  const targetId = userId || session?.userId;
  if (!targetId) return [];

  const allData = loadAllData();
  return allData.prompts
    .filter(p => p.userId === targetId)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// ── Get single prompt ─────────────────────────────
function getPromptById(id) {
  const allData = loadAllData();
  return allData.prompts.find(p => p.id === id) || null;
}

// ── Update prompt ─────────────────────────────────
function updatePrompt(promptId, updates) {
  const allData = loadAllData();
  const idx = allData.prompts.findIndex(p => p.id === promptId);
  if (idx === -1) return { success: false, message: 'Prompt tidak dijumpai.' };

  allData.prompts[idx] = {
    ...allData.prompts[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
    version  : (allData.prompts[idx].version || 1) + 1
  };

  saveAllData(allData);
  return { success: true, prompt: allData.prompts[idx] };
}

// ── Delete prompt ─────────────────────────────────
function deletePrompt(promptId) {
  const allData = loadAllData();
  const before = allData.prompts.length;
  allData.prompts = allData.prompts.filter(p => p.id !== promptId);
  saveAllData(allData);

  const session = getSession();
  if (session) updateUserStats(session.userId);

  return { success: allData.prompts.length < before };
}

// ── Toggle favourite ──────────────────────────────
function toggleFavourite(promptId) {
  const allData = loadAllData();
  const prompt = allData.prompts.find(p => p.id === promptId);
  if (prompt) {
    prompt.isFavourite = !prompt.isFavourite;
    prompt.updatedAt   = new Date().toISOString();
    saveAllData(allData);
    return prompt.isFavourite;
  }
  return false;
}

// ── Search prompts ────────────────────────────────
function searchPrompts(query) {
  const prompts = getUserPrompts();
  if (!query || !query.trim()) return prompts;
  const q = query.toLowerCase().trim();

  return prompts.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (p.businessTypeLabel || '').toLowerCase().includes(q) ||
    (p.formData?.businessName || '').toLowerCase().includes(q) ||
    (p.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

// ── Filter prompts ────────────────────────────────
function filterPrompts(type = 'all', favouriteOnly = false) {
  let prompts = getUserPrompts();
  if (type !== 'all') prompts = prompts.filter(p => p.businessType === type);
  if (favouriteOnly)  prompts = prompts.filter(p => p.isFavourite);
  return prompts;
}

// ── Get stats ─────────────────────────────────────
function getUserStats() {
  const prompts = getUserPrompts();
  const now     = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const thisWeek = prompts.filter(p => new Date(p.createdAt) > weekAgo).length;
  const typeCounts = {};
  prompts.forEach(p => {
    typeCounts[p.businessTypeLabel] = (typeCounts[p.businessTypeLabel] || 0) + 1;
  });

  let topType = '-';
  let topCount = 0;
  Object.entries(typeCounts).forEach(([label, count]) => {
    if (count > topCount) { topType = label; topCount = count; }
  });

  return {
    total     : prompts.length,
    thisWeek,
    topType   : topType.replace(/^[\S]+\s/, ''), // remove emoji
    favourites: prompts.filter(p => p.isFavourite).length
  };
}

// ── Update user stats ─────────────────────────────
function updateUserStats(userId) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
  const user  = users.find(u => u.id === userId);
  if (user) {
    const prompts    = getUserPrompts(userId);
    user.savedCount  = prompts.length;
    user.lastActive  = new Date().toISOString();
    localStorage.setItem(AUTH_KEY, JSON.stringify(users));
  }
}

// ── Save draft ────────────────────────────────────
function saveDraft(formData, businessType) {
  localStorage.setItem('pgp_draft', JSON.stringify({ formData, businessType, savedAt: new Date().toISOString() }));
}

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem('pgp_draft'));
  } catch { return null; }
}

function clearDraft() {
  localStorage.removeItem('pgp_draft');
}

// ── Relative time helper ──────────────────────────
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString);
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'baru sahaja';
  if (m < 60) return `${m} minit lepas`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lepas`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d} hari lepas`;
  const w = Math.floor(d / 7);
  if (w < 5)  return `${w} minggu lepas`;
  return new Date(isoString).toLocaleDateString('ms-MY');
}
