import { normalizeDigits } from "../knowledge/knowledgeService.js";
import { validateMarketReferenceCatalog } from "./marketReferenceCatalogService.js";
import { validateResearchObservationBatch, validateResearchObservationTimestamp } from "./marketReferenceObservationService.js";
import { validateRawSearchResult } from "./marketReferenceResearchProvider.js";
import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { validateResearchTargets } from "./marketReferenceTargetsService.js";

function error(message) { return new MarketReferenceValidationError(message); }
function positiveInteger(value, label) { if (!Number.isSafeInteger(value) || value <= 0) throw error(`${label} must be a positive integer.`); }
function targetAttribute(category, target) {
	const key = category.variantSchema === "wattage" ? "watt" : category.variantSchema === "ampere" ? "ampere" : null;
	if (!key) return null;
	positiveInteger(target.attributes[key], `Research Target attributes.${key}`);
	return target.attributes[key];
}
function unitPattern(value, schema) {
	const unit = schema === "wattage" ? "(?:وات|w)" : "(?:آمپر|a)";
	return new RegExp(`(?<!\\d)${value}\\s*${unit}(?![\\p{L}\\p{N}])`, "iu");
}
function variantEvidence(text, value, schema) {
	const values = new Set();
	const unit = schema === "wattage" ? "(?:وات|w)" : "(?:آمپر|a)";
	const expression = new RegExp(`(?<!\\d)(\\d+)\\s*${unit}(?![\\p{L}\\p{N}])`, "giu");
	for (const match of text.matchAll(expression)) {
		const candidate = Number(match[1]);
		if (Number.isSafeInteger(candidate) && candidate > 0) values.add(candidate);
	}
	return unitPattern(value, schema).test(text) && ![...values].some((candidate) => candidate !== value);
}
function parseTomanPrices(text) {
	const expression = /(?<![\d.,٬٫])(\d{1,3}(?:[,٬]\d{3})+|\d+)\s*(?:تومان|تومن)(?![\p{L}\p{N}])/giu;
	const prices = new Set();
	for (const match of text.matchAll(expression)) {
		const token = match[1];
		const digits = token.replace(/[,٬]/g, "");
		if (!/^\d+$/.test(digits) || (/[٬,]/.test(token) && !/^\d{1,3}(?:[,٬]\d{3})+$/.test(token))) continue;
		const price = Number(digits);
		if (Number.isSafeInteger(price) && price > 0) prices.add(price);
	}
	return prices;
}
function hasPriceRange(text) {
	const amount = "(?:\\d{1,3}(?:[,٬]\\d{3})+|\\d+)";
	return new RegExp(`${amount}\\s*(?:تا|-|–|—)\\s*${amount}\\s*(?:تومان|تومن)`, "iu").test(text);
}

/** Extracts a valid batch; unsupported schemas and unusable evidence yield no observations. */
export function extractResearchObservations({ category, target, rawSearchResult, observedAt }) {
	const validatedCategory = validateMarketReferenceCatalog({ schemaVersion: 1, categories: [category] }).categories[0];
	if (!validatedCategory.enabled) throw error("Research category is disabled.");
	const validatedTarget = validateResearchTargets({ schemaVersion: 1, categoryId: validatedCategory.id, targets: [target] }).targets[0];
	const raw = validateRawSearchResult(rawSearchResult);
	validateResearchObservationTimestamp(observedAt);
	if (raw.queryId !== `${validatedCategory.id}:${validatedTarget.variantId}:price`) throw error("Raw Search Result queryId must match the research category and target.");
	const attributeValue = targetAttribute(validatedCategory, validatedTarget);
	const observations = attributeValue === null ? [] : raw.results.flatMap((result) => {
		const evidence = normalizeDigits(`${result.title}\n${result.snippet}`);
		if (!variantEvidence(evidence, attributeValue, validatedCategory.variantSchema) || hasPriceRange(evidence)) return [];
		const prices = parseTomanPrices(evidence);
		if (prices.size !== 1) return [];
		return [{ variantId: validatedTarget.variantId, price: [...prices][0], currency: "TOMAN", source: { sourceId: result.sourceId, url: result.url }, observedAt }];
	});
	return validateResearchObservationBatch({ schemaVersion: 1, categoryId: validatedCategory.id, observations });
}
