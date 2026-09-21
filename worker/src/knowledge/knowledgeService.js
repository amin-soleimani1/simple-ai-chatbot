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
const CATEGORY_SCHEMA_VERSION = 2;
const CATEGORY_STATUSES = new Set(["available", "out_of_stock", "not_sold"]);
const LEGACY_CATEGORY_METADATA = Object.freeze({
	status: "available",
	showInSuggestions: false,
	sortOrder: 0,
});
const DIGIT_MAP = Object.freeze({
	"۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
	"٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
});
const PRICE_ROW_PATTERN = /^(\d+)\s*(?:وات|w)\s+(\d[\d,٬]*)(?:\s*(تومان|تومن))?$/i;

function categoryError(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

export function normalizeCategoryTitle(title) {
	return typeof title === "string" ? title.trim().replace(/\s+/g, " ") : "";
}

function hasOwn(object, key) {
	return Object.prototype.hasOwnProperty.call(object, key);
}

function hasV2Metadata(category) {
	return ["schemaVersion", "status", "showInSuggestions", "sortOrder"].some((key) => hasOwn(category, key));
}

export function normalizeCategory(category) {
	if (!category || typeof category !== "object" || Array.isArray(category)) throw new Error("Knowledge category must be an object.");
	if (typeof category.id !== "string" || !CATEGORY_ID_PATTERN.test(category.id)) throw new Error("Knowledge category ID must be a lowercase slug.");
	const title = normalizeCategoryTitle(category.title);
	if (!title || title.length > MAX_CATEGORY_TITLE_LENGTH) throw new Error("Knowledge category title is invalid.");
	if (!SUPPORTED_CATEGORY_TYPES.has(category.type)) throw new Error(`Knowledge category type is invalid: ${category.type}`);

	const normalized = { id: category.id, title, type: category.type };
	if (!hasV2Metadata(category)) return { ...normalized, ...LEGACY_CATEGORY_METADATA };
	if (category.schemaVersion !== CATEGORY_SCHEMA_VERSION) throw new Error(`Knowledge category schemaVersion must be ${CATEGORY_SCHEMA_VERSION}.`);
	if (!CATEGORY_STATUSES.has(category.status)) throw new Error(`Knowledge category status is invalid: ${category.status}`);
	if (typeof category.showInSuggestions !== "boolean") throw new Error("Knowledge category showInSuggestions must be a boolean.");
	if (!Number.isSafeInteger(category.sortOrder) || category.sortOrder < 0) throw new Error("Knowledge category sortOrder must be a non-negative integer.");
	return { ...normalized, schemaVersion: CATEGORY_SCHEMA_VERSION, status: category.status, showInSuggestions: category.showInSuggestions, sortOrder: category.sortOrder };
}

export function validateDynamicCategory(category, defaultIds = new Set(KNOWLEDGE_CATEGORIES.map((item) => item.id))) {
	const normalized = normalizeCategory(category);
	if (defaultIds.has(normalized.id)) throw new Error(`Knowledge category ID conflicts with a default category: ${normalized.id}`);
	return normalized;
}

async function categoryIdFromTitle(title) {
	const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(title)));
	const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
	return `category-${suffix}`;
}

export function getKnowledgeCategory(id, dynamicCategories = []) {
	const defaultCategory = KNOWLEDGE_CATEGORIES.find((category) => category.id === id);
	if (defaultCategory) return normalizeCategory(defaultCategory);
	return dynamicCategories.find((category) => category.id === id) ?? null;
}

async function getDynamicKnowledgeCategoryRegistry(env) {
	const storedIndex = await getJson(env, STORAGE_KEYS.KNOWLEDGE_CATEGORIES);
	if (storedIndex === null) return { storedCategories: [], categories: [] };
	if (!Array.isArray(storedIndex)) throw new Error("Knowledge category registry must be an array.");

	const categoryIds = new Set(KNOWLEDGE_CATEGORIES.map((category) => category.id));
	const categories = storedIndex.map((category) => {
		const validated = validateDynamicCategory(category, categoryIds);
		categoryIds.add(validated.id);
		return validated;
	});
	return { storedCategories: storedIndex, categories };
}

export async function getDynamicKnowledgeCategories(env) {
	return (await getDynamicKnowledgeCategoryRegistry(env)).categories;
}

export async function resolveKnowledgeCategory(env, id) {
	return getKnowledgeCategory(id, await getDynamicKnowledgeCategories(env));
}

