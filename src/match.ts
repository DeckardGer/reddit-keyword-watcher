function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type Matcher = (text: string) => string[];

/**
 * Builds a matcher that returns which keywords appear in a text.
 * Word-boundary anchored and case-insensitive, so "raindrop.io" does not
 * match "raindrops" but does match "Raindrop.io".
 */
/**
 * Returns a window of text centered on the earliest keyword occurrence, so
 * triage and alert snippets always contain the matched context even in long
 * posts. Falls back to the head of the text if no keyword is found.
 */
export function windowAround(
	text: string,
	keywords: string[],
	radius: number,
): string {
	const lower = text.toLowerCase();
	let idx = -1;
	for (const k of keywords) {
		const i = lower.indexOf(k.toLowerCase());
		if (i !== -1 && (idx === -1 || i < idx)) idx = i;
	}
	if (idx === -1) return text.slice(0, radius * 2);
	const start = Math.max(0, idx - radius);
	const end = Math.min(text.length, idx + radius);
	return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function buildMatcher(keywords: string[]): Matcher {
	const patterns = keywords.map((keyword) => ({
		keyword,
		re: new RegExp(
			`(?:^|\\W)${escapeRegex(keyword.toLowerCase())}(?:$|\\W)`,
			"i",
		),
	}));
	return (text: string) => {
		if (!text) return [];
		return patterns.filter((p) => p.re.test(text)).map((p) => p.keyword);
	};
}
