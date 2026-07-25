import { describe, expect, test } from "bun:test";
import { buildTopicGate, isRequestPost } from "./intent";

describe("isRequestPost", () => {
	test("detects question-mark titles", () => {
		expect(isRequestPost("Best way to keep TikTok saves?")).toBe(true);
	});

	test("detects request phrasing in title", () => {
		expect(isRequestPost("Is there a tool that archives saved posts")).toBe(true);
		expect(isRequestPost("Looking for something to organize my links")).toBe(true);
		expect(isRequestPost("How do I export my Twitter bookmarks")).toBe(true);
		expect(isRequestPost("Alternative to Pocket now that it's dead")).toBe(true);
	});

	test("ignores non-request posts", () => {
		expect(isRequestPost("I built a new productivity dashboard")).toBe(false);
		expect(isRequestPost("My 2026 setup tour")).toBe(false);
	});

	test("ignores request phrasing that only appears in a body", () => {
		// Title-only by design: show-off posts often muse "how do I..." mid-body.
		expect(isRequestPost("I built a personal knowledge system for things")).toBe(false);
	});
});

describe("buildTopicGate", () => {
	const gate = buildTopicGate(["save", "bookmark", "read later"]);

	test("passes texts containing a topic word", () => {
		expect(gate("how do I save articles for later")).toBe(true);
		expect(gate("my bookmark folder is chaos")).toBe(true);
		expect(gate("need a read later workflow")).toBe(true);
	});

	test("rejects off-topic texts and partial words", () => {
		expect(gate("what mechanical keyboard should I buy")).toBe(false);
		expect(gate("the lifesaver keychain broke")).toBe(false);
	});
});
