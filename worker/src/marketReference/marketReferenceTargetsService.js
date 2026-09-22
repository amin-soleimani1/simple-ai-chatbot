import { getJson, putJson } from "../storage/configStore.js";
import { marketReferenceTargetsKey } from "../storage/keys.js";
import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { DEFAULT_MARKET_REFERENCE_TARGETS } from "./defaultMarketReferenceTargets.js";
import { DEFAULT_MARKET_REFERENCE_CATALOG } from "./defaultMarketReferenceCatalog.js";
import { validateMarketReferenceCatalog } from "./marketReferenceCatalogService.js";

const RESEARCH_TARGETS_SCHEMA_VERSION = 1;

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
function validateAttributes(attributes) {
	if (!isPlainObject(attributes) || Object.keys(attributes).length === 0) throw validationError("Research Target attributes must be a non-empty plain object.");
	for (const [key, value] of Object.entries(attributes)) {
		validateNonEmptyString(key, "Research Target attribute key");
		if (typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) continue;
		throw validationError("Research Target attribute values must be JSON-safe primitives.");
	}
}

export function buildResearchTargetsKey(categoryId) {
	return marketReferenceTargetsKey(validateNonEmptyString(categoryId, "Research Targets categoryId"));
}

export function validateResearchTargets(targetSet) {
	assertExactKeys(targetSet, ["schemaVersion", "categoryId", "targets"], "Research Targets");
	if (targetSet.schemaVersion !== RESEARCH_TARGETS_SCHEMA_VERSION) throw validationError(`Research Targets schemaVersion must be ${RESEARCH_TARGETS_SCHEMA_VERSION}.`);
	validateNonEmptyString(targetSet.categoryId, "Research Targets categoryId");
	if (!Array.isArray(targetSet.targets) || targetSet.targets.length === 0) throw validationError("Research Targets targets must be a non-empty array.");
	const variantIds = new Set();
	for (const target of targetSet.targets) {
		assertExactKeys(target, ["variantId", "label", "attributes"], "Research Target");
		const variantId = validateNonEmptyString(target.variantId, "Research Target variantId");
		if (variantIds.has(variantId)) throw validationError("Research Target variantIds must be unique.");
		variantIds.add(variantId);
		validateNonEmptyString(target.label, "Research Target label");
		validateAttributes(target.attributes);
	}
	return targetSet;
}

export async function saveResearchTargets(env, targetSet) {
	const validated = validateResearchTargets(targetSet);
	await putJson(env, buildResearchTargetsKey(validated.categoryId), validated);
	return validated;
}

export async function getResearchTargets(env, categoryId) {
	let targetSet;
	try { targetSet = await getJson(env, buildResearchTargetsKey(categoryId)); }
	catch { throw validationError("Research Targets storage is invalid."); }
	if (targetSet === null) return null;
	return validateResearchTargets(targetSet);
}

/** Explicitly seeds only missing predefined target sets; it never overwrites stored targets. */
export async function seedDefaultMarketReferenceTargets(env) {
	const catalog = validateMarketReferenceCatalog(DEFAULT_MARKET_REFERENCE_CATALOG);
	const catalogIds = new Set(catalog.categories.map((category) => category.id));
	if (DEFAULT_MARKET_REFERENCE_TARGETS.length !== catalogIds.size || new Set(DEFAULT_MARKET_REFERENCE_TARGETS.map((targetSet) => targetSet.categoryId)).size !== catalogIds.size || DEFAULT_MARKET_REFERENCE_TARGETS.some((targetSet) => !catalogIds.has(targetSet.categoryId))) throw validationError("Default Research Targets do not match the Market Reference Catalog.");
	const createdCategoryIds = []; const skippedCategoryIds = [];
	for (const targetSet of DEFAULT_MARKET_REFERENCE_TARGETS) {
		const valid = validateResearchTargets(targetSet);
		const existing = await getResearchTargets(env, valid.categoryId);
		if (existing !== null) { skippedCategoryIds.push(valid.categoryId); continue; }
		await putJson(env, buildResearchTargetsKey(valid.categoryId), valid);
		createdCategoryIds.push(valid.categoryId);
	}
	return { createdCategoryIds, skippedCategoryIds };
}
