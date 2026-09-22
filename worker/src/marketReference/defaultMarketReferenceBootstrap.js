import { DEFAULT_MARKET_REFERENCE_CATALOG } from "./defaultMarketReferenceCatalog.js";
import { DEFAULT_MARKET_REFERENCE_TARGETS } from "./defaultMarketReferenceTargets.js";
import { validateMarketReferenceCatalog } from "./marketReferenceCatalogService.js";
import { validateMarketReference } from "./marketReferenceService.js";
import { validateResearchTargets } from "./marketReferenceTargetsService.js";

const BOOTSTRAP_UPDATED_AT = "2026-09-22T00:00:00.000Z";
const BOOTSTRAP_RESEARCH = Object.freeze({ sampleCount: 1, method: "manual_market_research" });
const catalogById = new Map(validateMarketReferenceCatalog(DEFAULT_MARKET_REFERENCE_CATALOG).categories.map((category) => [category.id, category]));
const targetsById = new Map(DEFAULT_MARKET_REFERENCE_TARGETS.map((targetSet) => [targetSet.categoryId, validateResearchTargets(targetSet)]));

function dataset(categoryId, pricesByVariant) {
	const category = catalogById.get(categoryId); const targetSet = targetsById.get(categoryId);
	if (!category || !targetSet) throw new Error("Default Market Reference bootstrap identity is invalid.");
	const targets = new Map(targetSet.targets.map((target) => [target.variantId, target]));
	const value = {
		schemaVersion: 2, categoryId, title: category.title, updatedAt: BOOTSTRAP_UPDATED_AT, research: { ...BOOTSTRAP_RESEARCH },
		items: Object.entries(pricesByVariant).map(([variantId, prices]) => {
			const target = targets.get(variantId);
			if (!target) throw new Error("Default Market Reference bootstrap variant is invalid.");
			return { variantId, label: target.label, attributes: { ...target.attributes }, ...prices };
		}),
	};
	return validateMarketReference(value);
}

export const DEFAULT_MARKET_REFERENCE_BOOTSTRAP = [
	dataset("led-bulbs", {
		"30w-cylindrical-e27": { minPrice: 470000, referencePrice: 550000, maxPrice: 590000 },
		"40w-cylindrical-e27": { minPrice: 533066, referencePrice: 624800, maxPrice: 710000 },
		"50w-cylindrical-e27": { minPrice: 620000, referencePrice: 751400, maxPrice: 1028000 },
	}),
	dataset("halogen-bulbs", { "7w-gu10": { minPrice: 70900, referencePrice: 161100, maxPrice: 235000 } }),
];

export function validateDefaultMarketReferenceBootstrap(bootstrap = DEFAULT_MARKET_REFERENCE_BOOTSTRAP) {
	if (!Array.isArray(bootstrap) || bootstrap.length !== 2) throw new Error("Default Market Reference bootstrap is invalid.");
	const categoryIds = new Set();
	for (const value of bootstrap) {
		const valid = validateMarketReference(value);
		if (!catalogById.has(valid.categoryId) || categoryIds.has(valid.categoryId)) throw new Error("Default Market Reference bootstrap is invalid.");
		categoryIds.add(valid.categoryId);
		const targets = new Map(targetsById.get(valid.categoryId)?.targets.map((target) => [target.variantId, target]));
		for (const item of valid.items) {
			const target = targets.get(item.variantId);
			if (!target || item.label !== target.label || JSON.stringify(item.attributes) !== JSON.stringify(target.attributes)) throw new Error("Default Market Reference bootstrap target identity is invalid.");
		}
	}
	if (!["led-bulbs", "halogen-bulbs"].every((categoryId) => categoryIds.has(categoryId))) throw new Error("Default Market Reference bootstrap is invalid.");
	return bootstrap;
}
