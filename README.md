# RedditKeywordWatcher

Watches Reddit (and Hacker News, since it's free) around the clock,
matching posts **and comments** against per-product
keyword lists, optionally runs an LLM relevance check, and pings Telegram with a
permalink when something is worth reading.

Internal tool, deliberately small: config file + SQLite + one container. No web
UI, no dashboard, no productizing (a commercial version would require Reddit's
~$12K/month API tier — that's what killed GummySearch).

## How it works

- **Reddit (API mode)**: polls `oauth.reddit.com/r/all/comments` every 5s and
  `/r/all/new` every 30s via a "script" app (client-credentials OAuth, ~14
  req/min, well under the 100 QPM free-tier cap). Coverage caveat: at peak
  hours Reddit exceeds 100 comments per 5s, so a small fraction of comments
  can be missed. Good enough for alerting; not an archival tool.
  NOTE: since Nov 2025 Reddit gates new API apps behind manual approval
  (Responsible Builder Policy) — creds may not be obtainable.
- **Reddit (RSS fallback, no creds)**: when API creds are absent, one gentle
  loop every 10 min fetches each watched sub's `new.rss` (intent mode) and a
  `search.rss` query per keyword (posts only — Reddit search doesn't index
  comments), spaced 5s apart (~2 req/min). Unauthenticated RSS is aggressively
  rate limited per IP; back-to-back requests get 429s, which the backoff loop
  absorbs. Comment coverage requires the API (or F5Bot alongside).
- **Hacker News**: polls the official free Algolia API
  (`hn.algolia.com/api/v1/search_by_date`) per keyword every 2 minutes with a
  persisted cursor. Fully sanctioned, no auth.
- **Matching**: word-boundary, case-insensitive, per product (`src/config.ts`).
- **Intent mode**: for `watchedSubreddits` (one extra multireddit request/min),
  every NEW POST is screened for request shape ("is there a tool…", "how do
  I…", title ending in "?") with no keyword requirement — `request` mode alerts
  on any request-shaped post (niche subs), `request+topic` also requires one of
  the product's `topicWords` (broad subs). Intent alerts are prefixed 🎯,
  keyword alerts 🔔; both share dedup so an item alerts at most once.
- **Triage** (optional): each hit goes through one cheap LLM call that answers
  "would the founder actually want to read this?" — kills coincidental matches
  like "raindrop" the weather. Fails open if the API errors.
- **Delivery**: Telegram bot message per relevant hit, routed per product
  (`telegramChatId` per product, falling back to `TELEGRAM_CHAT_ID`).
- **Liveness**: optional healthchecks-style `HEARTBEAT_URL` ping every 5 min,
  plus a daily stats message (items scanned / hits / alerts) so silence means
  broken, not quiet.
- **State**: SQLite (`bun:sqlite`) for dedup, cursors, and daily stats.
  Seen-ids pruned after 14 days.

## Setup

1. `bun install`
2. Copy `.env.example` to `.env` and fill in:
   - Reddit script app (create on a dedicated account at
     `reddit.com/prefs/apps`, type "script") — optional; without it the watcher
     runs HN-only
   - Telegram bot token + chat id
   - `OPENAI_API_KEY` if you want triage
3. Edit `src/config.ts` — products, keywords, descriptions.
4. `bun run start`

## Deploy (Coolify)

Dockerfile included. Mount a volume at `/app/data` for the SQLite DB, set the
env vars, done. One container, negligible CPU/RAM.

## Commands

- `bun run start` / `bun run dev` (watch mode)
- `bun run typecheck`
- `bun test`

## Tuning

- Noisy keyword? Either make it more specific in `config.ts` (e.g.
  `raindrop.io` instead of `raindrop`) or let triage handle it.
- New product: add an entry to `products` in `src/config.ts` with its own
  `telegramChatId` (a different chat/topic) — that's the whole multi-product
  story.
