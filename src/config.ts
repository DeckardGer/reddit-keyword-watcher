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
		keywords: [
			"stashr",
			"stashr.me",
			"pocket alternative",
			"bookmark manager",
			"mymind",
			"raindrop.io",
			"getdewey",
			"bookmarkjar",
			"tiktok favorites",
			"instagram saved posts",
			"twitter bookmarks",
			"x bookmarks",
			"organize saved posts",
		],
		watchedSubreddits: [
			{ name: "PKMS", mode: "request" },
			{ name: "chrome_extensions", mode: "request" },
			{ name: "productivity", mode: "request+topic" },
			{ name: "ObsidianMD", mode: "request+topic" },
			{ name: "DataHoarder", mode: "request+topic" },
			{ name: "Tiktokhelp", mode: "request+topic" },
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
