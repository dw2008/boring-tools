# boringtools.app — Architecture

> A multi-tool platform. Each tool does one thing well. The proofreader is tool #1.

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Routing | Subdirectory (`/proofread`, `/tool2`) | Single Next.js app, single deploy, shared layout and auth |
| Database | Supabase (free tier) | Postgres + auth + RLS included. Generous free tier. |
| Auth | Supabase Auth | Built-in Google OAuth, session handling, pairs with DB |
| Billing | Platform-wide Stripe subscriptions | One plan covers all tools. Simpler for users. |
| AI | Vercel AI SDK | Already provider-agnostic (OpenAI, Anthropic, Google, etc.) |
| Hosting | Vercel | Already in use, pairs with Next.js |
| UI | Tailwind + shadcn/ui + CVA | Matches proofreaderTool reference design |

---

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4, shadcn/ui, CVA, Lucide icons
- **Database:** Supabase (PostgreSQL + Row-Level Security)
- **Auth:** Supabase Auth (Google OAuth)
- **AI:** Vercel AI SDK (provider-agnostic, structured output via Zod)
- **Payments:** Stripe (subscriptions)
- **Hosting:** Vercel

---

## Project Structure

```
boring-tools/
├── app/
│   ├── (marketing)/                # Public pages
│   │   ├── page.tsx                # boringtools.app landing
│   │   └── layout.tsx
│   ├── (tools)/                    # All tool routes
│   │   ├── proofread/              # /proofread
│   │   │   ├── page.tsx
│   │   │   └── _components/       # Proofread-specific components
│   │   │       ├── diff-view.tsx
│   │   │       ├── proofread-input.tsx
│   │   │       └── proofread-result.tsx
│   │   └── [future-tool]/
│   ├── settings/                   # Account & billing
│   │   └── page.tsx
│   ├── api/
│   │   ├── proofread/              # POST — proofread text
│   │   │   └── route.ts
│   │   ├── stripe/
│   │   │   ├── create-checkout-session/
│   │   │   │   └── route.ts
│   │   │   └── create-portal-session/
│   │   │       └── route.ts
│   │   ├── webhooks/
│   │   │   └── stripe/
│   │   │       └── route.ts
│   │   └── subscription/
│   │       └── status/
│   │           └── route.ts
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts
│   ├── layout.tsx                  # Root layout (providers, header)
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── textarea.tsx
│   │   └── ...
│   ├── header.tsx                  # Shared site header
│   ├── footer.tsx
│   ├── auth-button.tsx
│   ├── usage-indicator.tsx
│   └── user-menu.tsx
├── lib/
│   ├── ai/
│   │   ├── client.ts               # Thin wrapper around Vercel AI SDK
│   │   └── prompts/
│   │       └── proofread.ts        # Proofreader system prompt
│   ├── supabase/
│   │   ├── client.ts               # Browser client
│   │   ├── server.ts               # Server client (cookies)
│   │   ├── admin.ts                # Service-role client (webhooks)
│   │   └── middleware.ts           # Session refresh
│   ├── stripe/
│   │   ├── client.ts               # Stripe server singleton
│   │   ├── actions.ts              # Checkout, portal operations
│   │   └── subscription-manager.ts # Tier checks, usage limits
│   ├── tools/
│   │   └── proofread/
│   │       └── diff.ts             # Word-level diff algorithm
│   ├── utils.ts                    # cn() and shared helpers
│   └── types.ts                    # Shared TypeScript types
├── contexts/
│   └── auth-context.tsx            # Supabase auth provider
├── supabase/
│   └── migrations/                 # SQL migration files
├── middleware.ts                   # Session refresh + security headers
├── doc/
│   ├── PLAN.md
│   └── ARCHITECTURE.md
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                 # shadcn/ui config
└── package.json
```

### Adding a New Tool

