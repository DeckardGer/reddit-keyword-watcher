import { env, products } from "./config";
import { searchHnSince } from "./hn";
import { buildTopicGate, isRequestPost } from "./intent";
import { buildMatcher, type Matcher } from "./match";
import { type MentionItem, RedditPoller } from "./reddit";
import { fetchSearchRss, fetchSubredditRss } from "./rss";
import { Store } from "./store";
import { sendAlert, sendMessage } from "./telegram";
import { triage } from "./triage";

const REDDIT_COMMENTS_INTERVAL_MS = 5_000;
const REDDIT_POSTS_INTERVAL_MS = 30_000;
const INTENT_INTERVAL_MS = 60_000;
// Unauthenticated RSS is aggressively rate limited: one request at a time,
// seconds apart, minutes between full cycles (~2/min average all-in).
const RSS_CYCLE_INTERVAL_MS = 600_000;
const RSS_REQUEST_GAP_MS = 5_000;
const HN_INTERVAL_MS = 120_000;
const HEARTBEAT_INTERVAL_MS = 300_000;
const DAILY_SUMMARY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SEEN_RETENTION_DAYS = 14;
const MAX_BACKOFF_MULTIPLIER = 60;

const active = products.filter((p) => p.enabled);
if (active.length === 0) {
	console.error("no enabled products in config.ts; nothing to do");
	process.exit(1);
}

const store = new Store(env.dbPath);
const matchers: { product: (typeof active)[number]; match: Matcher }[] =
	active.map((p) => ({
		product: p,
		match: buildMatcher(p.keywords),
	}));
const hnKeywords = [...new Set(active.flatMap((p) => p.keywords))];
const intentWatchers = active.map((p) => ({
	product: p,
	topicGate: buildTopicGate(p.topicWords),
}));
const watchedSubs = [
	...new Set(active.flatMap((p) => p.watchedSubreddits.map((w) => w.name))),
];
const reddit = new RedditPoller();

async function handleItems(items: MentionItem[]): Promise<void> {
	store.bumpStats(items.length, 0, 0);
	for (const item of items) {
		for (const { product, match } of matchers) {
			const hits = match(item.text);
			if (hits.length === 0) continue;
			if (!store.markSeen(`${product.name}:${item.source}:${item.id}`))
				continue;
			store.bumpStats(0, 1, 0);
			const verdict = await triage(product, item, hits);
			if (!verdict.relevant) {
				console.log(
					`[triage skip] ${product.name} ${item.url} (${verdict.reason})`,
				);
				continue;
			}
			await sendAlert(product, item, hits, verdict.reason);
			store.bumpStats(0, 0, 1);
			console.log(`[alert] ${product.name} ${item.url} (${hits.join(", ")})`);
		}
	}
}

async function handleIntentItems(items: MentionItem[]): Promise<void> {
	store.bumpStats(items.length, 0, 0);
	for (const item of items) {
		if (item.kind !== "post") continue;
		for (const { product, topicGate } of intentWatchers) {
			const watch = product.watchedSubreddits.find(
				(w) => `r/${w.name}`.toLowerCase() === item.community.toLowerCase(),
			);
			if (!watch) continue;
			if (!isRequestPost(item.title, item.text)) continue;
			if (watch.mode === "request+topic" && !topicGate(item.text)) continue;
			// Shared dedup key with the keyword stream: one alert per item per product.
			if (!store.markSeen(`${product.name}:${item.source}:${item.id}`)) continue;
			store.bumpStats(0, 1, 0);
			const verdict = await triage(product, item, ["(request-shaped post)"]);
			if (!verdict.relevant) {
				console.log(
					`[triage skip] ${product.name} ${item.url} (${verdict.reason})`,
				);
				continue;
			}
			await sendAlert(product, item, [], verdict.reason, "intent");
			store.bumpStats(0, 0, 1);
			console.log(`[intent alert] ${product.name} ${item.url}`);
		}
	}
}

