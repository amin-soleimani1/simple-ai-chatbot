import { extractWithAiFallback } from "./marketReferenceAiEvidenceExtractor.js";
import { aggregateResearchObservations } from "./marketReferenceAggregationService.js";
import { validateMarketReferenceCatalog } from "./marketReferenceCatalogService.js";
import { extractResearchObservations } from "./marketReferenceEvidenceExtractor.js";
import { validateResearchObservationBatch, validateResearchObservationTimestamp } from "./marketReferenceObservationService.js";
import { evaluateMarketReferenceCandidate } from "./marketReferenceQualityService.js";
import { buildResearchQueries, validateRawSearchResult } from "./marketReferenceResearchProvider.js";
import { validateResearchTargets } from "./marketReferenceTargetsService.js";

export class MarketReferenceResearchRunError extends Error { constructor(message) { super(message); this.name = "MarketReferenceResearchRunError"; } }
function controlled(message) { return new MarketReferenceResearchRunError(message); }

/** Runs provider-independent research in memory only; it never publishes or persists. */
export async function runMarketReferenceResearch({ category, targets, observedAt, searchProvider, invokeModel } = {}) {
	let validCategory; let validTargets;
	try {
		validCategory = validateMarketReferenceCatalog({ schemaVersion: 1, categories: [category] }).categories[0];
		validTargets = validateResearchTargets(targets);
		validateResearchObservationTimestamp(observedAt);
	} catch { throw controlled("Research Run input is invalid."); }
	if (validCategory.id !== validTargets.categoryId) throw controlled("Research category id must match Research Targets categoryId.");
	if (typeof searchProvider !== "function") throw controlled("Research search provider is required.");
	if (invokeModel !== undefined && typeof invokeModel !== "function") throw controlled("Research AI model invoker is invalid.");
	const researchCategory = { id: validCategory.id, title: validCategory.title, variantSchema: validCategory.variantSchema, enabled: validCategory.enabled };
	let queries;
	try { queries = buildResearchQueries({ category: researchCategory, targets: validTargets }); }
	catch { throw controlled("Research query construction failed."); }
	const observations = []; let rawResultCount = 0; let deterministicObservationCount = 0; let aiObservationCount = 0;
	for (let index = 0; index < queries.length; index += 1) {
		const query = queries[index]; const target = validTargets.targets[index]; let raw;
		try { raw = await searchProvider(query); }
		catch { throw controlled("Research search provider failed."); }
		try { raw = validateRawSearchResult(raw); }
		catch { throw controlled("Research search provider returned an invalid result."); }
		if (raw.queryId !== query.queryId) throw controlled("Research search provider returned a mismatched queryId.");
		rawResultCount += raw.results.length;
		for (const rawResultItem of raw.results) {
			const deterministic = extractResearchObservations({ category: validCategory, target, rawSearchResult: { schemaVersion: 1, queryId: raw.queryId, results: [rawResultItem] }, observedAt }).observations;
			if (deterministic.length) { observations.push(deterministic[0]); deterministicObservationCount += 1; continue; }
			if (!invokeModel) continue;
			let aiObservation;
			try { aiObservation = await extractWithAiFallback({ category: validCategory, target, rawResultItem, queryId: raw.queryId, observedAt, invokeModel }); }
			catch { throw controlled("Research AI extraction failed."); }
			if (aiObservation) { observations.push(aiObservation); aiObservationCount += 1; }
		}
	}
	const batch = validateResearchObservationBatch({ schemaVersion: 1, categoryId: validCategory.id, observations });
	const aggregation = aggregateResearchObservations(batch);
	const quality = evaluateMarketReferenceCandidate({ targets: validTargets, aggregation, metadata: { title: validCategory.title, updatedAt: observedAt, researchMethod: "automated_market_research" } });
	return { schemaVersion: 1, categoryId: validCategory.id, observedAt, stats: { targetCount: validTargets.targets.length, queryCount: queries.length, rawResultCount, deterministicObservationCount, aiObservationCount, totalObservationCount: observations.length }, quality, candidate: quality.candidate };
}
