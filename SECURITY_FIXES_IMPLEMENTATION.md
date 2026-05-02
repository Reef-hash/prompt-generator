# 🔧 Security Fixes — Implementation Guide

This document provides exact code implementations for all critical and high-severity vulnerabilities.

---

## 1️⃣ FIX: EXPOSED API KEYS

### Step 1: Environment Configuration

**Create `.env.local` (NEVER commit this file):**
```
VITE_SUPABASE_URL=https://ddwdwbhcnonbhmlipuvm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_REOH4QcENBCviLSQJg3Tdg_N98y5CG7
```

**Create `.env.example` (for documentation):**
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Update `.gitignore`:**
```
# Environment
.env.local
.env.*.local
.env
.env.production.local
.env.test.local
```

### Step 2: Update `js/supabase-config.js`

**BEFORE (VULNERABLE):**
```javascript
const SUPABASE_URL = 'https://ddwdwbhcnonbhmlipuvm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_REOH4QcENBCviLSQJg3Tdg_N98y5CG7';
```

**AFTER (SECURE):**
```javascript
// =====================================================
// supabase-config.js — Environment-based configuration
// =====================================================

// Read from environment variables (build-time injection)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate configuration exists
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Set environment variables:');
  console.error('  - VITE_SUPABASE_URL');
  console.error('  - VITE_SUPABASE_ANON_KEY');
  throw new Error('Supabase configuration not found. Check .env.local');
}

// Initialize Supabase client (only once)
if (!window.sb) {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Export for use in other files
var sb = window.sb;

// Optional: Log configuration status (debug only)
if (import.meta.env.DEV) {
  console.log('✅ Supabase configured:', {
    url: SUPABASE_URL,
    keyPrefix: SUPABASE_ANON_KEY.substring(0, 20) + '***' // Don't log full key
  });
}
```

### Step 3: Rotate Keys in Supabase

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Under "Project API keys", click "Rotate" for anon key
3. Update `.env.local` with new keys
4. Remove history: `git filter-branch --tree-filter 'rm -f js/supabase-config.js' -- --all`

---

## 2️⃣ FIX: XSS IN TOAST NOTIFICATIONS

**File:** `js/utils.js`

**BEFORE (VULNERABLE):**
```javascript
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
  `; // ❌ VULNERABLE: Direct HTML injection

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}
```

**AFTER (SECURE):**
```javascript
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

  // ✅ CREATE ELEMENTS SAFELY
  const iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icons[type] || 'ℹ️'; // Safe: no HTML parsing

  const messageSpan = document.createElement('span');
  messageSpan.className = 'toast-message';
  messageSpan.textContent = message; // ✅ SAFE: escapes HTML entities

  toast.appendChild(iconSpan);
  toast.appendChild(messageSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}
