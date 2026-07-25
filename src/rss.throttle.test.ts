import { describe, expect, test } from "bun:test";
import { HttpError, isThrottled } from "./rss";

describe("isThrottled", () => {
	test("treats 429 and 403 as throttling", () => {
		expect(isThrottled(new HttpError(429, "rate limited"))).toBe(true);
		expect(isThrottled(new HttpError(403, "blocked"))).toBe(true);
	});

	test("ignores other failures", () => {
		expect(isThrottled(new HttpError(404, "gone"))).toBe(false);
		expect(isThrottled(new HttpError(500, "server error"))).toBe(false);
		expect(isThrottled(new Error("network down"))).toBe(false);
		expect(isThrottled(null)).toBe(false);
	});
});
