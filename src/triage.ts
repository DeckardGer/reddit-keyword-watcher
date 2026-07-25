import { env, type Product } from "./config";
import { windowAround } from "./match";
import type { MentionItem } from "./reddit";

export interface TriageResult {
	relevant: boolean;
	reason: string;
}

/**
 * LLM relevance check. Fails open: if no API key is configured or the call
 * errors, the mention is treated as relevant so nothing is silently dropped.
 */
export async function triage(
	product: Product,
	item: MentionItem,
	keywords: string[],
): Promise<TriageResult> {
	if (!env.openaiApiKey) return { relevant: true, reason: "triage disabled" };
	try {
		const res = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.openaiApiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: env.triageModel,
				response_format: { type: "json_object" },
				messages: [
					{
						role: "system",
						content:
							'You triage social-media mentions for a founder. Given a product description and a post/comment that matched a keyword, decide if the founder would genuinely want to read it (someone discussing this product category, a competitor, or a problem the product solves). Coincidental word matches, unrelated topics, and bot spam are not relevant. Reply with JSON: {"relevant": boolean, "reason": "short sentence"}.',
					},
					{
						role: "user",
						content: `Product: ${product.description}\n\nMatched keywords: ${keywords.join(", ")}\nSource: ${item.source} ${item.community} (${item.kind})\nTitle: ${item.title || "(none)"}\nText (around the match): ${windowAround(item.text, keywords, 750)}`,
					},
				],
			}),
		});
		if (!res.ok) throw new Error(`openai: HTTP ${res.status}`);
		const json = (await res.json()) as {
			choices: { message: { content: string } }[];
		};
		const content = json.choices[0]?.message.content ?? "";
		const parsed = JSON.parse(content) as {
			relevant?: boolean;
			reason?: string;
		};
		return {
			relevant: parsed.relevant ?? true,
			reason: parsed.reason ?? "no reason given",
		};
	} catch (err) {
		return {
			relevant: true,
			reason: `triage error, failing open (${String(err)})`,
		};
	}
}
