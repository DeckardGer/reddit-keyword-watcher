import { env, type Product } from "./config";
import { windowAround } from "./match";
import type { MentionItem } from "./reddit";

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendMessage(chatId: string, html: string): Promise<void> {
	if (!env.telegramBotToken) {
		console.log(`[telegram disabled] ${html}`);
		return;
	}
	const res = await fetch(
		`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				chat_id: chatId,
				text: html,
				parse_mode: "HTML",
				link_preview_options: { is_disabled: true },
			}),
		},
	);
	if (!res.ok)
		throw new Error(`telegram: HTTP ${res.status} ${await res.text()}`);
}

export async function sendAlert(
	product: Product,
	item: MentionItem,
	keywords: string[],
	triageReason: string,
	via: "keyword" | "intent" = "keyword",
): Promise<void> {
	const chatId = product.telegramChatId ?? env.telegramChatId;
	const snippet = windowAround(item.text, keywords, 150);
	const lines = [
		`${via === "intent" ? "🎯" : "🔔"} <b>${escapeHtml(product.name)}</b> · ${item.source} · ${escapeHtml(item.community)} · ${item.kind}`,
		via === "intent"
			? "intent: request-shaped post"
			: `matched: <i>${escapeHtml(keywords.join(", "))}</i>`,
		item.title && item.kind === "post"
			? `<b>${escapeHtml(item.title)}</b>`
			: "",
		`${escapeHtml(snippet)}`,
		`— ${escapeHtml(item.author)} · <a href="${item.url}">open thread</a>`,
		triageReason !== "triage disabled"
			? `<i>${escapeHtml(triageReason)}</i>`
			: "",
	];
	await sendMessage(chatId, lines.filter(Boolean).join("\n"));
}
