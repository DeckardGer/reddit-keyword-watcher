import type { WatchedSubreddit } from "./intent";

export interface Product {
	/** Short slug used in alerts and dedup keys. */
	name: string;
	/** One-paragraph description fed to LLM triage to judge relevance. */
	description: string;
	/** Case-insensitive keywords/phrases, matched on word boundaries. */
	keywords: string[];
	/**
	 * Intent mode: subreddits whose NEW POSTS are screened for request-shaped
	 * intent ("is there a tool…") instead of exact keywords.
	 */
	watchedSubreddits: WatchedSubreddit[];
	/** Topic words required in "request+topic" watched subs. */
	topicWords: string[];
	/** Telegram chat id for this product's alerts. Falls back to TELEGRAM_CHAT_ID. */
	telegramChatId?: string;
	enabled: boolean;
}

export const products: Product[] = [
	{
		name: "stashr",
		description:
			"Stashr (stashr.me) is a bookmark-everything app: a browser extension captures posts you save on X/Twitter, Reddit, TikTok, and Instagram, and a web app organizes them with AI tagging and semantic search. Relevant conversations: people losing saved posts, wanting to organize/export bookmarks or favorites from social platforms, looking for Pocket/mymind/Raindrop/Dewey alternatives, or asking for a bookmark manager.",
		// Lean on purpose. In RSS mode every keyword costs a rotation slot
		// (1 request/min), and F5Bot already covers keyword mentions sitewide
		// including comments — which RSS search cannot do. So keep only brand
		// plus the highest-intent phrases here and spend the slots on subs.
		// Note: "stashr" already matches "stashr.me" (word-boundary), and
		// competitor names (mymind/raindrop/dewey/bookmarkjar) are left to
		// F5Bot since they're low-volume and it catches comments too.
		keywords: [
			"stashr",
			"pocket alternative",
			"bookmark manager",
			"tiktok favorites",
			"instagram saved posts",
			"twitter bookmarks",
			"x bookmarks",
		],
		// Buyer subs only — places people ask questions worth answering. The
		// promo lanes from the marketing plan (r/SideProject, r/SaaS,
		// r/indiehackers…) are where posts go, so there's nothing to watch.
		// Every name here was verified live on 2026-07-25.
		watchedSubreddits: [
			// Niche venues: topic relevance is implied by the subreddit itself.
			{ name: "PKMS", mode: "request" },
			{ name: "chrome_extensions", mode: "request" },
			{ name: "NoteTaking", mode: "request" },
			// Broad venues: gate on topic words when triage is off.
			{ name: "productivity", mode: "request+topic" },
			{ name: "ObsidianMD", mode: "request+topic" },
			{ name: "DataHoarder", mode: "request+topic" },
			// Platform-pain venues — where "my saves vanished" actually gets
			// posted. (r/Tiktokhelp, previously configured here, doesn't exist.)
			{ name: "TikTok", mode: "request+topic" },
			{ name: "Instagram", mode: "request+topic" },
			// App-recommendation venues.
			{ name: "software", mode: "request+topic" },
			{ name: "macapps", mode: "request+topic" },
		],
		topicWords: [
			"save",
			"saved",
			"saves",
			"bookmark",
			"bookmarks",
			"favorites",
			"favourites",
			"archive",
			"export",
			"organize",
			"organise",
			"links",
			"read later",
			"saved posts",
			"download",
			"article",
			"articles",
			"collection",
			"screenshot",
			"screenshots",
			"reels",
			"favorited",
			"read it later",
			"link rot",
		],
		enabled: true,
	},
	{
		name: "insposnaps",
		description:
			"InspoSnaps is an inspiration-image collection app. Relevant conversations: collecting design/moodboard inspiration, organizing reference images.",
		keywords: ["insposnaps"],
		watchedSubreddits: [],
		topicWords: [],
		enabled: false,
	},
];

export const env = {
	redditClientId: Bun.env.REDDIT_CLIENT_ID ?? "",
	redditClientSecret: Bun.env.REDDIT_CLIENT_SECRET ?? "",
	redditUserAgent:
		Bun.env.REDDIT_USER_AGENT ??
		"reddit-keyword-watcher/0.1 (personal mention monitor)",
	telegramBotToken: Bun.env.TELEGRAM_BOT_TOKEN ?? "",
	telegramChatId: Bun.env.TELEGRAM_CHAT_ID ?? "",
	openaiApiKey: Bun.env.OPENAI_API_KEY ?? "",
	triageModel: Bun.env.TRIAGE_MODEL ?? "gpt-5.4-nano",
	heartbeatUrl: Bun.env.HEARTBEAT_URL ?? "",
	dbPath: Bun.env.DB_PATH ?? "./data/watcher.db",
};
