import { getJson, putJson } from "../storage/configStore.js";
import { marketReferenceKey } from "../storage/keys.js";

const MARKET_REFERENCE_SCHEMA_VERSION = 2;
const LEGACY_MARKET_REFERENCE_SCHEMA_VERSION = 1;
const MARKET_RESEARCH_METHODS = new Set(["manual_market_research", "automated_market_research"]);
const DAY_MS = 24 * 60 * 60 * 1000;

export class MarketReferenceValidationError extends Error {}

function validationError(message) { return new MarketReferenceValidationError(message); }
function isPlainObject(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
function assertExactKeys(value, keys, label) {
	if (!isPlainObject(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw validationError(`${label} is invalid.`);
}
function validateNonEmptyString(value, label) {
	if (typeof value !== "string" || !value.trim()) throw validationError(`${label} must be a non-empty string.`);
	return value.trim();
}
function validatePositiveInteger(value, label) {
	if (!Number.isSafeInteger(value) || value <= 0) throw validationError(`${label} must be a positive integer.`);
	return value;
}
function timestampMs(updatedAt) {
	if (typeof updatedAt !== "string" || !updatedAt.trim()) throw validationError("Market Reference updatedAt must be a valid timestamp.");
	const milliseconds = Date.parse(updatedAt);
	if (!Number.isFinite(milliseconds)) throw validationError("Market Reference updatedAt must be a valid timestamp.");
	return milliseconds;
}
function validateRoot(reference, schemaVersion) {
	assertExactKeys(reference, ["schemaVersion", "categoryId", "title", "updatedAt", "research", "items"], "Market Reference");
	if (reference.schemaVersion !== schemaVersion) throw validationError(`Market Reference schemaVersion must be ${schemaVersion}.`);
	const categoryId = validateNonEmptyString(reference.categoryId, "Market Reference categoryId");
	const title = validateNonEmptyString(reference.title, "Market Reference title");
	timestampMs(reference.updatedAt);
	assertExactKeys(reference.research, ["sampleCount", "method"], "Market Reference research");
	const sampleCount = validatePositiveInteger(reference.research.sampleCount, "Market Reference research sampleCount");
	if (!MARKET_RESEARCH_METHODS.has(reference.research.method)) throw validationError("Market Reference research method is invalid.");
	if (!Array.isArray(reference.items) || reference.items.length === 0) throw validationError("Market Reference items must be a non-empty array.");
	return { categoryId, title, sampleCount };
}
function validatePrices(item, label) {
	const minPrice = validatePositiveInteger(item.minPrice, `${label} minPrice`);
	const referencePrice = validatePositiveInteger(item.referencePrice, `${label} referencePrice`);
	const maxPrice = validatePositiveInteger(item.maxPrice, `${label} maxPrice`);
	if (minPrice > referencePrice || referencePrice > maxPrice) throw validationError(`${label} prices must satisfy minPrice <= referencePrice <= maxPrice.`);
	return { minPrice, referencePrice, maxPrice };
}
function validateAttributes(attributes) {
	if (!isPlainObject(attributes) || Object.keys(attributes).length === 0) throw validationError("Market Reference item attributes must be a non-empty plain object.");
	for (const [key, value] of Object.entries(attributes)) {
		validateNonEmptyString(key, "Market Reference item attribute key");
		if (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) continue;
		throw validationError("Market Reference item attribute values must be JSON-safe primitives.");
	}
	return { ...attributes };
}

export function buildMarketReferenceKey(categoryId) { return marketReferenceKey(validateNonEmptyString(categoryId, "Market Reference categoryId")); }

export function validateMarketReference(reference) {
	const { categoryId, title, sampleCount } = validateRoot(reference, MARKET_REFERENCE_SCHEMA_VERSION);
	const variantIds = new Set();
	const items = reference.items.map((item) => {
		assertExactKeys(item, ["variantId", "label", "attributes", "minPrice", "referencePrice", "maxPrice"], "Market Reference item");
		const variantId = validateNonEmptyString(item.variantId, "Market Reference item variantId");
		if (variantIds.has(variantId)) throw validationError("Market Reference item variantIds must be unique.");
		variantIds.add(variantId);
		const label = validateNonEmptyString(item.label, "Market Reference item label");
		return { variantId, label, attributes: validateAttributes(item.attributes), ...validatePrices(item, "Market Reference item") };
	});
	return { schemaVersion: MARKET_REFERENCE_SCHEMA_VERSION, categoryId, title, updatedAt: reference.updatedAt, research: { sampleCount, method: reference.research.method }, items };
}

function normalizeLegacyMarketReference(reference) {
	const { categoryId, title, sampleCount } = validateRoot(reference, LEGACY_MARKET_REFERENCE_SCHEMA_VERSION);
	const watts = new Set();
	const items = reference.items.map((item) => {
		assertExactKeys(item, ["watt", "minPrice", "maxPrice", "referencePrice"], "Legacy Market Reference item");
		const watt = validatePositiveInteger(item.watt, "Legacy Market Reference item watt");
		if (watts.has(watt)) throw validationError("Legacy Market Reference item watts must be unique.");
		watts.add(watt);
		return { variantId: `${watt}w`, label: `${watt} وات`, attributes: { watt }, ...validatePrices(item, "Legacy Market Reference item") };
	});
	return { schemaVersion: MARKET_REFERENCE_SCHEMA_VERSION, categoryId, title, updatedAt: reference.updatedAt, research: { sampleCount, method: "manual_market_research" }, items };
}
function normalizeStoredMarketReference(reference) {
	if (!isPlainObject(reference)) throw validationError("Market Reference is invalid.");
	if (reference.schemaVersion === MARKET_REFERENCE_SCHEMA_VERSION) return validateMarketReference(reference);
	if (reference.schemaVersion === LEGACY_MARKET_REFERENCE_SCHEMA_VERSION) return normalizeLegacyMarketReference(reference);
	throw validationError("Market Reference schemaVersion is unsupported.");
}

export function calculateMarketReferenceFreshness(updatedAt, now = new Date()) {
	const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
	if (!Number.isFinite(nowMs)) throw validationError("Market Reference freshness time is invalid.");
	const age = nowMs - timestampMs(updatedAt);
	if (age <= 30 * DAY_MS) return "current";
	if (age <= 60 * DAY_MS) return "stale";
	return "outdated";
}
export async function saveMarketReference(env, reference) {
	const validated = validateMarketReference(reference);
	await putJson(env, buildMarketReferenceKey(validated.categoryId), validated);
	return validated;
}
export async function getMarketReference(env, categoryId, now = new Date()) {
	const reference = await getJson(env, buildMarketReferenceKey(categoryId));
	if (reference === null) return null;
	const normalized = normalizeStoredMarketReference(reference);
	return { ...normalized, freshness: calculateMarketReferenceFreshness(normalized.updatedAt, now) };
}
