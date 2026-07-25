import type { MentionItem } from "./reddit";

interface AlgoliaHit {
	objectID: string;
	author: string;
	created_at_i: number;
	title?: string | null;
	story_title?: string | null;
	comment_text?: string | null;
	story_text?: string | null;
	url?: string | null;
	_tags: string[];
}

/**
 * Searches HN (posts + comments) for a keyword, newest first, created after
 * `sinceEpoch`. Free official API, no auth required.
 */
export async function searchHnSince(
	keyword: string,
	sinceEpoch: number,
): Promise<MentionItem[]> {
	const params = new URLSearchParams({
		query: keyword,
		tags: "(story,comment)",
		numericFilters: `created_at_i>${sinceEpoch}`,
		hitsPerPage: "50",
	});
	const res = await fetch(
		`https://hn.algolia.com/api/v1/search_by_date?${params}`,
	);
	if (!res.ok) throw new Error(`hn algolia: HTTP ${res.status}`);
	const json = (await res.json()) as { hits: AlgoliaHit[] };
	return json.hits.map((h) => {
		const isComment = h._tags.includes("comment");
		return {
			id: h.objectID,
			source: "hn" as const,
			kind: isComment ? ("comment" as const) : ("post" as const),
			community: "Hacker News",
			author: h.author,
			title: h.title ?? h.story_title ?? "",
			text: stripHtml(
				isComment
					? (h.comment_text ?? "")
					: `${h.title ?? ""}\n${h.story_text ?? ""}\n${h.url ?? ""}`,
			),
			url: `https://news.ycombinator.com/item?id=${h.objectID}`,
			createdUtc: h.created_at_i,
		};
	});
}

function stripHtml(s: string): string {
	return s
		.replace(/<[^>]+>/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#x27;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}
