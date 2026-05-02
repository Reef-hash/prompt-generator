# 🏗️ Architecture Redesign Plan — Secure Backend Layer

## Current Architecture (INSECURE)

```
┌─────────────────────────────────────────────┐
│         Browser (Frontend)                   │
├─────────────────────────────────────────────┤
│  - HTML/CSS/JS (All logic here)              │
│  - API keys hardcoded                        │
│  - Direct DB calls with anon key             │
│  - Client-side validation only               │
│  - Client-side rate limiting only            │
└─────────────────────────────────────────────┘
           ↓ (Direct API calls)
┌─────────────────────────────────────────────┐
│    Supabase Public API                       │
│    - No business logic validation            │
│    - No input sanitization                   │
│    - Relies only on RLS policies             │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│    PostgreSQL Database                       │
│    - Exposed via anon key                    │
│    - Vulnerable to direct injection          │
└─────────────────────────────────────────────┘

⚠️ RISK: Any client-side validation can be bypassed
⚠️ RISK: Attackers can use exposed keys directly  
⚠️ RISK: No audit trail for suspicious operations
```

---

## Recommended Architecture (SECURE)

```
┌──────────────────────────────────────────────────┐
│         Browser (Frontend)                        │
├──────────────────────────────────────────────────┤
│  - UI/UX only                                     │
│  - Client-side validation (UX feedback only)     │
│  - No sensitive logic                            │
│  - Session token management                      │
│  - No direct DB access                           │
└──────────────────────────────────────────────────┘
           ↓ HTTPS (Encrypted)
┌──────────────────────────────────────────────────┐
│    Backend API Layer                             │
│    (Node.js / Supabase Edge Functions)           │
├──────────────────────────────────────────────────┤
│  ✅ Authentication verification                  │
│  ✅ Input validation & sanitization              │
│  ✅ Business logic enforcement                   │
│  ✅ Server-side rate limiting                    │
│  ✅ Audit logging                                │
│  ✅ Error handling (no stack traces)             │
│  ✅ Service role key (never exposed)             │
└──────────────────────────────────────────────────┘
           ↓ (Authenticated requests)
┌──────────────────────────────────────────────────┐
│    Supabase API                                  │
│    - Calls go through RLS + backend logic        │
│    - User identity verified                      │
│    - Input already validated                     │
└──────────────────────────────────────────────────┘
           ↓
┌──────────────────────────────────────────────────┐
│    PostgreSQL Database                           │
│    - Protected by RLS policies                   │
│    - Protected by backend validation             │
│    - Audit trail recorded                        │
│    - No direct client access                     │
└──────────────────────────────────────────────────┘

✅ SECURE: All validation server-side
✅ SECURE: API keys never exposed to client
✅ SECURE: Complete audit trail
✅ SECURE: Attack surface minimized
```

---

## Migration Path

### Phase 1: Prepare Backend Structure (Week 1)

```
supabase/
├── functions/
│   ├── auth/
│   │   ├── register.ts
│   │   ├── login.ts
│   │   ├── password-reset.ts
│   │   └── validate-token.ts
│   │
│   ├── prompts/
│   │   ├── create-prompt.ts
│   │   ├── update-prompt.ts
│   │   ├── delete-prompt.ts
│   │   ├── list-prompts.ts
│   │   └── generate-prompt.ts
│   │
│   ├── subscriptions/
│   │   ├── upgrade-plan.ts
│   │   ├── validate-promo.ts
│   │   └── check-limits.ts
│   │
│   ├── affiliate/
│   │   ├── record-click.ts
│   │   ├── get-stats.ts
│   │   └── process-withdrawal.ts
│   │
│   ├── middleware/
│   │   ├── auth.ts          (Verify JWT)
│   │   ├── validate.ts      (Input validation)
│   │   ├── rate-limit.ts    (Rate limiting)
│   │   └── logging.ts       (Audit logs)
│   │
│   └── utils/
│       ├── errors.ts        (Error handlers)
│       ├── sanitize.ts      (Input sanitization)
│       └── validators.ts    (Validation schemas)
```

---

## Example: Migrating Prompt Creation

### Current Flow (Vulnerable)

```javascript
// frontend: js/storage.js
async function savePrompt(promptData) {
  const { data, error } = await sb.from('prompts').insert({
    user_id: session.userId,  // ← From localStorage!
    title: promptData.title,   // ← No validation!
    generated_prompt: promptData.generatedPrompt,
    tags: promptData.tags,
  }).select().single();
}
```

**Problems:**
- Session from localStorage can be forged
- No validation of title length, content
- No rate limiting enforcement
- No audit trail
- Direct DB access with exposed keys

