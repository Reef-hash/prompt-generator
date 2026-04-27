// =====================================================
// subscription.js — Plan management & limits
// =====================================================

const PLANS = {
  free: {
    id:'free', name:'Percuma', icon:'🆓',
    price:{ monthly:0, yearly:0 },
    limits:{ promptsPerMonth:5, savedPrompts:10, aiCalls:0, teamMembers:1, export:['txt'], watermark:true, analytics:false, affiliate:false, apiAccess:false, whitelabel:false },
    features:['5 prompt/bulan','10 prompt tersimpan','Template asas','Eksport .txt','Sokongan komuniti'],
    missing:['Jana AI sebenar','Eksport PDF/DOCX','Program affiliate','Analytics','API access'],
    color:'var(--text-muted)', cta:'Mulakan Percuma', badge:null
  },
  starter: {
    id:'starter', name:'Starter', icon:'⚡',
    price:{ monthly:29, yearly:19 },
    limits:{ promptsPerMonth:50, savedPrompts:100, aiCalls:50, teamMembers:1, export:['txt','pdf'], watermark:false, analytics:false, affiliate:true, apiAccess:false, whitelabel:false },
    features:['50 prompt/bulan','100 prompt tersimpan','Jana AI sebenar (50x/bln)','Eksport PDF','Program affiliate','Tiada watermark','Sokongan email'],
    missing:['DOCX export','Analytics','API access','White-label'],
    color:'#388BFD', cta:'Cuba 7 Hari Percuma', badge:'Popular'
  },
  pro: {
    id:'pro', name:'Pro', icon:'🔥',
    price:{ monthly:79, yearly:55 },
    limits:{ promptsPerMonth:300, savedPrompts:1000, aiCalls:300, teamMembers:3, export:['txt','pdf','docx','html'], watermark:false, analytics:true, affiliate:true, apiAccess:false, whitelabel:false },
    features:['300 prompt/bulan','1,000 prompt tersimpan','Jana AI sebenar (300x/bln)','Eksport PDF+DOCX+HTML','Analytics lengkap','3 ahli pasukan','Jana keutamaan','Sokongan keutamaan'],
    missing:['API access','White-label','Client management'],
    color:'var(--accent-light)', cta:'Mulakan Pro', badge:'Best Value'
  },
  agency: {
    id:'agency', name:'Agency', icon:'🏢',
    price:{ monthly:199, yearly:149 },
    limits:{ promptsPerMonth:-1, savedPrompts:-1, aiCalls:-1, teamMembers:10, export:['txt','pdf','docx','html','all'], watermark:false, analytics:true, affiliate:true, apiAccess:true, whitelabel:true },
    features:['Prompt UNLIMITED','Simpan UNLIMITED','Jana AI UNLIMITED','Semua format eksport','10 ahli pasukan','API access','White-label (logo sendiri)','Dedicated account manager','Client management'],
    missing:[],
    color:'#d2a8ff', cta:'Hubungi Jualan', badge:'Enterprise'
  }
};

const PLAN_ORDER = ['free','starter','pro','agency'];

// ── Get user plan ─────────────────────────────────
function getUserPlan() {
  const session = getSession();
  if (!session) return PLANS.free;
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const user  = users.find(u=>u.id===session.userId);
  const planId= user?.plan || 'free';

  // Semak expiry
  if (user?.planExpiresAt && new Date(user.planExpiresAt) < new Date() && planId !== 'free') {
    downgradeToPlan(session.userId, 'free');
    return PLANS.free;
  }
  return PLANS[planId] || PLANS.free;
}

