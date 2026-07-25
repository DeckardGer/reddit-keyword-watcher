export type WatchMode = "request" | "request+topic";

export interface WatchedSubreddit {
	/** Subreddit name without the r/ prefix. */
	name: string;
	/**
	 * "request": any request-shaped post alerts (niche subs where the venue
	 * guarantees topical relevance). "request+topic": also requires a topic
	 * word (broad subs like r/productivity).
	 */
	mode: WatchMode;
}

const REQUEST_PATTERNS: RegExp[] = [
	/\bis there (?:a|an|any)\b/i,
	/\bany (?:app|tool|extension|service|website|way)s?\b/i,
	/\bwhat (?:app|tool|extension|service)s? (?:do you|does everyone|should i)\b/i,
	/\bwhat do you (?:use|all use)\b/i,
	/\bhow do (?:i|you)\b/i,
	/\bhow to\b/i,
	/\bhow can i\b/i,
	/\blooking for (?:a|an|some|something)\b/i,
	/\brecommend(?:ation)?s?\b/i,
	/\bbest way to\b/i,
	/\bhelp me find\b/i,
	/\balternative(?:s)? to\b/i,
	/\bsuggest(?:ion)?s?\b/i,
];

/**
 * Detects request-shaped posts ("is there a tool that…", "how do I…").
 *
 * `includeBody` trades precision for recall and should track whether LLM
 * triage is enabled: bodies of long show-off posts routinely contain request
 * phrasing in passing (noisy on its own), but that noise is exactly what
 * triage filters — and scanning bodies catches statement-form posts whose
 * title never looks like a question ("Drowning in saved content").
 */
export function isRequestPost(title: string, body = "", includeBody = false): boolean {
	if (title.trimEnd().endsWith("?")) return true;
	const text = includeBody ? `${title}\n${body}` : title;
	return REQUEST_PATTERNS.some((re) => re.test(text));
}

/** Builds a topic gate from word-boundary-matched topic words. */
export function buildTopicGate(topicWords: string[]): (text: string) => boolean {
	const res = topicWords.map(
		(w) =>
			new RegExp(
				`(?:^|\\W)${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\W)`,
				"i",
			),
	);
	return (text: string) => res.some((re) => re.test(text));
}