### New Flow (Secure)

**Step 1: Create backend function**

`supabase/functions/prompts/create-prompt.ts`:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.21.4/mod.ts'

// Input validation schema
const CreatePromptSchema = z.object({
  title: z.string()
    .min(2, 'Title must be at least 2 characters')
    .max(200, 'Title must not exceed 200 characters'),
  
  businessType: z.string()
    .refine(t => VALID_BUSINESS_TYPES.includes(t), 'Invalid business type'),
  
  generatedPrompt: z.string()
    .min(10, 'Prompt too short')
    .max(10000, 'Prompt too long'),
  
  tags: z.array(z.string().max(50)).max(10),
  
  formData: z.record(z.any()).optional(),
});

interface CreatePromptRequest {
  title: string;
  businessType: string;
  businessTypeLabel: string;
  generatedPrompt: string;
  tags?: string[];
  formData?: Record<string, any>;
}

Deno.serve(async (req: Request) => {
  // 1. CORS & Method Check
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // 2. Extract & Verify Auth Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401 
      });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Verify JWT token server-side
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401 
      });
    }

    // 3. Parse & Validate Input
    let body: CreatePromptRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
        status: 400 
      });
    }

    // Validate with schema
    const validation = CreatePromptSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return new Response(JSON.stringify({ error: 'Validation failed', details: errors }), { 
        status: 400 
      });
    }

    // 4. Server-side Rate Limiting
    const rateLimitKey = `prompt_save:${user.id}`;
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 1000); // 1 minute

    const { data: recentSaves } = await supabase
      .from('rate_limit_log')
      .select('id')
      .eq('key', rateLimitKey)
      .gte('timestamp', windowStart.toISOString());

    const LIMIT = 20; // 20 saves per minute
    if ((recentSaves?.length || 0) >= LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }), 
        { status: 429 }
      );
    }

    // 5. Check subscription limits
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan, ai_credits_left')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { 
        status: 404 
      });
    }

    const limits = getPlanLimits(profile.plan);
    const { data: userPrompts } = await supabase
      .from('prompts')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id);

    if (userPrompts && userPrompts.length >= limits.savedPrompts) {
      return new Response(
        JSON.stringify({ 
          error: 'Saved prompts limit reached. Upgrade your plan.' 
        }), 
        { status: 403 }
      );
    }

    // 6. Sanitize Input
    const sanitizedTitle = sanitizeInput(validation.data.title);
    const sanitizedPrompt = sanitizeAndFilterPrompt(validation.data.generatedPrompt);
    const sanitizedTags = validation.data.tags?.map(t => sanitizeInput(t)) || [];

    // 7. Insert with service role (authenticated user)
    const { data: prompt, error: insertError } = await supabase
      .from('prompts')
      .insert({
        user_id: user.id,
        title: sanitizedTitle,
        business_type: validation.data.businessType,
        business_type_label: validation.data.businessTypeLabel,
        generated_prompt: sanitizedPrompt,
        tags: sanitizedTags,
        form_data: validation.data.formData || {},
        version: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save prompt' }), 
        { status: 500 }
      );
    }

    // 8. Log rate limit attempt
    await supabase.from('rate_limit_log').insert({
      key: rateLimitKey,
      action: 'prompt_save',
      user_id: user.id,
      timestamp: now.toISOString(),
    });

    // 9. Log audit event
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'prompt_created',
      resource_type: 'prompt',
      resource_id: prompt.id,
      details: { title: sanitizedTitle },
      timestamp: now.toISOString(),
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
    });

    // 10. Return sanitized response
    return new Response(JSON.stringify({
      success: true,
      prompt: {
        id: prompt.id,
        title: prompt.title,
        createdAt: prompt.created_at,
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': Deno.env.get('FRONTEND_URL') || '*',
      }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { status: 500 }
    );
  }
});

// Helper functions
function sanitizeInput(text: string): string {
  return text.trim().substring(0, 1000);
}

function sanitizeAndFilterPrompt(text: string): string {
  // Remove potential injection patterns
  let sanitized = text;
  const patterns = [
    /ignore\s*[:;]?\s*previous|forget\s*[:;]?\s*instructions/gi,
    /system\s*[:;]?\s*prompt|jailbreak/gi,
  ];
  
  patterns.forEach(p => {
    sanitized = sanitized.replace(p, '[FILTERED]');
  });
  
  return sanitized.substring(0, 10000);
}

