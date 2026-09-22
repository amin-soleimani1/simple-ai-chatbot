import { getJson, putJson } from "../storage/configStore.js";
import { marketReferenceKey } from "../storage/keys.js";

const MARKET_REFERENCE_SCHEMA_VERSION = 1;
const MARKET_RESEARCH_METHOD = "manual_market_research";
const DAY_MS = 24 * 60 * 60 * 1000;

export class MarketReferenceValidationError extends Error {}

function validationError(message) {
	return new MarketReferenceValidationError(message);
}

function isPlainObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value, keys, label) {
	if (!isPlainObject(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) {
		throw validationError(`${label} is invalid.`);
	}
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

export function buildMarketReferenceKey(categoryId) {
	return marketReferenceKey(validateNonEmptyString(categoryId, "Market Reference categoryId"));
}

export function validateMarketReference(reference) {
	assertExactKeys(reference, ["schemaVersion", "categoryId", "title", "updatedAt", "research", "items"], "Market Reference");
	if (reference.schemaVersion !== MARKET_REFERENCE_SCHEMA_VERSION) throw validationError(`Market Reference schemaVersion must be ${MARKET_REFERENCE_SCHEMA_VERSION}.`);
	const categoryId = validateNonEmptyString(reference.categoryId, "Market Reference categoryId");
	const title = validateNonEmptyString(reference.title, "Market Reference title");
	timestampMs(reference.updatedAt);

	assertExactKeys(reference.research, ["sampleCount", "method"], "Market Reference research");
	const sampleCount = validatePositiveInteger(reference.research.sampleCount, "Market Reference research sampleCount");
	if (reference.research.method !== MARKET_RESEARCH_METHOD) throw validationError(`Market Reference research method must be ${MARKET_RESEARCH_METHOD}.`);
	if (!Array.isArray(reference.items) || reference.items.length === 0) throw validationError("Market Reference items must be a non-empty array.");

	const watts = new Set();
	const items = reference.items.map((item) => {
		assertExactKeys(item, ["watt", "minPrice", "maxPrice", "referencePrice"], "Market Reference item");
		const watt = validatePositiveInteger(item.watt, "Market Reference item watt");
		if (watts.has(watt)) throw validationError("Market Reference item watts must be unique.");
		watts.add(watt);
		const minPrice = validatePositiveInteger(item.minPrice, "Market Reference item minPrice");
		const maxPrice = validatePositiveInteger(item.maxPrice, "Market Reference item maxPrice");
		const referencePrice = validatePositiveInteger(item.referencePrice, "Market Reference item referencePrice");
		if (minPrice > referencePrice || referencePrice > maxPrice) throw validationError("Market Reference item prices must satisfy minPrice <= referencePrice <= maxPrice.");
		return { watt, minPrice, maxPrice, referencePrice };
	});

	return {
		schemaVersion: MARKET_REFERENCE_SCHEMA_VERSION,
		categoryId,
		title,
		updatedAt: reference.updatedAt,
		research: { sampleCount, method: MARKET_RESEARCH_METHOD },
		items,
	};
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
	const validated = validateMarketReference(reference);
	return { ...validated, freshness: calculateMarketReferenceFreshness(validated.updatedAt, now) };
}