// ── Upgrade plan (simulate) ───────────────────────
function upgradePlan(planId, billingCycle='monthly', promoCode='') {
  const session = getSession();
  if (!session) return { success:false, message:'Sila log masuk dahulu.' };
  const plan = PLANS[planId];
  if (!plan) return { success:false, message:'Pelan tidak dijumpai.' };

  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const idx   = users.findIndex(u=>u.id===session.userId);
  if (idx===-1) return { success:false };

  const price = billingCycle==='yearly' ? plan.price.yearly * 12 : plan.price.monthly;
  const expiryDays = billingCycle==='yearly' ? 365 : 30;

  // Apply promo code
  let discount = 0;
  if (promoCode) {
    const codes = JSON.parse(localStorage.getItem('pgp_promo_codes')||'[]');
    const code  = codes.find(c=>c.code.toLowerCase()===promoCode.toLowerCase() && c.active);
    if (code) {
      discount = code.type==='percentage' ? price*(code.value/100) : code.value;
    }
  }

  users[idx].plan           = planId;
  users[idx].planBillingCycle = billingCycle;
  users[idx].planStartedAt  = new Date().toISOString();
  users[idx].planExpiresAt  = new Date(Date.now() + expiryDays*864e5).toISOString();
  users[idx].aiCreditsLeft  = plan.limits.aiCalls === -1 ? 99999 : plan.limits.aiCalls;
  users[idx].trialEndsAt    = new Date(Date.now() + 7*864e5).toISOString();
  users[idx].isTrial        = true;

  localStorage.setItem(AUTH_KEY, JSON.stringify(users));

  // Log subscription
  const subs = JSON.parse(localStorage.getItem('pgp_subscriptions')||'[]');
  subs.push({
    id:'sub_'+Date.now(), userId:session.userId, plan:planId,
    billingCycle, amount:price-discount, discount,
    promoCode: promoCode||null,
    status:'active', startedAt:new Date().toISOString(),
    expiresAt:users[idx].planExpiresAt,
    paymentMethod:'toyyibpay'
  });
  localStorage.setItem('pgp_subscriptions',JSON.stringify(subs));

  // Refresh session
  const s = getSession();
  s.plan = planId;
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));

  return { success:true, plan, price:price-discount, discount };
}

