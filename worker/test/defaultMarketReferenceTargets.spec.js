import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKET_REFERENCE_CATALOG } from "../src/marketReference/defaultMarketReferenceCatalog.js";
import { DEFAULT_MARKET_REFERENCE_TARGETS } from "../src/marketReference/defaultMarketReferenceTargets.js";
import { buildResearchQueries } from "../src/marketReference/marketReferenceResearchProvider.js";
import { buildResearchTargetsKey, seedDefaultMarketReferenceTargets, validateResearchTargets } from "../src/marketReference/marketReferenceTargetsService.js";

function env(initial = {}) { const values = new Map(Object.entries(initial)); return { APP_CONFIG: { get: vi.fn(async (key) => values.get(key) ?? null), put: vi.fn(async (key, value) => values.set(key, value)) }, values }; }
const byId = (id) => DEFAULT_MARKET_REFERENCE_TARGETS.find((item) => item.categoryId === id);

describe("default market reference research targets", () => {
	it("has exactly one valid, non-empty target set for each of the fifty catalog categories", () => {
		const catalogIds = DEFAULT_MARKET_REFERENCE_CATALOG.categories.map((category) => category.id);
		expect(DEFAULT_MARKET_REFERENCE_TARGETS).toHaveLength(50);
		expect(DEFAULT_MARKET_REFERENCE_TARGETS.map((item) => item.categoryId)).toEqual(catalogIds);
		for (const targetSet of DEFAULT_MARKET_REFERENCE_TARGETS) {
			expect(validateResearchTargets(targetSet)).toBe(targetSet);
			expect(new Set(targetSet.targets.map((target) => target.variantId)).size).toBe(targetSet.targets.length);
			for (const target of targetSet.targets) { expect(target.label).toMatch(/[\u0600-\u06ff]/); expect(target.variantId).toMatch(/^[a-z0-9.-]+$/); expect(Object.values(target.attributes).every((value) => typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)))).toBe(true); }
		}
	});

	it("contains representative wattage, breaker, cable, and dimensional identities without prices", () => {
		expect(byId("economy-bulbs").targets).toContainEqual({ variantId: "20w", label: "لامپ LED اقتصادی ۲۰ وات", attributes: { watt: 20 } });
		expect(byId("miniature-circuit-breakers").targets).toContainEqual(expect.objectContaining({ variantId: "1p-c16-6ka", attributes: { ampere: 16, poles: 1, curve: "C", breakingCapacityKA: 6 } }));
		expect(byId("flexible-cable").targets).toContainEqual(expect.objectContaining({ variantId: "3x2.5", attributes: { cores: 3, crossSectionMm2: 2.5 } }));
		expect(byId("trunking").targets).toContainEqual(expect.objectContaining({ variantId: "20x20mm", attributes: { widthMm: 20, heightMm: 20 } }));
		expect(JSON.stringify(DEFAULT_MARKET_REFERENCE_TARGETS)).not.toMatch(/minPrice|maxPrice|referencePrice|price/i);
	});

	it("builds Persian representative queries without searching", () => {
		for (const id of ["led-bulbs", "miniature-circuit-breakers", "flexible-cable"]) {
			const category = DEFAULT_MARKET_REFERENCE_CATALOG.categories.find((item) => item.id === id);
			const queryCategory = { id: category.id, title: category.title, variantSchema: category.variantSchema, enabled: category.enabled };
			const queries = buildResearchQueries({ category: queryCategory, targets: byId(id) });
			expect(queries[0].query).toMatch(/[\u0600-\u06ff]/); expect(queries[0].query).toContain("قیمت تومان");
		}
	});

	it("explicitly creates only missing target keys, never overwrites, and leaves catalog/datasets untouched", async () => {
		const existing = JSON.stringify(byId("economy-bulbs")); const catalog = "catalog"; const dataset = "dataset"; const value = env({ [buildResearchTargetsKey("economy-bulbs")]: existing, "market-reference:catalog": catalog, "market-reference:economy-bulbs": dataset });
		const summary = await seedDefaultMarketReferenceTargets(value);
		expect(summary.skippedCategoryIds).toEqual(["economy-bulbs"]); expect(summary.createdCategoryIds).toHaveLength(49);
		expect(value.values.get(buildResearchTargetsKey("economy-bulbs"))).toBe(existing); expect(value.values.get("market-reference:catalog")).toBe(catalog); expect(value.values.get("market-reference:economy-bulbs")).toBe(dataset);
		expect(value.APP_CONFIG.put).toHaveBeenCalledTimes(49);
		expect(await seedDefaultMarketReferenceTargets(value)).toEqual({ createdCategoryIds: [], skippedCategoryIds: DEFAULT_MARKET_REFERENCE_TARGETS.map((item) => item.categoryId) });
	});

	it("is deterministic and does not mutate the default definitions", () => {
		const original = structuredClone(DEFAULT_MARKET_REFERENCE_TARGETS);
		expect(DEFAULT_MARKET_REFERENCE_TARGETS.map((set) => set.targets.length)).toEqual(DEFAULT_MARKET_REFERENCE_TARGETS.map((set) => set.targets.length));
		expect(DEFAULT_MARKET_REFERENCE_TARGETS).toEqual(original);
	});
});
