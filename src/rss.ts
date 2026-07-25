import { env } from "./config";
import type { MentionItem } from "./reddit";

function decodeEntities(s: string): string {
	return s
		.replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
		.replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number.parseInt(d, 10)))
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function stripHtml(s: string): string {
	// Reddit's <content> is XML-escaped HTML that itself contains HTML
	// entities, so decode twice: once to get the HTML, once for its entities.
	return decodeEntities(
		decodeEntities(s).replace(/<[^>]+>/g, " "),
	)
		.replace(/\s+/g, " ")
		.trim();
}

function field(entry: string, tag: string): string {
	const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
	return m?.[1] ?? "";
}

function attr(entry: string, tag: string, name: string): string {
	const m = entry.match(new RegExp(`<${tag}[^>]*\\b${name}="([^"]*)"`, "i"));
	return m?.[1] ?? "";
}

/**
 * Parses a Reddit Atom feed (r/<sub>/new.rss) into MentionItems. Regex-based
 * on purpose: Reddit's Atom output is machine-generated and regular, and this
 * avoids an XML dependency. Unknown/missing fields degrade to empty strings.
 */
export function parseRedditAtom(xml: string): MentionItem[] {
	const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
	return entries.map((entry) => {
		const id = field(entry, "id").trim();
		const title = decodeEntities(field(entry, "title"));
		const content = stripHtml(field(entry, "content"));
		const author = decodeEntities(field(entry, "name")).replace(/^\/?u\//, "");
		const url = attr(entry, "link", "href");
		const communityLabel = attr(entry, "category", "label"); // "r/PKMS"
		const published = field(entry, "published") || field(entry, "updated");
		const createdMs = Date.parse(published.trim());
		return {
			id,
			source: "reddit" as const,
			kind: "post" as const,
			community: communityLabel || "r/unknown",
			author,
			title,
			text: `${title}\n${content}`,
			url,
			createdUtc: Number.isNaN(createdMs) ? 0 : Math.floor(createdMs / 1000),
		};
	});
}

/**
 * Fetches one subreddit's new-posts feed without authentication. Reddit rate
 * limits unauthenticated RSS aggressively per IP — callers must space calls
 * out (seconds between subs, minutes between cycles).
 */
export async function fetchSubredditRss(subreddit: string): Promise<MentionItem[]> {
	const res = await fetch(`https://www.reddit.com/r/${subreddit}/new.rss`, {
		headers: { "User-Agent": env.redditUserAgent },
	});
	if (!res.ok) throw new Error(`rss r/${subreddit}: HTTP ${res.status}`);
	return parseRedditAtom(await res.text());
}

/**
 * Sitewide keyword search via RSS, newest first. Posts only — Reddit search
 * does not index comments, so this is a partial substitute for the API
 * firehose. Same unauthenticated rate-limit caution applies.
 */
export async function fetchSearchRss(keyword: string): Promise<MentionItem[]> {
	const q = encodeURIComponent(`"${keyword}"`);
	const res = await fetch(`https://www.reddit.com/search.rss?q=${q}&sort=new`, {
		headers: { "User-Agent": env.redditUserAgent },
	});
	if (!res.ok) throw new Error(`rss search "${keyword}": HTTP ${res.status}`);
	return parseRedditAtom(await res.text());
}