export async function createDynamicKnowledgeCategory(env, titleInput, type, metadataInput) {
	const title = normalizeCategoryTitle(titleInput);
	if (!title || title.length > MAX_CATEGORY_TITLE_LENGTH) throw categoryError("Knowledge category title is invalid.");
	if (!SUPPORTED_CATEGORY_TYPES.has(type)) throw categoryError(`Knowledge category type is invalid: ${type}`);

	const { storedCategories, categories: dynamicCategories } = await getDynamicKnowledgeCategoryRegistry(env);
	const allCategories = [...KNOWLEDGE_CATEGORIES, ...dynamicCategories];
	if (allCategories.some((category) => normalizeCategoryTitle(category.title) === title)) {
		throw categoryError("Knowledge category title already exists.", 409);
	}

	const id = await categoryIdFromTitle(title);
	if (allCategories.some((category) => category.id === id)) throw categoryError("Knowledge category ID already exists.", 409);
	const input = { ...(metadataInput ?? {}), id, title, type };
	let storedCategory;
	try {
		storedCategory = hasV2Metadata(input)
			? normalizeCategory(input)
			: { id, title, type };
	} catch (error) {
		throw categoryError(error.message);
	}
	await putJson(env, STORAGE_KEYS.KNOWLEDGE_CATEGORIES, [...storedCategories, storedCategory]);
	return storedCategory;
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
	const hasWatt = /(?:وات|w)/i.test(normalized);
	const hasNumber = /\d/.test(normalized);
	if (hasWatt && !/(?:وات|w)\s+\d/i.test(normalized)) return "قیمت مشخص نشده است.";
	if (!hasWatt && hasNumber) return "توان بر حسب وات مشخص نشده است.";
	return "فرمت هر خط باید مانند «۹ وات ۱۶۰» باشد.";
}

export function normalizePriceToman(priceToken, unit) {
	const hasGroupingSeparator = /[,٬]/.test(priceToken);
	const digits = normalizeDigits(priceToken).replace(/[,٬]/g, "");
	if (!/^\d+$/.test(digits)) return null;

	const value = Number(digits);
	if (!Number.isSafeInteger(value) || value <= 0) return null;

	// Grouped or six-digit values are explicit full-toman amounts. A unit-attached
	// single digit (1 through 9) is the store import shorthand for millions.
	const normalized = hasGroupingSeparator || digits.length >= 6
		? value
		: unit && value <= 9
			? value * 1_000_000
			: value * 1_000;
	return Number.isSafeInteger(normalized) ? normalized : null;
}

function parsePriceRow(line) {
	const normalized = normalizeDigits(line).trim();
	const match = normalized.match(PRICE_ROW_PATTERN);
	if (!match) return null;

	const watt = Number(match[1]);
	const price = normalizePriceToman(match[2], match[3]);
	if (!Number.isSafeInteger(watt) || watt <= 0 || price === null) return null;
	return { watt, price };
}

function validPriceRow(line) {
	return parsePriceRow(line) !== null;
}

function headingLineIndex(rawText) {
	const nonEmptyLines = rawText
		.split(/\r?\n/)
		.map((line, index) => ({ line, index }))
		.filter(({ line }) => line.trim());
	const firstLine = nonEmptyLines[0];
	if (!firstLine) return null;

	const normalized = normalizeDigits(firstLine.line).trim();
	const canBeHeading = !/\d/.test(normalized) && !/وات/.test(normalized);
	const hasPriceRowAfter = nonEmptyLines.slice(1).some(({ line }) => validPriceRow(line));
	return canBeHeading && hasPriceRowAfter ? firstLine.index : null;
}

