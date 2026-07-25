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
- **Reddit (RSS fallback, no creds)**: when API creds are absent, a steady
  round-robin makes **one request per minute** — rotating through each watched
  sub's `new.rss` (intent mode) and a `search.rss` query per keyword (posts
  only; Reddit search doesn't index comments). With 19 targets each is
  refreshed about every 19 minutes. Measured 2026-07-25 from a datacenter IP:
  unauthenticated RSS tolerates only ~1 request per 50-60s (even 10s spacing
  returns 429), so bursts are counterproductive; single failures are logged and
  skipped, and a full rotation of failures raises an error so a blocked IP is
  visible rather than silent. Comment coverage requires the API (or F5Bot
  alongside).
- **Hacker News**: polls the official free Algolia API
  (`hn.algolia.com/api/v1/search_by_date`) per keyword every 2 minutes with a
  persisted cursor. Fully sanctioned, no auth.
- **Matching**: word-boundary, case-insensitive, per product (`src/config.ts`).
- **Intent mode**: for `watchedSubreddits`, every NEW POST is screened for
  request shape ("is there a tool…", "how do I…", title ending in "?") with no
  keyword requirement — `request` mode alerts on any request-shaped post
  (niche subs), `request+topic` also requires one of the product's
  `topicWords` (broad subs). Intent alerts are prefixed 🎯, keyword alerts 🔔;
  both share dedup so an item alerts at most once.
- **The heuristics adapt to triage.** Without `OPENAI_API_KEY` they are the
  only filter, so they run strict: request phrasing must appear in the title,
  and `request+topic` subs must hit a topic word. With triage enabled they
  widen — bodies are scanned (catching statement-form posts like "Drowning in
  saved content") and the topic gate defers to the model, since precision is
  now the LLM's job and dropping threads on vocabulary costs more than it
  saves. The startup log states which mode is active.
- **Cold-start priming**: the first fetch of any target absorbs the existing
  backlog into the dedup store without alerting, so adding a subreddit or
  keyword never floods you.
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
