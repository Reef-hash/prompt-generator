// =====================================================
// affiliate.js — Affiliate & referral system
// =====================================================

const AFF_KEY = 'pgp_affiliates';
const AFF_EARN_KEY = 'pgp_affiliate_earnings';
const AFF_WITHDRAW_KEY = 'pgp_withdrawals';
const COMMISSION_RATE = 0.30;
const MIN_WITHDRAW = 50;

// ── Generate affiliate code ───────────────────────
function generateAffiliateCode(userId) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const user  = users.find(u=>u.id===userId);
  if (!user) return null;

  const prefix = user.name.replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,4) || 'USER';
  const suffix = Math.random().toString(36).substring(2,6).toUpperCase();
  const code   = prefix + suffix;

  const idx = users.findIndex(u=>u.id===userId);
  users[idx].affiliateCode    = code;
  users[idx].affiliateEnabled = true;
  users[idx].affiliateBalance = users[idx].affiliateBalance || 0;
  users[idx].affiliateTotalEarned = users[idx].affiliateTotalEarned || 0;
  users[idx].affiliateCreatedAt   = new Date().toISOString();
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
  return code;
}

// ── Get affiliate stats ───────────────────────────
function getAffiliateStats(userId) {
  const users  = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const user   = users.find(u=>u.id===userId);
  const earnings = JSON.parse(localStorage.getItem(AFF_EARN_KEY)||'[]')
                   .filter(e=>e.affiliateId===userId);

  const subs = JSON.parse(localStorage.getItem('pgp_subscriptions')||'[]');
  const referrals = users.filter(u=>u.referredBy===userId);
  const activeReferrals = referrals.filter(u=>u.plan && u.plan!=='free');

  const clicks = JSON.parse(localStorage.getItem('pgp_aff_clicks_'+userId)||'[]');
  const thisMonth = new Date();
  thisMonth.setDate(1); thisMonth.setHours(0,0,0,0);
  const clicksThisMonth = clicks.filter(c=>new Date(c.at)>thisMonth).length;

  const pendingEarnings  = earnings.filter(e=>e.status==='pending').reduce((s,e)=>s+e.amount,0);
  const approvedEarnings = earnings.filter(e=>e.status==='approved').reduce((s,e)=>s+e.amount,0);

  return {
    code            : user?.affiliateCode || null,
    enabled         : user?.affiliateEnabled || false,
    balance         : user?.affiliateBalance || 0,
    totalEarned     : user?.affiliateTotalEarned || 0,
    pendingEarnings,
    approvedEarnings,
    totalReferrals  : referrals.length,
    activeReferrals : activeReferrals.length,
    clicksThisMonth,
    totalClicks     : clicks.length,
    earnings        : earnings.slice(-20).reverse(),
    referralLink    : `${window.location.origin}${window.location.pathname.split('/').slice(0,-1).join('/')}/index.html?ref=${user?.affiliateCode||''}`
  };
}

// ── Track affiliate click ─────────────────────────
function trackAffiliateClick(code) {
  if (!code) return;
  // Save cookie-like in localStorage
  localStorage.setItem('pgp_ref', JSON.stringify({ code, at: new Date().toISOString() }));

  // Find affiliate user and log click
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const aff   = users.find(u=>u.affiliateCode===code);
  if (!aff) return;

  const key = 'pgp_aff_clicks_'+aff.id;
  const clicks = JSON.parse(localStorage.getItem(key)||'[]');
  clicks.push({ at: new Date().toISOString(), code });
  localStorage.setItem(key, JSON.stringify(clicks));
}

// ── Process commission after subscription ─────────
function processAffiliateCommission(newUserId, amount) {
  const ref = JSON.parse(localStorage.getItem('pgp_ref')||'null');
  if (!ref || !ref.code) return;

  // Check cookie is < 30 days
  if (new Date(ref.at) < new Date(Date.now() - 30*864e5)) {
    localStorage.removeItem('pgp_ref'); return;
  }

  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const aff   = users.find(u=>u.affiliateCode===ref.code);
  if (!aff || aff.id===newUserId) return;

  const commission = Math.round(amount * COMMISSION_RATE * 100) / 100;

  // Record earning
  const earnings = JSON.parse(localStorage.getItem(AFF_EARN_KEY)||'[]');
  earnings.push({
    id: 'earn_'+Date.now(), affiliateId:aff.id, referredUserId:newUserId,
    amount:commission, commissionRate:COMMISSION_RATE,
    status:'approved', createdAt:new Date().toISOString()
  });
  localStorage.setItem(AFF_EARN_KEY, JSON.stringify(earnings));

  // Update affiliate balance
  const affIdx = users.findIndex(u=>u.id===aff.id);
  users[affIdx].affiliateBalance     = (users[affIdx].affiliateBalance||0) + commission;
  users[affIdx].affiliateTotalEarned = (users[affIdx].affiliateTotalEarned||0) + commission;

  // Record who referred the new user
  const newIdx = users.findIndex(u=>u.id===newUserId);
  if (newIdx!==-1) users[newIdx].referredBy = aff.id;

  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
  localStorage.removeItem('pgp_ref');
}

// ── Request withdrawal ────────────────────────────
function requestWithdrawal(userId, amount, bankDetails) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const user  = users.find(u=>u.id===userId);
  if (!user) return {success:false, message:'Pengguna tidak dijumpai.'};
  if ((user.affiliateBalance||0) < MIN_WITHDRAW)
    return {success:false, message:`Minimum pengeluaran RM${MIN_WITHDRAW}. Baki semasa: RM${(user.affiliateBalance||0).toFixed(2)}`};
  if (amount > (user.affiliateBalance||0))
    return {success:false, message:'Jumlah melebihi baki anda.'};

  const req = {
    id:'wd_'+Date.now(), userId, amount,
    bankName: bankDetails.bankName, accountNumber: bankDetails.accountNumber,
    accountName: bankDetails.accountName,
    status:'pending', requestedAt:new Date().toISOString()
  };
  const wds = JSON.parse(localStorage.getItem(AFF_WITHDRAW_KEY)||'[]');
  wds.push(req);
  localStorage.setItem(AFF_WITHDRAW_KEY, JSON.stringify(wds));

  // Deduct from balance (hold)
  const idx = users.findIndex(u=>u.id===userId);
  users[idx].affiliateBalance -= amount;
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));

  return {success:true, withdrawal:req};
}

// ── Get withdrawal history ────────────────────────
function getWithdrawals(userId) {
  return JSON.parse(localStorage.getItem(AFF_WITHDRAW_KEY)||'[]')
    .filter(w=>w.userId===userId)
    .sort((a,b)=>new Date(b.requestedAt)-new Date(a.requestedAt));
}

// ── Check ref param on load ───────────────────────
(function checkRefParam(){
  const url = new URLSearchParams(window.location.search);
  const ref = url.get('ref');
  if (ref) trackAffiliateClick(ref);
})();
