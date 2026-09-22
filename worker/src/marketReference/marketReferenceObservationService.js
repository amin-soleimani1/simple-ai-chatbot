import { MarketReferenceValidationError } from "./marketReferenceService.js";

const RESEARCH_OBSERVATION_SCHEMA_VERSION = 1;
const SUPPORTED_CURRENCY = "TOMAN";

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
	return value;
}
function validateTimestamp(value) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw validationError("Research Observation observedAt must be a valid ISO timestamp.");
}
function validateSource(source) {
	assertExactKeys(source, ["sourceId", "url"], "Research Observation source");
	validateNonEmptyString(source.sourceId, "Research Observation sourceId");
	if (typeof source.url !== "string") throw validationError("Research Observation source url must be an absolute HTTP or HTTPS URL.");
	let url;
	try { url = new URL(source.url); }
	catch { throw validationError("Research Observation source url must be an absolute HTTP or HTTPS URL."); }
	if (url.protocol !== "http:" && url.protocol !== "https:") throw validationError("Research Observation source url must be an absolute HTTP or HTTPS URL.");
}

export function validateResearchObservationBatch(batch) {
	assertExactKeys(batch, ["schemaVersion", "categoryId", "observations"], "Research Observation Batch");
	if (batch.schemaVersion !== RESEARCH_OBSERVATION_SCHEMA_VERSION) throw validationError(`Research Observation Batch schemaVersion must be ${RESEARCH_OBSERVATION_SCHEMA_VERSION}.`);
	validateNonEmptyString(batch.categoryId, "Research Observation Batch categoryId");
	if (!Array.isArray(batch.observations) || batch.observations.length === 0) throw validationError("Research Observation Batch observations must be a non-empty array.");
	for (const observation of batch.observations) {
		assertExactKeys(observation, ["variantId", "price", "currency", "source", "observedAt"], "Research Observation");
		validateNonEmptyString(observation.variantId, "Research Observation variantId");
		if (!Number.isSafeInteger(observation.price) || observation.price <= 0) throw validationError("Research Observation price must be a positive integer.");
		if (observation.currency !== SUPPORTED_CURRENCY) throw validationError(`Research Observation currency must be ${SUPPORTED_CURRENCY}.`);
		validateSource(observation.source);
		validateTimestamp(observation.observedAt);
	}
	return batch;
}
