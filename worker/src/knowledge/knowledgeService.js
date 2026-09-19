import { getJson, putJson } from "../storage/configStore.js";
import { STORAGE_KEYS, knowledgeCategoryKey } from "../storage/keys.js";

export const KNOWLEDGE_CATEGORIES = Object.freeze([
	{ id: "iranian-bulbs-warranty", title: "قیمت لامپ ایرانی با ضمانت یکساله", type: "price_list" },
	{ id: "economy-bulbs", title: "لامپ اقتصادی", type: "price_list" },
	{ id: "repairs", title: "تعمیرات", type: "price_list" },
	{ id: "projectors", title: "پروژکتورها", type: "price_list" },
	{ id: "ceiling-panels", title: "پنل سقفی", type: "per_watt_price" },
	{ id: "chips", title: "چیپ", type: "text" },
]);

const MAX_RAW_TEXT_LENGTH = 20_000;
const CATEGORY_ID_PATTERN = /^[a-z][a-z0-9-]{0,62}$/;
const MAX_CATEGORY_TITLE_LENGTH = 120;
const SUPPORTED_CATEGORY_TYPES = new Set(["price_list", "per_watt_price", "text"]);
const DIGIT_MAP = Object.freeze({
	"۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
	"٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
});

function categoryError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

export function normalizeCategoryTitle(title) {
	return typeof title === "string" ? title.trim().replace(/\s+/g, " ") : "";
}

export function validateDynamicCategory(category, defaultIds = new Set(KNOWLEDGE_CATEGORIES.map((item) => item.id))) {
	if (!category || typeof category !== "object" || Array.isArray(category)) throw new Error("Knowledge category must be an object.");
	if (typeof category.id !== "string" || !CATEGORY_ID_PATTERN.test(category.id)) throw new Error("Knowledge category ID must be a lowercase slug.");
	if (defaultIds.has(category.id)) throw new Error(`Knowledge category ID conflicts with a default category: ${category.id}`);
	const title = normalizeCategoryTitle(category.title);
	if (!title || title.length > MAX_CATEGORY_TITLE_LENGTH) throw new Error("Knowledge category title is invalid.");
	if (!SUPPORTED_CATEGORY_TYPES.has(category.type)) throw new Error(`Knowledge category type is invalid: ${category.type}`);
	return { id: category.id, title, type: category.type };
}

async function categoryIdFromTitle(title) {
	const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(title)));
	const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
	return `category-${suffix}`;
}

export function getKnowledgeCategory(id, dynamicCategories = []) {
	return [...KNOWLEDGE_CATEGORIES, ...dynamicCategories].find((category) => category.id === id) ?? null;
}

export async function getDynamicKnowledgeCategories(env) {
	const storedIndex = await getJson(env, STORAGE_KEYS.KNOWLEDGE_CATEGORIES);
	if (storedIndex === null) return [];
	if (!Array.isArray(storedIndex)) throw new Error("Knowledge category registry must be an array.");

	const categoryIds = new Set(KNOWLEDGE_CATEGORIES.map((category) => category.id));
	return storedIndex.map((category) => {
		const validated = validateDynamicCategory(category, categoryIds);
		categoryIds.add(validated.id);
		return validated;
	});
}

export async function resolveKnowledgeCategory(env, id) {
	return getKnowledgeCategory(id, await getDynamicKnowledgeCategories(env));
}

export async function createDynamicKnowledgeCategory(env, titleInput, type) {
	const title = normalizeCategoryTitle(titleInput);
	if (!title || title.length > MAX_CATEGORY_TITLE_LENGTH) throw categoryError("Knowledge category title is invalid.");
	if (!SUPPORTED_CATEGORY_TYPES.has(type)) throw categoryError(`Knowledge category type is invalid: ${type}`);

	const dynamicCategories = await getDynamicKnowledgeCategories(env);
	const allCategories = [...KNOWLEDGE_CATEGORIES, ...dynamicCategories];
	if (allCategories.some((category) => normalizeCategoryTitle(category.title) === title)) {
		throw categoryError("Knowledge category title already exists.", 409);
	}

	const id = await categoryIdFromTitle(title);
	if (allCategories.some((category) => category.id === id)) throw categoryError("Knowledge category ID already exists.", 409);
	const category = { id, title, type };
	await putJson(env, STORAGE_KEYS.KNOWLEDGE_CATEGORIES, [...dynamicCategories, category]);
	return category;
}

export function normalizeDigits(value) {
	return value.replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit]);
}

function validateRawText(rawText) {
	if (typeof rawText !== "string") return "متن ورودی معتبر نیست.";
	if (!rawText.trim()) return "متن نمی‌تواند خالی باشد.";
	if (rawText.length > MAX_RAW_TEXT_LENGTH) return `متن نمی‌تواند بیش از ${MAX_RAW_TEXT_LENGTH} کاراکتر باشد.`;
	return null;
}

function priceListError(line) {
	const normalized = normalizeDigits(line).replace(/[٬,]/g, "").trim();
	const hasWatt = /وات/.test(normalized);
	const hasNumber = /\d/.test(normalized);
	if (hasWatt && !/وات\s+\d/.test(normalized)) return "قیمت مشخص نشده است.";
	if (!hasWatt && hasNumber) return "توان بر حسب وات مشخص نشده است.";
	return "فرمت هر خط باید مانند «۹ وات ۱۶۰» باشد.";
}