function getPlanLimits(plan: string) {
  const limits: Record<string, any> = {
    free: { savedPrompts: 10, aiCalls: 0 },
    starter: { savedPrompts: 100, aiCalls: 50 },
    pro: { savedPrompts: 1000, aiCalls: 300 },
    agency: { savedPrompts: -1, aiCalls: -1 }, // Unlimited
  };
  return limits[plan] || limits.free;
}

const VALID_BUSINESS_TYPES = [
  'restaurant', 'cafe', 'bakery', 'foodtruck',
  'fashion', 'hijab', 'kids', 'salon', 'spa', 'skincare', 'gym',
  // ... all other types
];
```

**Step 2: Update frontend to call backend function**

```javascript
// frontend: js/storage.js (NEW)
async function savePrompt(promptData) {
  try {
    const session = await getSecureSession(); // Verify token
    if (!session) {
      showToast('Sila log masuk semula.', 'error');
      return null;
    }

    // Call backend function instead of direct DB
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompts/create-prompt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          title: promptData.title,
          businessType: promptData.businessType,
          businessTypeLabel: promptData.businessTypeLabel,
          generatedPrompt: promptData.generatedPrompt,
          tags: promptData.tags,
          formData: promptData.formData,
        }),
      }
    );

    if (response.status === 429) {
      showToast('Too many requests. Try again later.', 'error');
      return null;
    }

    if (!response.ok) {
      const error = await response.json();
      showToast(error.error || 'Failed to save prompt', 'error');
      return null;
    }

    const data = await response.json();
    showToast('Prompt saved successfully!', 'success');
    return data.prompt;

  } catch (err) {
    console.error('savePrompt error:', err);
    showToast('An error occurred. Please try again.', 'error');
    return null;
  }
}
```

---

## Benefits of Backend Layer

| Aspect | Before | After |
|--------|--------|-------|
| **API Keys** | Exposed in frontend | Hidden in backend only |
| **Validation** | Client-side only (bypassable) | Server-side + client UX |
| **Rate Limiting** | Browser memory (bypassable) | Database + enforced |
| **Business Logic** | Scattered in frontend | Centralized backend |
| **Audit Trail** | No logging | Complete audit trail |
| **Error Handling** | Leaks details to user | Safe error messages |
| **Attack Surface** | Large (all browser code) | Small (single API endpoint) |
| **Compliance** | Difficult to prove | Complete audit trail |
| **Scalability** | Hard to change logic | Easy to update backend |

---

## Implementation Timeline

```
Week 1: Backend Architecture Setup
├── Create Supabase Edge Function structure
├── Write validation schemas
├── Implement middleware (auth, rate limit)
└── Deploy first function (auth)

Week 2-3: Migrate Core Operations
├── Prompt CRUD operations
├── Subscription management
├── Affiliate tracking
└── Admin operations

Week 4: Testing & Security Review
├── Penetration testing
├── Load testing
├── Security audit
└── Code review

Week 5: Deploy to Production
├── Blue-green deployment
├── Monitor error rates
├── Gradual traffic shift
└── Fallback plan ready

Week 6: Cleanup & Optimization
├── Remove direct DB calls from frontend
├── Clean up unused code
├── Document new architecture
└── Team training
```

---

## Deployment Strategy

### Step 1: Deploy Edge Functions
```bash
# Deploy all functions to Supabase
supabase functions deploy

# Test endpoints
curl -X POST https://your-project.supabase.co/functions/v1/prompts/create-prompt \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","businessType":"cafe",...}'
```

### Step 2: Update Frontend Gradually
```javascript
// Feature flag to switch between old and new
const USE_BACKEND_API = true;

async function savePrompt(promptData) {
  if (USE_BACKEND_API) {
    return savePromptViaBackend(promptData); // New
  } else {
    return savePromptDirect(promptData); // Old
  }
}
```

### Step 3: Monitor & Rollback
```javascript
// Log success/failure rates
logMetric('backend_api_success_rate', successCount / totalCount);

// If error rate > 5%, automatically fallback
if (errorRate > 0.05) {
  USE_BACKEND_API = false;
  alertTeam('Rolled back to direct API due to high error rate');
}
```

---

## Security Checklist After Migration

- [ ] All user input validated server-side
- [ ] No business logic in frontend
- [ ] API keys only in backend
- [ ] Rate limiting enforced server-side
- [ ] Audit logs for all operations
- [ ] Error messages don't leak info
- [ ] HTTPS enforced
- [ ] Security headers set
- [ ] Session tokens verified
- [ ] Input sanitization applied
- [ ] SQL injection protected (via ORM)
- [ ] CSRF tokens in place
- [ ] Rate limit logging in database
- [ ] Access logs available for audit
- [ ] Secrets not in git history

