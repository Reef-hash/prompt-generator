// ===================================================
// auth.js — Authentication system (localStorage-based)
// ===================================================

const AUTH_KEY    = 'pgp_users';
const SESSION_KEY = 'pgp_session';

// ── Register ──────────────────────────────────────
function registerUser(userData) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');

  if (users.find(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
    return { success: false, message: 'Email ini sudah didaftarkan.' };
  }

  const hashedPassword = btoa(userData.password + '_salt_pgp_2025');

  const newUser = {
    id: 'user_' + Date.now(),
    name: userData.name,
    email: userData.email.toLowerCase(),
    password: hashedPassword,
    businessType: userData.businessType,
    createdAt: new Date().toISOString(),
    savedCount: 0,
    totalGenerated: 0,
    lastActive: new Date().toISOString(),
    plan: 'free'
  };

  users.push(newUser);
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
  createSession(newUser);
  return { success: true, user: newUser };
}

// ── Login ─────────────────────────────────────────
function loginUser(email, password, remember = false) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
  const hashedPassword = btoa(password + '_salt_pgp_2025');
  const user = users.find(u =>
    u.email.toLowerCase() === email.toLowerCase() &&
    u.password === hashedPassword
  );

  if (!user) {
    return { success: false, message: 'Email atau kata laluan tidak sah.' };
  }

  createSession(user, remember);

  // Update lastActive
  user.lastActive = new Date().toISOString();
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));

  return { success: true, user };
}

// ── Create Session ────────────────────────────────
function createSession(user, remember = false) {
  const days = remember ? 30 : 7;
  const session = {
    userId  : user.id,
    name    : user.name,
    email   : user.email,
    plan    : user.plan,
    initials: user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// ── Get Session ───────────────────────────────────
function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) {
      logout(false);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ── Get current user full data ────────────────────
function getCurrentUser() {
  const session = getSession();
  if (!session) return null;
  const users = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
  return users.find(u => u.id === session.userId) || null;
}

// ── Update user profile ───────────────────────────
function updateUserProfile(updates) {
  const session = getSession();
  if (!session) return { success: false };

  const users = JSON.parse(localStorage.getItem(AUTH_KEY) || '[]');
  const idx = users.findIndex(u => u.id === session.userId);
  if (idx === -1) return { success: false };

  users[idx] = { ...users[idx], ...updates, lastActive: new Date().toISOString() };
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));

  // Refresh session name if name changed
  if (updates.name) {
    const s = getSession();
    s.name = updates.name;
    s.initials = updates.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }

  return { success: true, user: users[idx] };
}

// ── Logout ────────────────────────────────────────
function logout(redirect = true) {
  localStorage.removeItem(SESSION_KEY);
  if (redirect) window.location.href = 'login.html';
}

// ── Require Auth (redirect if not logged in) ──────
function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

// ── Redirect if already logged in ────────────────
function redirectIfLoggedIn() {
  const session = getSession();
  if (session) window.location.href = 'dashboard.html';
}

// ── Populate user UI elements ─────────────────────
function populateUserUI(session) {
  if (!session) return;
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = session.name);
  document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = session.email);
  document.querySelectorAll('[data-user-initials]').forEach(el => el.textContent = session.initials);
  document.querySelectorAll('[data-user-plan]').forEach(el => el.textContent = session.plan === 'pro' ? '⭐ Pro' : 'Free Plan');
}