function parsePriceList(category, rawText) {
	const errors = [];
	const items = [];

	rawText.split(/\r?\n/).forEach((line, index) => {
		if (!line.trim()) return;
		const normalized = normalizeDigits(line).replace(/[٬,]/g, "").trim();
		const match = normalized.match(/^(\d+)\s*وات\s+(\d+)(?:\s*(?:تومان|تومن))?$/);
		if (!match) {
			errors.push({ line: index + 1, message: priceListError(line) });
			return;
		}

		const watt = Number(match[1]);
		const enteredPrice = Number(match[2]);
		if (!Number.isSafeInteger(watt) || watt <= 0 || !Number.isSafeInteger(enteredPrice) || enteredPrice <= 0) {
			errors.push({ line: index + 1, message: "توان و قیمت باید عدد صحیح مثبت باشند." });
			return;
		}

		const hasExplicitToman = /(?:تومان|تومن)$/.test(normalized);
		const projectorMillion = category.id === "projectors" && hasExplicitToman && enteredPrice < 10;
		items.push({ watt, price: enteredPrice * (projectorMillion ? 1_000_000 : 1_000) });
	});

	if (!items.length && !errors.length) errors.push({ line: 1, message: "حداقل یک ردیف قیمت وارد کنید." });
	const seenWatts = new Set();
	for (const item of items) {
		if (seenWatts.has(item.watt)) errors.push({ line: null, message: `توان ${item.watt} وات بیش از یک‌بار وارد شده است.` });
		seenWatts.add(item.watt);
	}

	return errors.length ? { valid: false, parsedData: null, errors } : { valid: true, parsedData: { items }, errors: [] };
}

function parsePerWattPrice(rawText) {
	const normalized = normalizeDigits(rawText).replace(/[٬,]/g, " ").trim();
	const numbers = [...normalized.matchAll(/\d+/g)].map((match) => Number(match[0]));
	if (numbers.length !== 1 || !/وات/.test(normalized) || numbers[0] <= 0 || !Number.isSafeInteger(numbers[0])) {
		return { valid: false, parsedData: null, errors: [{ line: 1, message: "قیمت هر وات را به‌صورت صریح وارد کنید؛ مانند «هر وات ۹۰۰۰ تومان»." }] };
	}
	return { valid: true, parsedData: { pricePerWatt: numbers[0] }, errors: [] };
}

export function parseKnowledge(category, rawText) {
	const rawError = validateRawText(rawText);
	if (rawError) return { valid: false, parsedData: null, errors: [{ line: 1, message: rawError }] };
	if (category.type === "price_list") return parsePriceList(category, rawText);
	if (category.type === "per_watt_price") return parsePerWattPrice(rawText);
	return { valid: true, parsedData: { text: rawText.trim() }, errors: [] };
}

export function buildChanges(category, previousData, nextData) {
	if (!previousData) return [{ type: "created" }];
	if (category.type === "price_list") {
		const previous = new Map((previousData.items ?? []).map((item) => [item.watt, item.price]));
		const next = new Map((nextData.items ?? []).map((item) => [item.watt, item.price]));
		const changes = [];
		for (const [watt, price] of next) {
			if (!previous.has(watt)) changes.push({ type: "added", watt, price });
			else if (previous.get(watt) !== price) changes.push({ type: "updated", watt, oldPrice: previous.get(watt), newPrice: price });
		}
		for (const [watt, price] of previous) if (!next.has(watt)) changes.push({ type: "removed", watt, price });
		return changes;
	}
	if (category.type === "per_watt_price" && previousData.pricePerWatt !== nextData.pricePerWatt) {
		return [{ type: "updated", oldPricePerWatt: previousData.pricePerWatt, newPricePerWatt: nextData.pricePerWatt }];
	}
	return JSON.stringify(previousData) === JSON.stringify(nextData) ? [] : [{ type: "updated" }];
}

export async function listKnowledgeCategories(env) {
	const dynamicCategories = await getDynamicKnowledgeCategories(env);
	return [...KNOWLEDGE_CATEGORIES, ...dynamicCategories].map((category) => ({ ...category }));
}

export async function getKnowledgeRecord(env, category) {
	return getJson(env, knowledgeCategoryKey(category.id));
}

export async function previewKnowledge(env, category, rawText) {
	const parsed = parseKnowledge(category, rawText);
	if (!parsed.valid) return { ...parsed, changed: false, changes: [] };
	const existing = await getKnowledgeRecord(env, category);
	const changes = buildChanges(category, existing?.parsedData, parsed.parsedData);
	return { ...parsed, changed: changes.length > 0, changes };
}

export async function saveKnowledge(env, category, rawText) {
	const preview = await previewKnowledge(env, category, rawText);
	if (!preview.valid || !preview.changed) return { ...preview, saved: false };
	const record = { id: category.id, title: category.title, type: category.type, rawText, parsedData: preview.parsedData, updatedAt: new Date().toISOString() };
	await putJson(env, knowledgeCategoryKey(category.id), record);
	return { ...preview, saved: true, record };
}