/** Runs fn forever with exponential backoff on consecutive errors. */
async function loop(
	name: string,
	intervalMs: number,
	fn: () => Promise<void>,
): Promise<never> {
	let consecutiveErrors = 0;
	while (true) {
		try {
			await fn();
			consecutiveErrors = 0;
		} catch (err) {
			consecutiveErrors++;
			console.error(`[${name}] error #${consecutiveErrors}: ${String(err)}`);
		}
		const multiplier = Math.min(2 ** consecutiveErrors, MAX_BACKOFF_MULTIPLIER);
		await Bun.sleep(intervalMs * multiplier);
	}
}

async function pollHn(): Promise<void> {
	for (const keyword of hnKeywords) {
		const cursorKey = `hn:${keyword}`;
		const since = store.getCursor(
			cursorKey,
			Math.floor(Date.now() / 1000) - 3600,
		);
		const items = await searchHnSince(keyword, since);
		if (items.length > 0) {
			await handleItems(items);
			store.setCursor(cursorKey, Math.max(...items.map((i) => i.createdUtc)));
		}
	}
}

async function heartbeat(): Promise<void> {
	if (!env.heartbeatUrl) return;
	await fetch(env.heartbeatUrl, { method: "GET" });
}

async function dailySummary(): Promise<void> {
	const today = new Date().toISOString().slice(0, 10);
	const s = store.statsForDay(today);
	store.prune(SEEN_RETENTION_DAYS);
	await sendMessage(
		env.telegramChatId,
		`📡 RedditKeywordWatcher alive — today: ${s.scanned.toLocaleString()} items scanned, ${s.hits} keyword hits, ${s.sent} alerts sent`,
	);
}

function shutdown(): void {
	console.log("shutting down");
	store.close();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
	`RedditKeywordWatcher watching ${active.map((p) => p.name).join(", ")} — ${hnKeywords.length} keywords (reddit ${env.redditClientId ? "on" : "OFF: no creds"}, triage ${env.openaiApiKey ? "on" : "off"}, telegram ${env.telegramBotToken ? "on" : "off"})`,
);

const loops: Promise<never>[] = [
	loop("hn", HN_INTERVAL_MS, pollHn),
	loop("heartbeat", HEARTBEAT_INTERVAL_MS, heartbeat),
	loop("daily-summary", DAILY_SUMMARY_INTERVAL_MS, dailySummary),
];
if (env.redditClientId && env.redditClientSecret) {
	loops.push(
		loop("reddit-comments", REDDIT_COMMENTS_INTERVAL_MS, async () => {
			await handleItems(await reddit.fetchNewComments());
		}),
		loop("reddit-posts", REDDIT_POSTS_INTERVAL_MS, async () => {
			await handleItems(await reddit.fetchNewPosts());
		}),
	);
	if (watchedSubs.length > 0) {
		loops.push(
			loop("reddit-intent", INTENT_INTERVAL_MS, async () => {
				await handleIntentItems(await reddit.fetchWatchedPosts(watchedSubs));
			}),
		);
	}
} else if (watchedSubs.length > 0 || hnKeywords.length > 0) {
	console.warn(
		"no Reddit API creds — RSS fallback active: intent via sub feeds, keywords via search RSS (posts only, no comments)",
	);
	loops.push(
		loop("reddit-rss", RSS_CYCLE_INTERVAL_MS, async () => {
			for (const sub of watchedSubs) {
				await handleIntentItems(await fetchSubredditRss(sub));
				await Bun.sleep(RSS_REQUEST_GAP_MS);
			}
			for (const keyword of hnKeywords) {
				await handleItems(await fetchSearchRss(keyword));
				await Bun.sleep(RSS_REQUEST_GAP_MS);
			}
		}),
	);
} else {
	console.warn(
		"REDDIT_CLIENT_ID/SECRET not set and nothing to watch — HN only",
	);
}
await Promise.all(loops);