```

**Usage remains the same:**
```javascript
showToast('Prompt saved successfully!', 'success');
showToast('Error occurred', 'error');
```

---

## 3️⃣ FIX: HTML INJECTION IN ADMIN PANEL

**File:** `admin.html`

**Helper function to escape HTML:**
```javascript
// Add this helper function at the top of admin.html <script>
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Create table row safely
function createTableRow(cells, dataAttributes = {}) {
  const tr = document.createElement('tr');
  cells.forEach(cell => {
    const td = document.createElement('td');
    if (typeof cell === 'string') {
      td.textContent = cell;
    } else if (cell.html) {
      td.innerHTML = cell.html; // Use only for trusted content
    } else if (cell.element) {
      td.appendChild(cell.element); // Append element
    }
    tr.appendChild(td);
  });
  Object.entries(dataAttributes).forEach(([key, value]) => {
    tr.dataset[key] = value;
  });
  return tr;
}
```

**BEFORE (VULNERABLE):**
```javascript
async function loadAllWithdrawals() {
  const { data } = await sb.from('withdrawals').select('*');
  const tbody = document.getElementById('allWithdrawalsTable');
  tbody.innerHTML = (data || []).map(w => `
    <tr>
      <td style="font-size:10px">${w.user_id}</td>
      <td>RM${w.amount}</td>
      <td>${w.bank_name}<br/>${w.account_number}</td>
      <td><span class="badge ${w.status==='pending'?'badge-yellow':'badge-green'}">${w.status}</span></td>
      <td>
        ${w.status === 'pending' ? 
          `<button class="btn btn-primary btn-sm" onclick="approveWithdrawal('${w.id}')">Approve</button>` 
          : 'Selesai'}
      </td>
    </tr>
  `).join('');
}
```

**AFTER (SECURE):**
```javascript
async function loadAllWithdrawals() {
  const { data } = await sb.from('withdrawals').select('*');
  const tbody = document.getElementById('allWithdrawalsTable');
  
  // Clear previous content
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No withdrawals</td></tr>';
    return;
  }

  (data || []).forEach(w => {
    const userCell = document.createElement('td');
    userCell.style.fontSize = '10px';
    userCell.textContent = w.user_id;

    const amountCell = document.createElement('td');
    amountCell.textContent = `RM${w.amount}`;

    const bankCell = document.createElement('td');
    bankCell.innerHTML = `${escapeHtml(w.bank_name)}<br/>${escapeHtml(w.account_number)}`;

    const statusCell = document.createElement('td');
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${w.status === 'pending' ? 'badge-yellow' : 'badge-green'}`;
    statusBadge.textContent = w.status;
    statusCell.appendChild(statusBadge);

    const actionCell = document.createElement('td');
    if (w.status === 'pending') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = 'Approve';
      btn.dataset.withdrawalId = w.id; // ✅ Use data attribute
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        approveWithdrawal(w.id);
      });
      actionCell.appendChild(btn);
    } else {
      actionCell.textContent = 'Selesai';
    }

    const tr = document.createElement('tr');
    tr.appendChild(userCell);
    tr.appendChild(amountCell);
    tr.appendChild(bankCell);
    tr.appendChild(statusCell);
    tr.appendChild(actionCell);
    
    tbody.appendChild(tr);
  });
}

// Update approveWithdrawal to use dataset
async function approveWithdrawal(withdrawalId) {
  if (!withdrawalId) return;
  try {
    await sb.from('withdrawals').update({ status: 'approved' }).eq('id', withdrawalId);
    await loadAllWithdrawals();
    showToast('Withdrawal approved', 'success');
  } catch (err) {
    console.error('Approval error:', err);
    showToast('Error approving withdrawal', 'error');
  }
}
```

---

## 4️⃣ FIX: INPUT VALIDATION

**Create new file:** `js/validators.js`

```javascript
// =====================================================
// validators.js — Comprehensive input validation
// =====================================================

const ValidationRules = {
  email: {
    required: true,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 254,
    trim: true,
    lowercase: true,
    message: 'Valid email address required'
  },
  
  password: {
    required: true,
    type: 'string',
    minLength: 8,
    maxLength: 128,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    message: 'Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)'
  },
  
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z\s'-]{2,100}$/,
    trim: true,
    message: 'Name must be 2-100 characters (letters, spaces, hyphens, apostrophes only)'
  },
  
  phone: {
    required: false,
    type: 'string',
    maxLength: 20,
    pattern: /^[\d\s\-+()]*$/,
    message: 'Invalid phone number format'
  },
  
  businessName: {
    required: true,
    type: 'string',
    maxLength: 100,
    minLength: 2,
    pattern: /^[a-zA-Z0-9\s\-_.&(),']{2,100}$/,
    trim: true,
    message: 'Business name must be 2-100 characters'
  },
  
  businessDescription: {
    required: false,
    type: 'string',
    maxLength: 1000,
    message: 'Description must be 1000 characters or less'
  },
  
  promptTitle: {
    required: true,
    type: 'string',
    maxLength: 200,
    minLength: 2,
    trim: true,
    message: 'Prompt title must be 2-200 characters'
  }
};

/**
 * Validate a single field
 * @param {string} fieldName - Field name (key in ValidationRules)
 * @param {any} value - Value to validate
 * @returns {object} {valid: bool, error?: string, value?: any}
 */
function validateField(fieldName, value) {
  const rule = ValidationRules[fieldName];
  
  if (!rule) {
    return { valid: true, value }; // No rule = valid
  }

  // Check required
  if (rule.required && (value === null || value === undefined || String(value).trim() === '')) {
    return { 
      valid: false, 
      error: `${fieldName} is required` 
    };
  }

  // Allow empty optional fields
  if (!rule.required && (value === null || value === undefined || String(value).trim() === '')) {
    return { valid: true, value: null };
  }

  // Convert to string for validation
  let processedValue = String(value);

  // Trim if required
  if (rule.trim) {
    processedValue = processedValue.trim();
  }

  // Convert to lowercase if required
  if (rule.lowercase) {
    processedValue = processedValue.toLowerCase();
  }

  // Check length
  if (rule.minLength && processedValue.length < rule.minLength) {
    return { 
      valid: false, 
      error: `${fieldName} must be at least ${rule.minLength} characters` 
    };
  }

  if (rule.maxLength && processedValue.length > rule.maxLength) {
    return { 
      valid: false, 
      error: `${fieldName} cannot exceed ${rule.maxLength} characters` 
    };
  }

  // Check pattern
  if (rule.pattern && !rule.pattern.test(processedValue)) {
    return { 
      valid: false, 
      error: rule.message || `${fieldName} format is invalid` 
    };
  }

  return { 
    valid: true, 
    value: processedValue 
  };
}

/**
 * Validate multiple fields at once
 * @param {object} data - Object with field:value pairs
 * @param {array} fieldsToValidate - Optional: specific fields to check
 * @returns {object} {valid: bool, errors: {field: error}, values: {field: value}}
 */
function validateForm(data, fieldsToValidate = null) {
  const fieldsToCheck = fieldsToValidate || Object.keys(data);
  const errors = {};
  const values = {};
  let isValid = true;

  fieldsToCheck.forEach(fieldName => {
    const validation = validateField(fieldName, data[fieldName]);
    if (!validation.valid) {
      errors[fieldName] = validation.error;
      isValid = false;
    } else {
      values[fieldName] = validation.value;
    }
  });

  return { 
    valid: isValid, 
    errors: isValid ? {} : errors, 
    values 
  };
}

/**
 * Sanitize input to prevent XSS
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
function sanitizeInput(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Filter dangerous prompt injection patterns
 * @param {string} text - Prompt text
 * @returns {string} Filtered text
 */
function filterPromptInjection(text) {
  if (!text) return '';
  
  // Patterns that indicate prompt injection attempts
  const dangerousPatterns = [
    /ignore\s*[:;]?\s*previous|forget\s*[:;]?\s*instructions/gi,
    /system\s*[:;]?\s*prompt|jailbreak/gi,
    /you are now|pretend you|act as|assume you/gi,
    /hidden instruction|secret prompt|real instruction/gi,
  ];

  let filtered = text;
  let wasFiltered = false;

  dangerousPatterns.forEach(pattern => {
    if (pattern.test(filtered)) {
      filtered = filtered.replace(pattern, '[FILTERED]');
      wasFiltered = true;
    }
  });

  if (wasFiltered) {
    console.warn('Prompt injection pattern detected and filtered');
  }

  return filtered;
}

/**
 * Example usage in form submission
 */
async function handleRegistrationForm(e) {
  e.preventDefault();

  const formData = {
    email: document.getElementById('email').value,
    password: document.getElementById('password').value,
    name: document.getElementById('name').value,
    phone: document.getElementById('phone').value,
  };

  // Validate all fields
  const validation = validateForm(formData, ['email', 'password', 'name', 'phone']);

  if (!validation.valid) {
    // Show first error
    const firstError = Object.values(validation.errors)[0];
    showToast(firstError, 'error');
    return;
  }

  // Use sanitized values
  try {
    const result = await registerUser({
      email: validation.values.email,
      password: validation.values.password,
      name: validation.values.name,
      phone: validation.values.phone || null,
    });

    if (result.success) {
      showToast('Registration successful!', 'success');
      window.location.href = '/dashboard.html';
    } else {
      showToast(result.message || 'Registration failed', 'error');
    }
  } catch (err) {
    console.error('Registration error:', err);
    showToast('An error occurred. Please try again.', 'error');
  }
}
```

**Update HTML forms to use validation:**

```html
<!-- Example: generator.html form update -->
<form id="registrationForm" onsubmit="handleRegistrationForm(event)">
  <div class="form-group">
    <label for="businessName">Business Name*</label>
    <input 
      type="text" 
      id="businessName" 
      class="form-control" 
      required
      maxlength="100"
      placeholder="Enter business name"
      oninput="validateField('businessName', this.value)"
    />
    <small class="form-error" id="businessNameError"></small>
  </div>

  <div class="form-group">
    <label for="businessDescription">Description</label>
    <textarea 
      id="businessDescription" 
      class="form-control" 
      maxlength="1000"
      placeholder="Describe your business"
      oninput="validateField('businessDescription', this.value)"
    ></textarea>
  </div>

  <button type="submit" class="btn btn-primary">Generate Prompt</button>
</form>

<script>
// Real-time validation feedback
function validateField(fieldName, value) {
  const validation = validateField(fieldName, value);
  const errorEl = document.getElementById(fieldName + 'Error');
  
  if (errorEl) {
    errorEl.textContent = validation.valid ? '' : validation.error;
    errorEl.style.display = validation.valid ? 'none' : 'block';
  }
  
  return validation;
}
</script>
```

---

## 5️⃣ FIX: SERVER-SIDE RATE LIMITING

**Create Edge Function:** `supabase/functions/check-rate-limit/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RATE_LIMITS = {
  login: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  register: { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  promptGeneration: { maxRequests: 30, windowMs: 60 * 1000 },
  promptSave: { maxRequests: 20, windowMs: 60 * 1000 },
  passwordReset: { maxRequests: 3, windowMs: 30 * 60 * 1000 },
  api: { maxRequests: 100, windowMs: 60 * 60 * 1000 }
};

interface RateLimitRequest {
  userId?: string;
  email?: string;
  action: 'login' | 'register' | 'promptGeneration' | 'promptSave' | 'passwordReset' | 'api';
}

interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

Deno.serve(async (req: Request) => {
  try {
    const { userId, email, action } = await req.json() as RateLimitRequest;
    
    if (!action || !RATE_LIMITS[action as keyof typeof RATE_LIMITS]) {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { 
        status: 400 
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const limit = RATE_LIMITS[action as keyof typeof RATE_LIMITS];
    const key = userId || email || 'anonymous';
    const now = new Date();
    const windowStart = new Date(now.getTime() - limit.windowMs);

    // Query recent requests
    const { data: requests, error: queryError } = await supabase
      .from('rate_limit_log')
      .select('id')
      .eq('key', key)
      .eq('action', action)
      .gte('timestamp', windowStart.toISOString());

    if (queryError) throw queryError;

    const requestCount = requests?.length || 0;
    const remaining = Math.max(0, limit.maxRequests - requestCount);
    const allowed = requestCount < limit.maxRequests;

    if (allowed) {
      // Log this request
      await supabase.from('rate_limit_log').insert({
        key,
        action,
        user_id: userId || null,
        email: email || null,
        timestamp: now.toISOString(),
      });
    }

    return new Response(JSON.stringify({
      allowed,
      remaining,
      retryAfter: allowed ? 0 : Math.ceil((limit.windowMs) / 1000),
    }), {
      status: allowed ? 200 : 429,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Rate limit check error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { 
      status: 500 
    });
  }
});
```

**Update `js/auth.js` to use server-side rate limiting:**

```javascript
async function loginUser(email, password) {
  try {
    // CHECK RATE LIMIT SERVER-SIDE
    const rateLimitResponse = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-rate-limit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email, action: 'login' })
      }
    );

    if (rateLimitResponse.status === 429) {
      const rateLimitData = await rateLimitResponse.json();
      showToast(`Too many attempts. Try again in ${rateLimitData.retryAfter} seconds`, 'error');
      return { success: false, message: 'Rate limited' };
    }

    if (!rateLimitResponse.ok) {
      throw new Error('Rate limit check failed');
    }

    localStorage.clear();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { success: false, message: error.message };
    }

    await cacheSession();
    return { success: true, user: data.user, session: data.session };
  } catch (e) {
    console.error('Login error:', e);
    return { success: false, message: e.message || 'Login failed' };
  }
}
```

---

## 6️⃣ FIX: SECURITY HEADERS

**Update `vercel.json`:**

```json
{
  "buildCommand": "npm run build",
  "framework": "nuxt",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_anon_key"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=(), payment=()"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://cdn.supabase.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ],
  "redirects": [
    {
      "source": "/api/(.*)",
      "destination": "https://api.example.com/$1",
      "permanent": true
    }
  ]
}
```

---

## ✅ TESTING FIXES

### Test XSS Fix
```javascript
// This should show escaped text, not execute:
showToast('<img src=x onerror="alert(\'XSS\')">', 'error');
// Expected: Shows literal text "[img src=x onerror=..." not alert
```

### Test Input Validation
```javascript
validateField('email', 'not-an-email'); 
// Returns: { valid: false, error: 'email format is invalid' }

validateField('password', 'weak');
// Returns: { valid: false, error: 'Password must contain uppercase...' }

validateField('businessName', 'Valid Business Name');
// Returns: { valid: true, value: 'Valid Business Name' }
```

### Test Rate Limiting
```bash
# Test rate limit enforcement
for i in {1..10}; do
  curl -X POST http://localhost:3000/functions/v1/check-rate-limit \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","action":"login"}'
  echo ""
done
# Should return 429 after 5 attempts
```

---

## 📋 DEPLOYMENT CHECKLIST

- [ ] Update environment variables in deployment platform
- [ ] Rotate API keys in Supabase
- [ ] Deploy all code changes
- [ ] Test all validation rules
- [ ] Verify security headers are being sent
- [ ] Monitor rate limit logs for issues
- [ ] Update documentation
- [ ] Notify users of security fixes

