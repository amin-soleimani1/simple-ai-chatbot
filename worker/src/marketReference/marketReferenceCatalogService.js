import { getJson, putJson } from "../storage/configStore.js";
import { STORAGE_KEYS } from "../storage/keys.js";
import { MarketReferenceValidationError } from "./marketReferenceService.js";
import { DEFAULT_MARKET_REFERENCE_CATALOG } from "./defaultMarketReferenceCatalog.js";

const CATALOG_SCHEMA_VERSION = 1;
const VARIANT_SCHEMAS = new Set(["wattage", "ampere", "breaker_model", "cable_size", "model", "size", "generic"]);

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

export function validateMarketReferenceCatalog(catalog) {
	assertExactKeys(catalog, ["schemaVersion", "categories"], "Market Reference Catalog");
	if (catalog.schemaVersion !== CATALOG_SCHEMA_VERSION) throw validationError(`Market Reference Catalog schemaVersion must be ${CATALOG_SCHEMA_VERSION}.`);
	if (!Array.isArray(catalog.categories) || catalog.categories.length === 0) throw validationError("Market Reference Catalog categories must be a non-empty array.");
	const ids = new Set();
	const categories = catalog.categories.map((category) => {
		assertExactKeys(category, ["id", "title", "variantSchema", "enabled", "sortOrder"], "Market Reference Catalog category");
		const id = validateNonEmptyString(category.id, "Market Reference Catalog category id");
		if (ids.has(id)) throw validationError("Market Reference Catalog category ids must be unique.");
		ids.add(id);
		const title = validateNonEmptyString(category.title, "Market Reference Catalog category title");
		if (!VARIANT_SCHEMAS.has(category.variantSchema)) throw validationError("Market Reference Catalog category variantSchema is invalid.");
		if (typeof category.enabled !== "boolean") throw validationError("Market Reference Catalog category enabled must be a boolean.");
		if (!Number.isSafeInteger(category.sortOrder) || category.sortOrder < 0) throw validationError("Market Reference Catalog category sortOrder must be a non-negative integer.");
		return { id, title, variantSchema: category.variantSchema, enabled: category.enabled, sortOrder: category.sortOrder };
	});
	return { schemaVersion: CATALOG_SCHEMA_VERSION, categories };
}

export async function getMarketReferenceCatalog(env) {
	let catalog;
	try { catalog = await getJson(env, STORAGE_KEYS.MARKET_REFERENCE_CATALOG); }
	catch { throw validationError("Market Reference Catalog storage is invalid."); }
	if (catalog === null) return null;
	return validateMarketReferenceCatalog(catalog);
}

export async function saveMarketReferenceCatalog(env, catalog) {
	const validated = validateMarketReferenceCatalog(catalog);
	await putJson(env, STORAGE_KEYS.MARKET_REFERENCE_CATALOG, validated);
	return validated;
}

export async function seedDefaultMarketReferenceCatalog(env) {
	const defaultCatalog = validateMarketReferenceCatalog(DEFAULT_MARKET_REFERENCE_CATALOG);
	const existingCatalog = await getMarketReferenceCatalog(env);
	if (existingCatalog !== null) return { seeded: false, reason: "already_exists" };
	await putJson(env, STORAGE_KEYS.MARKET_REFERENCE_CATALOG, defaultCatalog);
	return { seeded: true, reason: "created" };
}
