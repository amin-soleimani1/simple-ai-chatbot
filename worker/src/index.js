import { createAdminSession, expiredSessionCookie, hasAdminSecrets, pinsMatch, requireAdmin, sessionCookie } from "./auth/adminSession.js";
import { addPriceListItem, createDynamicKnowledgeCategory, deletePriceListItem, getKnowledgeRecord, getRuntimeKnowledge, listKnowledgeCategories, listSuggestionCategories, previewKnowledge, resolveKnowledgeCategory, saveKnowledge, updateKnowledgeCategoryMetadata, updatePriceListByPercentage, updatePriceListItem, updatePriceListItemAvailability } from "./knowledge/knowledgeService.js";
import { getMarketReference } from "./marketReference/marketReferenceService.js";

const MAX_HISTORY_ITEMS = 6;
const MAX_MESSAGE_LENGTH = 2000;

const ALLOWED_ORIGINS = new Set([
	"https://amin-soleimani1.github.io",
	"http://localhost:5173",
	"http://127.0.0.1:5173",
]);

function corsHeaders(request) {
	const origin = request.headers.get("Origin");
	if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};

	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Credentials": "true",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
		"Vary": "Origin",
	};
};

function jsonResponse(body, status = 200, request, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"Content-Type": "application/json",
			...corsHeaders(request),
			...headers,
		},
	});
}

function optionsResponse(request) {
	if (!ALLOWED_ORIGINS.has(request.headers.get("Origin"))) return new Response(null, { status: 403 });
	return new Response(null, { status: 204, headers: corsHeaders(request) });
}

async function authenticateAdmin(request, env) {
	const rateLimit = await env.ADMIN_AUTH_RATE_LIMIT.limit({
		key: request.headers.get("CF-Connecting-IP") ?? "unknown",
	});
	if (!rateLimit.success) return jsonResponse({ success: false, error: "Too many attempts. Try again later." }, 429, request);

	let body;
	try { body = await request.json(); } catch { return jsonResponse({ success: false }, 400, request); }
	if (typeof body?.pin !== "string" || !/^\d{6}$/.test(body.pin)) return jsonResponse({ success: false }, 400, request);
	if (!hasAdminSecrets(env)) return jsonResponse({ success: false }, 503, request);
	if (!(await pinsMatch(body.pin, env.ADMIN_PIN))) return jsonResponse({ success: false }, 401, request);

	const token = await createAdminSession(env.ADMIN_SESSION_SECRET);
	return jsonResponse({ success: true }, 200, request, { "Set-Cookie": sessionCookie(token, env) });
}

async function requestBody(request) {
	try { return await request.json(); } catch { return null; }
}

function categoryNeedsMarketReference(category) {
	return category.type === "price_list"
		&& (category.status !== "available" || category.data.items.some((item) => item.available === false));
}

function marketReferenceItemsForCategory(category, reference) {
	const items = category.status === "available"
		? reference.items.filter((referenceItem) => category.data.items.some((item) => item.watt === referenceItem.watt && item.available === false))
		: reference.items;
	return items.map(({ watt, minPrice, maxPrice, referencePrice }) => ({ watt, minPrice, maxPrice, referencePrice }));
}

async function marketReferenceFallback(env, category) {
	if (!categoryNeedsMarketReference(category)) return null;
	try {
		const reference = await getMarketReference(env, category.id);
		if (!reference || reference.freshness === "outdated") return null;
		const items = marketReferenceItemsForCategory(category, reference);
		if (!items.length) return null;
		return {
			categoryId: reference.categoryId,
			title: reference.title,
			updatedAt: reference.updatedAt,
			freshness: reference.freshness,
			priceSource: "market_reference",
			items,
		};
	} catch {
		return null;
	}
}

async function marketReferenceContext(env, runtimeKnowledge) {
	const references = await Promise.all(runtimeKnowledge.categories
		.filter(categoryNeedsMarketReference)
		.map((category) => marketReferenceFallback(env, category)));
	return references.filter(Boolean);
}

async function priceTablePresentation(env, runtimeKnowledge, presentationRequest) {
	if (
		!presentationRequest
		|| presentationRequest.type !== "price_table"
		|| typeof presentationRequest.categoryId !== "string"
	) return null;

	const category = runtimeKnowledge.categories.find((item) => (
		item.id === presentationRequest.categoryId && item.type === "price_list"
	));
	if (!category || !Array.isArray(category.data?.items) || category.data.items.length === 0) return null;

	const marketReference = await marketReferenceFallback(env, category);
	return {
		type: "price_table",
		categoryId: category.id,
		title: category.title,
		status: category.status ?? "available",
		rows: category.status === "not_sold" ? [] : category.data.items.map(({ watt, priceToman, available }) => ({ watt, priceToman, available })),
		...(marketReference ? { marketReference } : {}),
	};
}