1. Create route: `app/(tools)/[tool-name]/page.tsx`
2. Create API: `app/api/[tool-name]/route.ts`
3. Add prompt: `lib/ai/prompts/[tool-name].ts`
4. Add business logic: `lib/tools/[tool-name]/`
5. Add tool-specific components: `app/(tools)/[tool-name]/_components/`
6. Add usage tracking row type (see Database Schema)

Everything else (auth, billing, header, layout) is shared automatically.

---

## Database Schema

### `profiles`

Created automatically when a user signs up via Supabase Auth trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | FK to `auth.users` |
| `email` | text | |
| `display_name` | text | nullable |
| `subscription_tier` | text | `'free'` / `'basic'` / `'pro'`, default `'free'` |
| `subscription_status` | text | `'active'` / `'past_due'` / `'canceled'` / null |
| `stripe_customer_id` | text | nullable |
| `stripe_subscription_id` | text | nullable |
| `current_period_start` | timestamptz | nullable |
| `current_period_end` | timestamptz | nullable |
| `cancel_at_period_end` | boolean | default false |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `tool_usage`

Tracks every tool invocation per user. Used for enforcing monthly limits.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `profiles.id` |
| `tool` | text | e.g. `'proofread'` |
| `created_at` | timestamptz | |

**Index:** `(user_id, tool, created_at)` — fast lookups for "how many times did this user use proofread this month?"

### `proofread_sessions` (Milestone 4)

Stores past proofreading results for history view. Added later.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `profiles.id` |
| `original_text` | text | User's input |
| `fixed_text` | text | AI's output |
| `created_at` | timestamptz | |

### Row-Level Security (RLS)

- `profiles`: Users can only read/update their own row.
- `tool_usage`: Users can only read their own usage. Inserts happen server-side.
- `proofread_sessions`: Users can only read their own sessions.

### Auth Trigger

A Postgres function creates a `profiles` row on `auth.users` insert:

```sql
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## AI Layer

### Provider Setup

Using Vercel AI SDK, which already abstracts providers:

```typescript
// lib/ai/client.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

const model = openai('gpt-4o-mini'); // configurable via env

export async function proofreadText(text: string): Promise<string> {
  const { text: result } = await generateText({
    model,
    system: PROOFREAD_SYSTEM_PROMPT,
    prompt: text,
  });
  return result;
}
```

### Switching Providers

Change one line + one env var:

```typescript
import { anthropic } from '@ai-sdk/anthropic';
const model = anthropic('claude-sonnet-4-5-20250929');
```

Or Google, Mistral, etc. The Vercel AI SDK handles the rest.

### Model Configuration

```env
# .env.local
AI_PROVIDER=openai          # openai | anthropic | google
AI_MODEL=gpt-4o-mini        # model ID for the chosen provider
```

### Proofread Prompt

```typescript
// lib/ai/prompts/proofread.ts
export const PROOFREAD_SYSTEM_PROMPT = `You are a grammar-only proofreader.

Rules:
- Fix grammar, spelling, and punctuation errors ONLY.
- Do NOT rephrase, reword, or restructure sentences.
- Do NOT change tone, formality, or style.
- Preserve slang, casual language, and the writer's voice.
- If the text has no errors, return it unchanged.
- Return ONLY the corrected text. No explanations.`;
```

---

## Auth Flow

### Sign In

1. User clicks "Sign in with Google"
2. `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. Redirect to Google → back to `/auth/callback`
4. Callback exchanges code for session
5. Session stored in HTTP-only cookies

### Session Management

`middleware.ts` runs on every request:
1. Reads session from cookies
2. Refreshes token if expired
3. Clears cookies if refresh fails

### Auth Context (Client)

```typescript
// contexts/auth-context.tsx
// Provides: user, session, loading, signIn(), signOut()
// Wraps supabase.auth.onAuthStateChange()
```

---

## Billing & Subscriptions

### Platform-Wide Plans

