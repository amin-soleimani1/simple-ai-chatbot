import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { validateResearchObservationBatch } from "./marketReferenceObservationService.js";

const AGGREGATION_SCHEMA_VERSION = 1;

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
