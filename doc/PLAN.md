# proofread.tools

> Paste your text, click a button, see exactly what was fixed. That's it.

---

## PRD

### The Problem

When you paste something into ChatGPT to fix grammar, it completely rewrites your whole sentence. You wrote "gonna" and it gives you back three formal sentences you'd never actually say.

That's annoying. Sometimes you just want your typos fixed — not a new sentence.

### What This Does

You paste your text. You click **Proofread**. It fixes grammar mistakes only — nothing else. Your words, your voice, just without the mistakes.

Then it shows you exactly what changed, like a GitHub commit diff:

~~I goes to the store yesterday~~ → I went to the store yesterday

Red for what got removed, green for what got added. Hit **Copy** and you're done.

That's the whole product.

### What It Will NOT Do

- No rewriting
- No "improving your tone"
- No suggestions
- No chat
- No AI going off on its own

Just grammar fixes.

### Target Users

- Engineers writing PR descriptions or commit messages
- ESL speakers (people who learned English as a second language)
- Students writing emails or papers
- Anyone who wants accuracy without losing their original voice

### User Flow

1. Go to the website
2. Log in with Google
3. Paste your text
4. Click **Proofread**
5. See the diff (what changed)
6. Click **Copy Fixed Text**
7. Done — usually under 20 seconds

### Pricing

| Plan  | Cost        | Usage             |
| ----- | ----------- | ----------------- |
| Free  | $0          | 5 fixes/month     |
| Basic | $1.99/month | 200 fixes/month   |
| Pro   | $5.99/month | Unlimited         |

Credits reset every month. Payments go through Stripe.

### Tech Stack

- **Frontend:** Next.js, hosted on Vercel
- **AI:** Vercel AI SDK with a strict prompt — only fix mistakes, touch nothing else
- **Payments:** Stripe
- **Database:** Stores account info, usage count, and plan. We don't save user text.

### Core Differentiator

Every AI writing tool out there tries to make your writing "better." We disagree that that's our job. We fix mistakes. We do not rewrite.

---

## Implementation Plan

**Reference projects:**
- Design: `/Users/danielwu/code/proofreaderTool`
- Architecture: `/Users/danielwu/code/longcut`

### Milestone 1 — Grammar Checker (Core)

Ship the core proofreading functionality without login or billing. Users can paste text, get grammar-only corrections, and see a diff of changes.

### Milestone 2 — Authentication

Add Google login via NextAuth (or similar). Gate usage behind auth so we can track per-user fix counts.

### Milestone 3 — Billing & Payments

Integrate Stripe for subscriptions. Enforce plan-based usage limits (Free/Basic/Pro). Track monthly credit usage and reset on billing cycle.

### Milestone 4 — Conversation History

Allow users to view past proofreading sessions. Each session remains isolated — no cross-session context.

---

## Architecture Considerations

- **Isolated sessions:** Every proofreading request is a standalone session. No conversation memory between requests.
- **AI provider agnostic:** Start with Vercel AI SDK as the initial provider, but abstract the AI layer so providers can be swapped out later.
- **Model flexibility:** Make model selection configurable so we can easily switch to a lower-cost model as needed.
