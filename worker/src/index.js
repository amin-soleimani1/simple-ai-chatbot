import { products } from "./knowledge.js";

const MAX_HISTORY_ITEMS = 6;
const MAX_MESSAGE_LENGTH = 2000;

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...CORS_HEADERS,
		},
	});
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}

		const { pathname } = new URL(request.url);

		if (pathname !== "/chat") {
			return jsonResponse({ error: "Endpoint not found." }, 404);
		}

		if (request.method !== "POST") {
			return jsonResponse({ error: "Method not allowed." }, 405);
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Request body must be valid JSON." }, 400);
		}

		if (typeof body?.message !== "string" || !body.message.trim() || body.message.trim().length > MAX_MESSAGE_LENGTH) {
			return jsonResponse({ error: "Message must be a non-empty string." }, 400);
		}

		if (body.history !== undefined && !Array.isArray(body.history)) {
			return jsonResponse({ error: "History must be an array." }, 400);
		}

		const history = (body.history ?? []).slice(-MAX_HISTORY_ITEMS);
		const hasInvalidHistoryItem = history.some((item) => (
			!item
			|| (item.role !== "user" && item.role !== "assistant")
			|| typeof item.content !== "string"
			|| !item.content.trim()
			|| item.content.trim().length > MAX_MESSAGE_LENGTH
		));

		if (hasInvalidHistoryItem) {
			return jsonResponse({ error: "History contains an invalid message." }, 400);
		}

		try {
			const result = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
				messages: [
					{
						role: "system",
						content: `تو دستیار فروشگاه کالای روشنایی کیان هستی. همیشه به فارسی طبیعی، کوتاه و واضح پاسخ بده. برای اطلاعات محصولات و قیمت‌ها فقط از Knowledge زیر استفاده کن. اگر اطلاعات مورد سؤال در Knowledge وجود ندارد، صریحاً بگو اطلاعات آن در حال حاضر موجود نیست. قیمت، موجودی، گارانتی، ویژگی محصول یا اطلاعات فروشگاه را حدس نزن و جعل نکن. کاربر را به صفحه، بخش یا سرویسی که وجود آن در Knowledge مشخص نشده ارجاع نده. لازم نیست متن کامل Knowledge را نمایش دهی و فقط اطلاعات مرتبط با سؤال را استفاده کن.\n\nKnowledge:\n${JSON.stringify(products)}`,
					},
					...history.map((item) => ({ role: item.role, content: item.content.trim() })),
					{ role: "user", content: body.message.trim() },
				],
			});

			if (typeof result.response !== "string") {
				throw new Error("Unexpected AI response");
			}

			return jsonResponse({ message: result.response });
		} catch {
			return jsonResponse({ error: "Unable to generate a response." }, 502);
		}
	},
};