function downgradeToPlan(userId, planId) {
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const idx   = users.findIndex(u=>u.id===userId);
  if (idx===-1) return;
  users[idx].plan = planId;
  users[idx].aiCreditsLeft = PLANS[planId].limits.aiCalls;
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

// ── Check limits ──────────────────────────────────
function checkLimit(feature) {
  const plan  = getUserPlan();
  const stats = getUserStats();
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const session = getSession();
  const user  = users.find(u=>u.id===session?.userId);

  switch(feature) {
    case 'createPrompt':
      if (plan.limits.promptsPerMonth===-1) return {allowed:true};
      const used = stats.thisMonth || 0;
      if (used >= plan.limits.promptsPerMonth)
        return {allowed:false, reason:`Had bulanan anda (${plan.limits.promptsPerMonth} prompt) telah dicapai.`, upgrade:true};
      return {allowed:true, remaining: plan.limits.promptsPerMonth - used};

    case 'savePrompt':
      if (plan.limits.savedPrompts===-1) return {allowed:true};
      const saved = stats.total || 0;
      if (saved >= plan.limits.savedPrompts)
        return {allowed:false, reason:`Had simpanan (${plan.limits.savedPrompts}) telah dicapai.`, upgrade:true};
      return {allowed:true, remaining: plan.limits.savedPrompts - saved};

    case 'aiGenerate':
      if (!plan.limits.aiCalls) return {allowed:false, reason:'Pelan anda tidak menyokong Jana AI. Naik taraf ke Starter.', upgrade:true};
      const credits = user?.aiCreditsLeft || 0;
      if (credits <= 0) return {allowed:false, reason:'Kredit AI anda habis untuk bulan ini.', upgrade:true};
      return {allowed:true, remaining:credits};

    case 'exportPdf':
      if (!plan.limits.export.includes('pdf'))
        return {allowed:false, reason:'Eksport PDF memerlukan pelan Starter ke atas.', upgrade:true};
      return {allowed:true};

    case 'exportDocx':
      if (!plan.limits.export.includes('docx'))
        return {allowed:false, reason:'Eksport DOCX memerlukan pelan Pro ke atas.', upgrade:true};
      return {allowed:true};

    case 'affiliate':
      if (!plan.limits.affiliate)
        return {allowed:false, reason:'Program affiliate memerlukan pelan Starter ke atas.', upgrade:true};
      return {allowed:true};

    default: return {allowed:true};
  }
}

// ── Deduct AI credit ──────────────────────────────
function deductAICredit(amount=1) {
  const session = getSession();
  if (!session) return;
  const users = JSON.parse(localStorage.getItem(AUTH_KEY)||'[]');
  const idx   = users.findIndex(u=>u.id===session.userId);
  if (idx===-1) return;
  if (users[idx].plan === 'agency') return; // unlimited
  users[idx].aiCreditsLeft = Math.max(0, (users[idx].aiCreditsLeft||0) - amount);
  localStorage.setItem(AUTH_KEY, JSON.stringify(users));
}

// ── Show upgrade modal ────────────────────────────
function showUpgradePrompt(reason='') {
  const plan = getUserPlan();
  const nextPlan = PLAN_ORDER[PLAN_ORDER.indexOf(plan.id)+1] || 'pro';
  const next = PLANS[nextPlan];

  let modal = document.getElementById('upgradeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="max-width:460px;text-align:center">
        <div class="modal-header"><h3 class="modal-title">🚀 Naik Taraf Pelan</h3>
          <button class="modal-close" onclick="closeModal('upgradeModal')">✕</button></div>
        <div class="modal-body">
          <div style="font-size:2.5rem;margin-bottom:12px">${next.icon}</div>
          <p id="upgradeReason" style="color:var(--text-secondary);margin-bottom:20px"></p>
          <div style="background:var(--bg-primary);border:1px solid var(--border);border-radius:10px;padding:20px;margin-bottom:20px">
            <div style="font-size:1.6rem;font-weight:800;color:${next.color}">RM${next.price.monthly}<span style="font-size:.9rem;color:var(--text-muted)">/bulan</span></div>
            <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">atau RM${next.price.yearly}/bln (tahunan)</div>
            <ul style="list-style:none;text-align:left;font-size:.85rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:6px">
              ${next.features.slice(0,4).map(f=>`<li>✅ ${f}</li>`).join('')}
            </ul>
          </div>
          <a href="pricing.html" class="btn btn-primary btn-block" style="margin-bottom:10px">${next.cta}</a>
          <button class="btn btn-ghost btn-block btn-sm" onclick="closeModal('upgradeModal')">Mungkin lain kali</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('upgradeReason').textContent = reason || 'Naik taraf untuk akses ciri premium.';
  openModal('upgradeModal');
}

// ── Promo codes ───────────────────────────────────
function validatePromoCode(code) {
  const codes = JSON.parse(localStorage.getItem('pgp_promo_codes')||'[]');
  const found = codes.find(c=>c.code.toLowerCase()===code.toLowerCase() && c.active);
  if (!found) return {valid:false, message:'Kod promo tidak sah atau tamat tempoh.'};
  if (found.maxUses && found.usedCount >= found.maxUses) return {valid:false, message:'Kod promo ini telah digunakan sepenuhnya.'};
  return {valid:true, code:found, message:`Diskaun ${found.type==='percentage'?found.value+'%':'RM'+found.value} digunakan!`};
}

// Seed default promo codes if none
(function seedPromoCodes(){
  if (!localStorage.getItem('pgp_promo_codes')) {
    localStorage.setItem('pgp_promo_codes', JSON.stringify([
      {id:'p1',code:'MULAKAN30',type:'percentage',value:30,maxUses:100,usedCount:0,active:true,description:'30% diskaun untuk pengguna baru'},
      {id:'p2',code:'JIMAT50',type:'fixed',value:50,maxUses:50,usedCount:0,active:true,description:'RM50 off untuk pelan Pro'},
      {id:'p3',code:'AGENSI2025',type:'percentage',value:20,maxUses:null,usedCount:0,active:true,description:'20% off untuk pelan Agency'}
    ]));
  }
})();
