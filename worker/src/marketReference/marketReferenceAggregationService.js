import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { validateResearchObservationBatch } from "./marketReferenceObservationService.js";

const AGGREGATION_SCHEMA_VERSION = 1;

function validationError(message) { return new MarketReferenceValidationError(message); }
function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function assertExactKeys(value, keys, label) { if (!isPlainObject(value) || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw validationError(`${label} is invalid.`); }
function nonEmptyString(value, label) { if (typeof value !== "string" || !value.trim()) throw validationError(`${label} must be a non-empty string.`); }
function nonNegativeInteger(value, label) { if (!Number.isSafeInteger(value) || value < 0) throw validationError(`${label} must be a non-negative integer.`); }

function median(values) {
	const middle = Math.floor(values.length / 2);
	return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
function observationTimestamp(observation) { return Date.parse(observation.observedAt); }
function deduplicate(observations) {
	const evidence = new Map();
	for (const [index, observation] of observations.entries()) {
		const key = JSON.stringify([observation.source.sourceId, observation.source.url]);
		const existing = evidence.get(key);
		if (!existing || observationTimestamp(observation) > observationTimestamp(existing.observation)) evidence.set(key, { observation, index });
	}
	return [...evidence.values()].map(({ observation }) => observation);
}
function filterOutliers(observations) {
	if (observations.length < 4) return observations;
	const prices = observations.map((observation) => observation.price).sort((a, b) => a - b);
	const middle = Math.floor(prices.length / 2);
	const lowerHalf = prices.slice(0, middle);
	const upperHalf = prices.slice(prices.length % 2 === 0 ? middle : middle + 1);
	const q1 = median(lowerHalf);
	const q3 = median(upperHalf);
	const iqr = q3 - q1;
	const lowerFence = q1 - 1.5 * iqr;
	const upperFence = q3 + 1.5 * iqr;
	return observations.filter((observation) => observation.price >= lowerFence && observation.price <= upperFence);
}
function aggregateVariant(variantId, observations) {
	const deduplicated = deduplicate(observations);
	const retained = filterOutliers(deduplicated);
	if (!retained.length) throw new MarketReferenceValidationError("Research Observation aggregation retained no observations.");
	const prices = retained.map((observation) => observation.price).sort((a, b) => a - b);
	return {
		variantId,
		minPrice: prices[0],
		referencePrice: Math.round(median(prices)),
		maxPrice: prices[prices.length - 1],
		stats: {
			rawObservationCount: observations.length,
			deduplicatedObservationCount: deduplicated.length,
			retainedObservationCount: retained.length,
			outlierCount: deduplicated.length - retained.length,
			independentSourceCount: new Set(retained.map((observation) => observation.source.sourceId)).size,
		},
	};
}

export function aggregateResearchObservations(batch) {
	const validated = validateResearchObservationBatch(batch);
	const byVariant = new Map();
	for (const observation of validated.observations) {
		const observations = byVariant.get(observation.variantId) ?? [];
		observations.push(observation);
		byVariant.set(observation.variantId, observations);
	}
	return {
		schemaVersion: AGGREGATION_SCHEMA_VERSION,
		categoryId: validated.categoryId,
		variants: [...byVariant.entries()]
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([variantId, observations]) => aggregateVariant(variantId, observations)),
	};
}

export function validateAggregationResult(result) {
	assertExactKeys(result, ["schemaVersion", "categoryId", "variants"], "Aggregation Result");
	if (result.schemaVersion !== AGGREGATION_SCHEMA_VERSION) throw validationError(`Aggregation Result schemaVersion must be ${AGGREGATION_SCHEMA_VERSION}.`);
	nonEmptyString(result.categoryId, "Aggregation Result categoryId");
	if (!Array.isArray(result.variants) || result.variants.length === 0) throw validationError("Aggregation Result variants must be a non-empty array.");
	const variantIds = new Set();
	for (const variant of result.variants) {
		assertExactKeys(variant, ["variantId", "minPrice", "referencePrice", "maxPrice", "stats"], "Aggregation Result variant");
		nonEmptyString(variant.variantId, "Aggregation Result variantId");
		if (variantIds.has(variant.variantId)) throw validationError("Aggregation Result variantIds must be unique.");
		variantIds.add(variant.variantId);
		for (const key of ["minPrice", "referencePrice", "maxPrice"]) if (!Number.isSafeInteger(variant[key]) || variant[key] <= 0) throw validationError(`Aggregation Result ${key} must be a positive integer.`);
		if (variant.minPrice > variant.referencePrice || variant.referencePrice > variant.maxPrice) throw validationError("Aggregation Result prices must satisfy minPrice <= referencePrice <= maxPrice.");
		assertExactKeys(variant.stats, ["rawObservationCount", "deduplicatedObservationCount", "retainedObservationCount", "outlierCount", "independentSourceCount"], "Aggregation Result stats");
		for (const key of Object.keys(variant.stats)) nonNegativeInteger(variant.stats[key], `Aggregation Result stats ${key}`);
		const stats = variant.stats;
		if (stats.retainedObservationCount < 1 || stats.independentSourceCount > stats.retainedObservationCount || stats.rawObservationCount < stats.deduplicatedObservationCount || stats.deduplicatedObservationCount < stats.retainedObservationCount || stats.outlierCount !== stats.deduplicatedObservationCount - stats.retainedObservationCount) throw validationError("Aggregation Result stats are inconsistent.");
	}
	return result;
}