async function handleKnowledge(request, env, pathname) {
	if (!(await requireAdmin(request, env))) return jsonResponse({ authenticated: false }, 401, request);
	const parts = pathname.split("/").filter(Boolean);
	const categoryId = parts[2];
	const isPreview = parts[3] === "preview";

	if (!categoryId) {
		if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, request);
		return jsonResponse({ categories: await listKnowledgeCategories(env) }, 200, request);
	}
	if (categoryId === "categories" && parts.length === 3) {
		if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, request);
		const body = await requestBody(request);
		if (!body) return jsonResponse({ error: "Knowledge category request body is invalid." }, 400, request);
		try {
			const category = await createDynamicKnowledgeCategory(env, body.title, body.type, body);
			return jsonResponse({ category }, 201, request);
		} catch (error) {
			return jsonResponse({ error: error.message ?? "Unable to create knowledge category." }, error.status ?? 500, request);
		}
	}
	if (categoryId === "categories" && parts.length === 4) {
		if (request.method !== "PATCH") return jsonResponse({ error: "Method not allowed." }, 405, request);
		const body = await requestBody(request);
		try { return jsonResponse({ category: await updateKnowledgeCategoryMetadata(env, parts[3], body) }, 200, request); }
		catch (error) { return jsonResponse({ error: error.message ?? "Unable to update knowledge category." }, error.status ?? 500, request); }
	}
	const category = await resolveKnowledgeCategory(env, categoryId);
	if (parts[3] === "items" && parts.length === 4) {
		if (!category) return jsonResponse({ error: "Knowledge category not found." }, 404, request);
		const body = await requestBody(request);
		if (request.method === "POST") {
			if (!body || !Number.isSafeInteger(body.watt) || !Number.isSafeInteger(body.price)) return jsonResponse({ error: "Price item request is invalid." }, 400, request);
			try {
				return jsonResponse({ record: await addPriceListItem(env, category, body.watt, body.price) }, 201, request);
			} catch (error) {
				return jsonResponse({ error: error.message ?? "Unable to add price item." }, error.status ?? 500, request);
			}
		}
		if (request.method !== "PATCH") return jsonResponse({ error: "Method not allowed." }, 405, request);
		if (!body || !Number.isFinite(body.percentage) || typeof body.direction !== "string") return jsonResponse({ error: "Batch price update request is invalid." }, 400, request);
		try {
			return jsonResponse({ record: await updatePriceListByPercentage(env, category, body.percentage, body.direction) }, 200, request);
		} catch (error) {
			return jsonResponse({ error: error.message ?? "Unable to update prices." }, error.status ?? 500, request);
		}
	}
	if (parts[3] === "items" && parts.length === 5) {
		if (!category) return jsonResponse({ error: "Knowledge category not found." }, 404, request);
		const watt = Number(parts[4]);
		if (request.method === "DELETE") {
			try {
				return jsonResponse({ record: await deletePriceListItem(env, category, watt) }, 200, request);
			} catch (error) {
				return jsonResponse({ error: error.message ?? "Unable to delete price item." }, error.status ?? 500, request);
			}
		}
		if (request.method !== "PATCH") return jsonResponse({ error: "Method not allowed." }, 405, request);
		const body = await requestBody(request);
		if (!body || !Number.isSafeInteger(body.price)) return jsonResponse({ error: "Price must be a positive integer." }, 400, request);
		try {
			return jsonResponse({ record: await updatePriceListItem(env, category, watt, body.price) }, 200, request);
		} catch (error) {
			return jsonResponse({ error: error.message ?? "Unable to update price." }, error.status ?? 500, request);
		}
	}
	if (parts[3] === "items" && parts[5] === "availability" && parts.length === 6) {
		if (!category) return jsonResponse({ error: "Knowledge category not found." }, 404, request);
		if (request.method !== "PATCH") return jsonResponse({ error: "Method not allowed." }, 405, request);
		const body = await requestBody(request);
		const watt = Number(parts[4]);
		if (!body || typeof body.available !== "boolean") return jsonResponse({ error: "Price item availability must be a boolean." }, 400, request);
		try {
			return jsonResponse({ record: await updatePriceListItemAvailability(env, category, watt, body.available) }, 200, request);
		} catch (error) {
			return jsonResponse({ error: error.message ?? "Unable to update price item availability." }, error.status ?? 500, request);
		}
	}
	if (!category || (parts.length > 3 && !isPreview) || parts.length > 4) return jsonResponse({ error: "Knowledge category not found." }, 404, request);
	if (isPreview) {
		if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, request);
		const body = await requestBody(request);
		if (!body || typeof body.rawText !== "string") return jsonResponse({ valid: false, changed: false, parsedData: null, changes: [], errors: [{ line: 1, message: "متن ورودی معتبر نیست." }] }, 400, request);
		const preview = await previewKnowledge(env, category, body.rawText);
		return jsonResponse(preview, preview.valid ? 200 : 400, request);
	}
	if (request.method === "GET") return jsonResponse({ category, knowledge: await getKnowledgeRecord(env, category) }, 200, request);
	if (request.method !== "PUT") return jsonResponse({ error: "Method not allowed." }, 405, request);
	const body = await requestBody(request);
	if (!body || typeof body.rawText !== "string") return jsonResponse({ valid: false, changed: false, parsedData: null, changes: [], errors: [{ line: 1, message: "متن ورودی معتبر نیست." }] }, 400, request);
	const result = await saveKnowledge(env, category, body.rawText);
	return jsonResponse(result, result.valid ? 200 : 400, request);
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") {
			return optionsResponse(request);
		}

		const { pathname } = new URL(request.url);

		if (pathname === "/admin/auth") {
			if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, request);
			return authenticateAdmin(request, env);
		}

		if (pathname === "/admin/session") {
			if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, request);
			const authenticated = await requireAdmin(request, env);
			return jsonResponse({ authenticated }, authenticated ? 200 : 401, request);
		}

		if (pathname === "/admin/logout") {
			if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405, request);
			return jsonResponse({ success: true }, 200, request, { "Set-Cookie": expiredSessionCookie(env) });
		}

		if (pathname === "/suggestions") {
			if (request.method !== "GET") return jsonResponse({ error: "Method not allowed." }, 405, request);
			try {
				return jsonResponse({ suggestions: await listSuggestionCategories(env) }, 200, request);
			} catch {
				return jsonResponse({ error: "Unable to access knowledge storage." }, 500, request);
			}
		}

		if (pathname === "/admin/knowledge" || pathname.startsWith("/admin/knowledge/")) {
			try {
				return await handleKnowledge(request, env, pathname);
			} catch {
				return jsonResponse({ error: "Unable to access knowledge storage." }, 500, request);
			}
		}

		if (pathname !== "/chat") {
			return jsonResponse({ error: "Endpoint not found." }, 404, request);
		}

		if (request.method !== "POST") {
			return jsonResponse({ error: "Method not allowed." }, 405, request);
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Request body must be valid JSON." }, 400, request);
		}

		if (typeof body?.message !== "string" || !body.message.trim() || body.message.trim().length > MAX_MESSAGE_LENGTH) {
			return jsonResponse({ error: "Message must be a non-empty string." }, 400, request);
		}

		if (body.history !== undefined && !Array.isArray(body.history)) {
			return jsonResponse({ error: "History must be an array." }, 400, request);
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
			return jsonResponse({ error: "History contains an invalid message." }, 400, request);
		}

		try {
			const runtimeKnowledge = await getRuntimeKnowledge(env);
			const presentation = await priceTablePresentation(env, runtimeKnowledge, body.presentationRequest);
			if (presentation) {
				return jsonResponse({ message: presentation.title, presentation }, 200, request);
			}
			const marketReferences = await marketReferenceContext(env, runtimeKnowledge);
			const products = {
				available: runtimeKnowledge.available,
				categories: runtimeKnowledge.categories.map((category) => ({ ...category, priceSource: "store" })),
				marketReferences,
				usageRules: [
					"Category status is authoritative and takes precedence over item availability: for not_sold state the store does not offer the category and stored prices are never current purchasable prices; for out_of_stock state the whole category is unavailable and stored prices are only last recorded prices; only when category status is available may an item with available=true be presented as available. An item with available=false is currently unavailable and its stored price must never be presented as a current purchasable price.",
					"Entries with priceSource=store are official store data. Entries with priceSource=market_reference are approximate market references, never store prices. Market references may only be used when their freshness is current or stale, only for the matching watt when an available category item is unavailable, and for unavailable or not_sold categories. For stale references, state that the data is older and include updatedAt. Never use an outdated reference as a current market price. If no valid matching market reference is present, say that current market-reference data is insufficient; never invent, substitute, interpolate, or infer a market price.",
					"Use only this Knowledge for store information, prices, inventory, and services.",
					"Never guess prices or store information.",
					"If requested information is absent from Knowledge, clearly say it is not available.",
					"If available is false, do not provide commercial or pricing information from general model knowledge.",
					"قانون قطعی محاسبات: هر محاسبه را فقط داخلی انجام بده. در پاسخ نهایی فقط نتیجه نهایی را کوتاه و طبیعی اعلام کن. هرگز operands، operators، equation، formula، ضرب، جمع، مراحل محاسبه یا reasoning محاسباتی را نمایش نده. نمایش عبارت‌هایی مانند «24 × 9000»، «24 * 9000»، «9000 تومان به ازای هر وات = ...» یا هر شکل دیگری از فرمول و مراحل محاسبه ممنوع است. اگر قیمت نیاز به محاسبه دارد، مستقیماً قیمت محاسبه‌شده را اعلام کن. مثال صرفاً برای الگوی پاسخ و نه قانون خاص پنل: User: «قیمت پنل سقفی ۲۴ وات چقدره؟» Correct: «قیمت پنل سقفی ۲۴ وات، ۲۱۶ هزار تومان است.» Incorrect: «۲۴ × ۹۰۰۰ = ۲۱۶۰۰۰ تومان».",
				],
			};
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

			return jsonResponse({ message: result.response }, 200, request);
		} catch {
			return jsonResponse({ error: "Unable to generate a response." }, 502, request);
		}
	},
};