One subscription covers all tools. Per-tool limits are defined in config:

```typescript
// lib/stripe/subscription-manager.ts
export const PLAN_LIMITS = {
  free:  { proofread: 5   },
  basic: { proofread: 200 },
  pro:   { proofread: Infinity },
} as const;

// When adding a new tool:
// free:  { proofread: 5,   summarize: 3   },
// basic: { proofread: 200, summarize: 100 },
// pro:   { proofread: Infinity, summarize: Infinity },
```

### Usage Check Flow

```
User clicks "Proofread"
  → API: GET subscription tier from profiles
  → API: COUNT tool_usage WHERE user_id = X AND tool = 'proofread' AND created_at > period_start
  → If count < limit: proceed, INSERT tool_usage row
  → If count >= limit: return 403 with upgrade prompt
```

### Stripe Integration

**Checkout:** Create session → redirect to Stripe → webhook confirms → update `profiles`.

**Webhook events handled:**
- `checkout.session.completed` → Set tier on profile
- `customer.subscription.updated` → Sync status/period
- `customer.subscription.deleted` → Revert to free
- `invoice.payment_failed` → Mark `past_due`

**Billing period:**
- Paid users: Stripe's `current_period_start` / `current_period_end`
- Free users: Rolling 30-day window from `profiles.created_at`

---

## API Routes

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/proofread` | POST | Optional (M1), Required (M2+) | Run proofreading |
| `/api/subscription/status` | GET | Required | Get plan + usage |
| `/api/stripe/create-checkout-session` | POST | Required | Start Stripe checkout |
| `/api/stripe/create-portal-session` | POST | Required | Billing management |
| `/api/webhooks/stripe` | POST | No (verified by signature) | Stripe events |

### `/api/proofread` Request/Response

```typescript
// Request
{ text: string }   // max 10,000 characters

// Response
{
  original: string,
  fixed: string,
  hasChanges: boolean
}
```

Diff computation happens client-side (keeps the API simple, avoids sending diff data over the wire).

---

## Security

### Middleware (`middleware.ts`)

Every request gets:
- Session refresh (Supabase)
- Security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### Input Validation

- Zod schemas on all API inputs
- Max text length enforced (10,000 chars for proofread)
- No HTML allowed in user input

### Data Privacy

- User text is NOT stored (Milestone 1-3)
- Only stored in Milestone 4 if user opts into history
- Text is sent to AI provider and discarded

### Rate Limiting

- Free: 5 requests/month (enforced via `tool_usage` count)
- API-level rate limiting via Supabase or Vercel's built-in limits if needed

---

## Diff Rendering (Client-Side)

The diff view runs entirely in the browser:

1. API returns `{ original, fixed }`
2. Client runs word-level diff (e.g. `diff-match-patch` library or custom)
3. Renders inline:
   - **Removed words:** red background, strikethrough
   - **Added words:** green background, bold
   - **Unchanged words:** plain text

This matches the proofreaderTool reference design.

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=               # or ANTHROPIC_API_KEY, etc.

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_BASIC_PRICE_ID=
STRIPE_PRO_PRICE_ID=

# App
NEXT_PUBLIC_APP_URL=https://boringtools.app
```

---

## Milestone Mapping

| Milestone | What Ships | New Files |
|---|---|---|
| **M1: Core** | Paste → Proofread → Diff → Copy. No auth. | `app/(tools)/proofread/`, `app/api/proofread/`, `lib/ai/`, `lib/tools/proofread/`, UI components |
| **M2: Auth** | Google login, per-user usage tracking | `lib/supabase/`, `contexts/`, `middleware.ts`, `supabase/migrations/` |
| **M3: Billing** | Stripe subscriptions, plan limits | `lib/stripe/`, `app/api/stripe/`, `app/api/webhooks/`, `app/settings/` |
| **M4: History** | View past sessions | `proofread_sessions` table, history UI in proofread page |