function parsePriceList(category, rawText) {
	const errors = [];
	const items = [];
	const headingIndex = headingLineIndex(rawText);

	rawText.split(/\r?\n/).forEach((line, index) => {
		if (!line.trim()) return;
		if (index === headingIndex) return;
		const item = parsePriceRow(line);
		if (!item) {
			errors.push({ line: index + 1, message: priceListError(line) });
			return;
		}
		items.push(item);
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
	return [...KNOWLEDGE_CATEGORIES.map((category) => normalizeCategory(category)), ...dynamicCategories.map((category) => ({ ...category }))];
}

export async function getKnowledgeRecord(env, category) {
	return getJson(env, knowledgeCategoryKey(category.id));
}

function runtimeCategoryData(category, record) {
	if (!record || typeof record !== "object" || Array.isArray(record)) return null;
	if (record.id !== undefined && record.id !== category.id) return null;
	if (record.type !== undefined && record.type !== category.type) return null;

	const parsedData = record.parsedData;
	if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return null;

	if (category.type === "price_list") {
		if (!Array.isArray(parsedData.items) || parsedData.items.length === 0) return null;
		const seenWatts = new Set();
		const items = [];
		for (const item of parsedData.items) {
			if (!item || !Number.isSafeInteger(item.watt) || item.watt <= 0 || !Number.isSafeInteger(item.price) || item.price <= 0 || seenWatts.has(item.watt)) return null;
			seenWatts.add(item.watt);
			items.push({ watt: item.watt, priceToman: item.price });
		}
		return { id: category.id, title: category.title, type: category.type, data: { items } };
	}

	if (category.type === "per_watt_price") {
		if (!Number.isSafeInteger(parsedData.pricePerWatt) || parsedData.pricePerWatt <= 0) return null;
		return { id: category.id, title: category.title, type: category.type, data: { pricePerWattToman: parsedData.pricePerWatt } };
	}

	if (typeof parsedData.text !== "string" || !parsedData.text.trim()) return null;
	return { id: category.id, title: category.title, type: category.type, data: { text: parsedData.text } };
}

async function getRuntimeCategoryRecord(env, category) {
	try {
		return await getKnowledgeRecord(env, category);
	} catch (error) {
		if (error instanceof Error && error.message.startsWith("Invalid JSON stored for key:")) return null;
		throw error;
	}
}

export async function getRuntimeKnowledge(env) {
	try {
		const categories = await listKnowledgeCategories(env);
		const records = await Promise.all(categories.map((category) => getRuntimeCategoryRecord(env, category)));
		return {
			available: true,
			categories: categories.flatMap((category, index) => {
				const runtimeCategory = runtimeCategoryData(category, records[index]);
				return runtimeCategory ? [runtimeCategory] : [];
			}),
		};
	} catch {
		return { available: false, categories: [] };
	}
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

function validStoredPriceItems(record) {
	const items = record?.parsedData?.items;
	if (!Array.isArray(items) || items.length === 0) return null;
	const watts = new Set();
	for (const item of items) {
		if (!item || !Number.isSafeInteger(item.watt) || item.watt <= 0 || !Number.isSafeInteger(item.price) || item.price <= 0 || watts.has(item.watt)) return null;
		watts.add(item.watt);
	}
	return items;
}

export function priceListRawText(items) {
	return items.map((item) => `${item.watt} وات ${item.price} تومان`).join("\n");
}

export async function updatePriceListItem(env, category, watt, price) {
	if (category.type !== "price_list") throw categoryError("Knowledge category is not a price list.", 400);
	if (!Number.isSafeInteger(watt) || watt <= 0) throw categoryError("Price item watt is invalid.");
	if (!Number.isSafeInteger(price) || price <= 0) throw categoryError("Price must be a positive integer.");
	const record = await getKnowledgeRecord(env, category);
	const items = validStoredPriceItems(record);
	if (!items) throw categoryError("Stored price list is invalid.", 409);
	const itemIndex = items.findIndex((item) => item.watt === watt);
	if (itemIndex < 0) throw categoryError("Price item not found.", 404);
	const nextItems = items.map((item, index) => index === itemIndex ? { ...item, price } : { ...item });
	const nextRecord = {
		...record,
		id: category.id,
		title: category.title,
		type: category.type,
		rawText: priceListRawText(nextItems),
		parsedData: { ...record.parsedData, items: nextItems },
		updatedAt: new Date().toISOString(),
	};
	await putJson(env, knowledgeCategoryKey(category.id), nextRecord);
	return nextRecord;
}

export async function addPriceListItem(env, category, watt, price) {
	if (category.type !== "price_list") throw categoryError("Knowledge category is not a price list.", 400);
	if (!Number.isSafeInteger(watt) || watt <= 0) throw categoryError("Price item watt is invalid.");
	if (!Number.isSafeInteger(price) || price <= 0) throw categoryError("Price must be a positive integer.");
	const record = await getKnowledgeRecord(env, category);
	const items = validStoredPriceItems(record);
	if (!items) throw categoryError("Stored price list is invalid.", 409);
	if (items.some((item) => item.watt === watt)) throw categoryError("Price item watt already exists.", 409);
	const nextItems = [...items.map((item) => ({ ...item })), { watt, price }].sort((left, right) => left.watt - right.watt);
	const nextRecord = {
		...record,
		id: category.id,
		title: category.title,
		type: category.type,
		rawText: priceListRawText(nextItems),
		parsedData: { ...record.parsedData, items: nextItems },
		updatedAt: new Date().toISOString(),
	};
	await putJson(env, knowledgeCategoryKey(category.id), nextRecord);
	return nextRecord;
}

export async function updatePriceListByPercentage(env, category, percentage, direction) {
	if (category.type !== "price_list") throw categoryError("Knowledge category is not a price list.", 400);
	if (!Number.isFinite(percentage) || percentage <= 0) throw categoryError("Percentage must be a positive finite number.");
	if (direction !== "increase" && direction !== "decrease") throw categoryError("Price direction is invalid.");
	if (direction === "decrease" && percentage >= 100) throw categoryError("Decrease percentage must be less than 100.");
	if (direction === "increase" && percentage > 1000) throw categoryError("Increase percentage cannot exceed 1000.");

	const record = await getKnowledgeRecord(env, category);
	const items = validStoredPriceItems(record);
	if (!items) throw categoryError("Stored price list is invalid.", 409);
	const multiplier = 1 + (direction === "increase" ? percentage : -percentage) / 100;
	const nextItems = items.map((item) => ({ ...item, price: Math.round(item.price * multiplier) }));
	if (nextItems.some((item) => !Number.isSafeInteger(item.price) || item.price <= 0)) {
		throw categoryError("Calculated price is invalid.");
	}

	const nextRecord = {
		...record,
		id: category.id,
		title: category.title,
		type: category.type,
		rawText: priceListRawText(nextItems),
		parsedData: { ...record.parsedData, items: nextItems },
		updatedAt: new Date().toISOString(),
	};
	await putJson(env, knowledgeCategoryKey(category.id), nextRecord);
	return nextRecord;
}
