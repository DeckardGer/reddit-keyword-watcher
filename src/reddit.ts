import { env } from "./config";

export interface MentionItem {
	id: string;
	source: "reddit" | "hn";
	kind: "post" | "comment";
	community: string;
	author: string;
	title: string;
	text: string;
	url: string;
	createdUtc: number;
}

interface RedditListingChild {
	kind: string;
	data: {
		name: string;
		subreddit: string;
		author: string;
		title?: string;
		selftext?: string;
		body?: string;
		permalink: string;
		created_utc: number;
	};
}

export class RedditPoller {
	private token: string | null = null;
	private tokenExpiresAt = 0;

	private async getToken(): Promise<string> {
		if (this.token && Date.now() < this.tokenExpiresAt - 60_000)
			return this.token;
		const basic = btoa(`${env.redditClientId}:${env.redditClientSecret}`);
		const res = await fetch("https://www.reddit.com/api/v1/access_token", {
			method: "POST",
			headers: {
				Authorization: `Basic ${basic}`,
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": env.redditUserAgent,
			},
			body: "grant_type=client_credentials",
		});
		if (!res.ok) throw new Error(`reddit token: HTTP ${res.status}`);
		const json = (await res.json()) as {
			access_token: string;
			expires_in: number;
		};
		this.token = json.access_token;
		this.tokenExpiresAt = Date.now() + json.expires_in * 1000;
		return this.token;
	}

	private async fetchListing(path: string): Promise<MentionItem[]> {
		const token = await this.getToken();
		const res = await fetch(
			`https://oauth.reddit.com${path}?limit=100&raw_json=1`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					"User-Agent": env.redditUserAgent,
				},
			},
		);
		if (res.status === 401) {
			this.token = null; // force refresh on next call
			throw new Error("reddit: token expired (401)");
		}
		if (!res.ok) throw new Error(`reddit ${path}: HTTP ${res.status}`);
		const json = (await res.json()) as {
			data: { children: RedditListingChild[] };
		};
		return json.data.children.map((c) => {
			const d = c.data;
			const isComment = c.kind === "t1";
			return {
				id: d.name,
				source: "reddit" as const,
				kind: isComment ? ("comment" as const) : ("post" as const),
				community: `r/${d.subreddit}`,
				author: d.author,
				title: d.title ?? "",
				text: isComment
					? (d.body ?? "")
					: `${d.title ?? ""}\n${d.selftext ?? ""}`,
				url: `https://www.reddit.com${d.permalink}`,
				createdUtc: d.created_utc,
			};
		});
	}

	fetchNewComments(): Promise<MentionItem[]> {
		return this.fetchListing("/r/all/comments");
	}

	fetchNewPosts(): Promise<MentionItem[]> {
		return this.fetchListing("/r/all/new");
	}

	/** New posts across several subreddits in one request (multireddit syntax). */
	fetchWatchedPosts(subreddits: string[]): Promise<MentionItem[]> {
		return this.fetchListing(`/r/${subreddits.join("+")}/new`);
	}
}
