import { describe, expect, test } from "bun:test";
import { buildMatcher, windowAround } from "./match";

describe("buildMatcher", () => {
	const match = buildMatcher([
		"stashr",
		"pocket alternative",
		"raindrop.io",
		"x bookmarks",
	]);

	test("matches case-insensitively on word boundaries", () => {
		expect(match("I just found Stashr and it rocks")).toEqual(["stashr"]);
		expect(match("looking for a POCKET ALTERNATIVE since it died")).toEqual([
			"pocket alternative",
		]);
	});

	test("does not match inside other words", () => {
		expect(match("the raindrops fell hard")).toEqual([]);
		expect(match("unstashrelated")).toEqual([]);
	});

	test("matches dotted keywords literally", () => {
		expect(match("try raindrop.io for this")).toEqual(["raindrop.io"]);
		expect(match("try raindropXio for this")).toEqual([]);
	});

	test("matches at start and end of text, and punctuation boundaries", () => {
		expect(match("stashr")).toEqual(["stashr"]);
		expect(match("have you tried stashr?")).toEqual(["stashr"]);
		expect(match("my x bookmarks are a mess.")).toEqual(["x bookmarks"]);
	});

	test("returns multiple hits", () => {
		expect(match("stashr vs raindrop.io comparison")).toEqual([
			"stashr",
			"raindrop.io",
		]);
	});

	test("empty text matches nothing", () => {
		expect(match("")).toEqual([]);
	});
});

describe("windowAround", () => {
	test("centers on the match in long text", () => {
		const text = `${"a".repeat(500)} people recommend stashr for this ${"b".repeat(500)}`;
		const win = windowAround(text, ["stashr"], 50);
		expect(win).toContain("stashr");
		expect(win.length).toBeLessThanOrEqual(102); // 2*radius + ellipses
		expect(win.startsWith("…")).toBe(true);
		expect(win.endsWith("…")).toBe(true);
	});

	test("no ellipses when text fits", () => {
		expect(windowAround("try stashr today", ["stashr"], 150)).toBe(
			"try stashr today",
		);
	});

	test("uses earliest keyword when several match", () => {
		const text = `first mymind here ${"x".repeat(400)} then stashr later`;
		const win = windowAround(text, ["stashr", "mymind"], 30);
		expect(win).toContain("mymind");
	});

	test("falls back to head of text when keyword missing", () => {
		expect(windowAround("some unrelated text", ["stashr"], 5)).toBe(
			"some unrel",
		);
	});
});
