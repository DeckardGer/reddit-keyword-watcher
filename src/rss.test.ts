import { describe, expect, test } from "bun:test";
import { parseRedditAtom } from "./rss";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><category term="PKMS" label="r/PKMS"/><updated>2026-07-25T10:00:00+00:00</updated><id>/r/PKMS/new.rss</id><title>newest submissions : PKMS</title><entry><author><name>/u/tester</name><uri>https://www.reddit.com/user/tester</uri></author><category term="PKMS" label="r/PKMS"/><content type="html">&lt;!-- SC_OFF --&gt;&lt;div class="md"&gt;&lt;p&gt;Is there a tool that saves &amp;amp; organizes posts?&lt;/p&gt;&lt;/div&gt;&lt;!-- SC_ON --&gt;</content><id>t3_1abcd2</id><link href="https://www.reddit.com/r/PKMS/comments/1abcd2/looking_for_a_tool/"/><updated>2026-07-25T09:30:00+00:00</updated><published>2026-07-25T09:30:00+00:00</published><title>Looking for a tool to organize saves</title></entry><entry><author><name>/u/other</name></author><category term="PKMS" label="r/PKMS"/><content type="html">&lt;p&gt;My setup tour&lt;/p&gt;</content><id>t3_1abcd3</id><link href="https://www.reddit.com/r/PKMS/comments/1abcd3/setup/"/><updated>2026-07-25T09:00:00+00:00</updated><published>2026-07-25T09:00:00+00:00</published><title>My 2026 PKM setup</title></entry></feed>`;

describe("parseRedditAtom", () => {
	const items = parseRedditAtom(SAMPLE);

	test("parses all entries", () => {
		expect(items).toHaveLength(2);
	});

	test("extracts fields and decodes entities", () => {
		const first = items[0];
		expect(first?.id).toBe("t3_1abcd2");
		expect(first?.community).toBe("r/PKMS");
		expect(first?.author).toBe("tester");
		expect(first?.title).toBe("Looking for a tool to organize saves");
		expect(first?.text).toContain("saves & organizes posts");
		expect(first?.text).not.toContain("<p>");
		expect(first?.url).toBe("https://www.reddit.com/r/PKMS/comments/1abcd2/looking_for_a_tool/");
		expect(first?.createdUtc).toBe(Math.floor(Date.parse("2026-07-25T09:30:00+00:00") / 1000));
	});

	test("items are posts from reddit", () => {
		expect(items.every((i) => i.kind === "post" && i.source === "reddit")).toBe(true);
	});

	test("empty feed parses to empty list", () => {
		expect(parseRedditAtom("<feed></feed>")).toEqual([]);
	});
});
