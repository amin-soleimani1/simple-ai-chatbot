import { validateAggregationResult } from "./marketReferenceAggregationService.js";
import { validateResearchTargets } from "./marketReferenceTargetsService.js";
import { validateMarketReference, MarketReferenceValidationError } from "./marketReferenceService.js";

export const MIN_RETAINED_OBSERVATIONS = 3;
export const MIN_INDEPENDENT_SOURCES = 2;
export const MAX_PRICE_DISPERSION = 0.50;

function validationError(message) { return new MarketReferenceValidationError(message); }
function validateMetadata(metadata) {
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata) || Object.keys(metadata).length !== 3 || !["title", "updatedAt", "researchMethod"].every((key) => key in metadata)) throw validationError("Candidate metadata is invalid.");
	if (typeof metadata.title !== "string" || !metadata.title.trim() || typeof metadata.updatedAt !== "string" || !metadata.updatedAt.trim() || metadata.researchMethod !== "manual_market_research") throw validationError("Candidate metadata is invalid.");
	return metadata;
}

export function evaluateMarketReferenceCandidate({ targets, aggregation, metadata }) {
	const validTargets = validateResearchTargets(targets);
	const validAggregation = validateAggregationResult(aggregation);
	const validMetadata = validateMetadata(metadata);
	if (validTargets.categoryId !== validAggregation.categoryId) throw validationError("Research Targets and Aggregation Result categoryId must match.");
	const aggregatedById = new Map(validAggregation.variants.map((variant) => [variant.variantId, variant]));
	const targetIds = new Set(validTargets.targets.map((target) => target.variantId));
	const evaluations = validTargets.targets.map((target) => {
		const aggregate = aggregatedById.get(target.variantId);
		if (!aggregate) return { variantId: target.variantId, passed: false, reasons: ["MISSING_AGGREGATION"] };
		const reasons = [];
		if (aggregate.stats.retainedObservationCount < MIN_RETAINED_OBSERVATIONS) reasons.push("INSUFFICIENT_OBSERVATIONS");
		if (aggregate.stats.independentSourceCount < MIN_INDEPENDENT_SOURCES) reasons.push("INSUFFICIENT_SOURCES");
		if ((aggregate.maxPrice - aggregate.minPrice) / aggregate.referencePrice > MAX_PRICE_DISPERSION) reasons.push("EXCESSIVE_DISPERSION");
		return { variantId: target.variantId, passed: reasons.length === 0, reasons };
	});
	for (const aggregate of validAggregation.variants) if (!targetIds.has(aggregate.variantId)) evaluations.push({ variantId: aggregate.variantId, passed: false, reasons: ["UNKNOWN_VARIANT"] });
	const passed = evaluations.every((evaluation) => evaluation.passed);
	if (!passed) return { passed: false, eligible: false, variants: evaluations, candidate: null };
	const items = validTargets.targets.map((target) => {
		const aggregate = aggregatedById.get(target.variantId);
		return { variantId: target.variantId, label: target.label, attributes: { ...target.attributes }, minPrice: aggregate.minPrice, referencePrice: aggregate.referencePrice, maxPrice: aggregate.maxPrice };
	});
	const candidate = validateMarketReference({ schemaVersion: 2, categoryId: validTargets.categoryId, title: validMetadata.title, updatedAt: validMetadata.updatedAt, research: { sampleCount: validAggregation.variants.reduce((total, variant) => total + variant.stats.retainedObservationCount, 0), method: validMetadata.researchMethod }, items });
	return { passed: true, eligible: true, variants: evaluations, candidate };
}
