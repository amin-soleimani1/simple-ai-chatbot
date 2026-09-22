import { validateMarketReferenceCatalog } from "./marketReferenceCatalogService.js";
import { extractResearchObservations, matchesExactMarketVariantText, normalizeMarketEvidenceText, parseExplicitTomanPriceText } from "./marketReferenceEvidenceExtractor.js";
import { validateResearchObservationBatch, validateResearchObservationTimestamp } from "./marketReferenceObservationService.js";
import { validateRawSearchResult } from "./marketReferenceResearchProvider.js";
import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { validateResearchTargets } from "./marketReferenceTargetsService.js";

const SUPPORTED_SCHEMAS = new Set(["wattage", "ampere"]);
export class MarketReferenceAiExtractionError extends Error { constructor(message) { super(message); this.name = "MarketReferenceAiExtractionError"; } }
function validationError(message) { return new MarketReferenceValidationError(message); }
function exact(value, keys, label) {
	if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) throw validationError(`${label} is invalid.`);
}
function text(value, label) { if (typeof value !== "string" || !value.trim()) throw validationError(`${label} must be a non-empty string.`); }
function targetValue(category, target) {
	const key = category.variantSchema === "wattage" ? "watt" : "ampere";
	const value = target.attributes[key];
	if (!Number.isSafeInteger(value) || value <= 0) throw validationError(`Research Target attributes.${key} must be a positive integer.`);
	return value;
}
function validateContext({ category, target, rawResultItem, queryId, observedAt }, requireTimestamp = true) {
	const validCategory = validateMarketReferenceCatalog({ schemaVersion: 1, categories: [category] }).categories[0];
	if (!validCategory.enabled) throw validationError("Research category is disabled.");
	const validTarget = validateResearchTargets({ schemaVersion: 1, categoryId: validCategory.id, targets: [target] }).targets[0];
	const raw = validateRawSearchResult({ schemaVersion: 1, queryId, results: [rawResultItem] });
	if (raw.queryId !== `${validCategory.id}:${validTarget.variantId}:price`) throw validationError("Raw Search Result queryId must match the research category and target.");
	if (requireTimestamp) validateResearchObservationTimestamp(observedAt);
	return { category: validCategory, target: validTarget, rawResultItem: raw.results[0] };
}
function evidence(item) { return normalizeMarketEvidenceText(`${item.title}\n${item.snippet}`); }
function hasTomanMarker(text) { return /(?:تومان|تومن)/u.test(text); }

export function validateAiExtractionCandidate(candidate) {
	exact(candidate, ["schemaVersion", "matched", "variantId", "price", "currency", "evidence"], "AI Extraction Candidate");
	if (candidate.schemaVersion !== 1 || candidate.matched !== true) throw validationError("AI Extraction Candidate matched result is invalid.");
	text(candidate.variantId, "AI Extraction Candidate variantId");
	if (!Number.isSafeInteger(candidate.price) || candidate.price <= 0) throw validationError("AI Extraction Candidate price must be a positive integer.");
	if (candidate.currency !== "TOMAN") throw validationError("AI Extraction Candidate currency must be TOMAN.");
	exact(candidate.evidence, ["variantText", "priceText"], "AI Extraction Candidate evidence");
	text(candidate.evidence.variantText, "AI Extraction Candidate evidence variantText");
	text(candidate.evidence.priceText, "AI Extraction Candidate evidence priceText");
	return candidate;
}
export function validateAiNoExtractionCandidate(candidate) {
	exact(candidate, ["schemaVersion", "matched"], "AI Extraction Candidate");
	if (candidate.schemaVersion !== 1 || candidate.matched !== false) throw validationError("AI Extraction Candidate no-match result is invalid.");
	return candidate;
}
export function validateAiExtractionResult(candidate) {
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw validationError("AI Extraction Candidate is invalid.");
	return candidate.matched === false ? validateAiNoExtractionCandidate(candidate) : validateAiExtractionCandidate(candidate);
}
export function isAiFallbackEligible(input) {
	const context = validateContext(input);
	if (!SUPPORTED_SCHEMAS.has(context.category.variantSchema) || !evidence(context.rawResultItem).trim() || !hasTomanMarker(evidence(context.rawResultItem))) return false;
	targetValue(context.category, context.target);
	return extractResearchObservations({ category: context.category, target: context.target, rawSearchResult: { schemaVersion: 1, queryId: input.queryId, results: [context.rawResultItem] }, observedAt: input.observedAt }).observations.length === 0;
}
export function buildAiExtractionPrompt(input) {
	const context = validateContext(input, false);
	return `Extract one price only when it is explicitly written in the supplied evidence for the exact target. The price must explicitly use تومان or تومن. Do not convert ریال, infer currency, estimate, use outside knowledge, choose a nearby variant, or invent a price. If ambiguous or unsupported, return {"schemaVersion":1,"matched":false}. Return JSON only, without reasoning. For a match return exactly {"schemaVersion":1,"matched":true,"variantId":"...","price":123,"currency":"TOMAN","evidence":{"variantText":"...","priceText":"..."}}.\n${JSON.stringify({ categoryTitle: context.category.title, targetLabel: context.target.label, targetVariantId: context.target.variantId, targetAttributes: context.target.attributes, variantSchema: context.category.variantSchema, title: context.rawResultItem.title, snippet: context.rawResultItem.snippet })}`;
}
export function observationFromGroundedAiCandidate(input, candidate) {
	const context = validateContext(input);
	const valid = validateAiExtractionResult(candidate);
	if (!valid.matched || !SUPPORTED_SCHEMAS.has(context.category.variantSchema)) return null;
	const sourceEvidence = evidence(context.rawResultItem);
	const variantText = normalizeMarketEvidenceText(valid.evidence.variantText);
	const priceText = normalizeMarketEvidenceText(valid.evidence.priceText);
	const value = targetValue(context.category, context.target);
	if (valid.variantId !== context.target.variantId || !sourceEvidence.includes(variantText) || !sourceEvidence.includes(priceText) || !matchesExactMarketVariantText(variantText, value, context.category.variantSchema) || parseExplicitTomanPriceText(priceText) !== valid.price) return null;
	const batch = { schemaVersion: 1, categoryId: context.category.id, observations: [{ variantId: context.target.variantId, price: valid.price, currency: "TOMAN", source: { sourceId: context.rawResultItem.sourceId, url: context.rawResultItem.url }, observedAt: input.observedAt }] };
	return validateResearchObservationBatch(batch).observations[0];
}
export async function extractWithAiFallback({ invokeModel, ...input }) {
	if (typeof invokeModel !== "function") throw new MarketReferenceAiExtractionError("AI extraction model invoker is required.");
	if (!isAiFallbackEligible(input)) return null;
	let candidate;
	try { candidate = await invokeModel({ prompt: buildAiExtractionPrompt(input) }); }
	catch { throw new MarketReferenceAiExtractionError("AI extraction model invocation failed."); }
	try { return observationFromGroundedAiCandidate(input, candidate); }
	catch (cause) {
		if (cause instanceof MarketReferenceValidationError) throw new MarketReferenceAiExtractionError("AI extraction candidate was invalid.");
		throw cause;
	}
}
