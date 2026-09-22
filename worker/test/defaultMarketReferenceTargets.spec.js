import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKET_REFERENCE_CATALOG } from "../src/marketReference/defaultMarketReferenceCatalog.js";
import { DEFAULT_MARKET_REFERENCE_TARGETS } from "../src/marketReference/defaultMarketReferenceTargets.js";
import { buildResearchQueries } from "../src/marketReference/marketReferenceResearchProvider.js";
import { buildResearchTargetsKey, seedDefaultMarketReferenceTargets, validateResearchTargets } from "../src/marketReference/marketReferenceTargetsService.js";

function env(initial = {}) { const values = new Map(Object.entries(initial)); return { APP_CONFIG: { get: vi.fn(async (key) => values.get(key) ?? null), put: vi.fn(async (key, value) => values.set(key, value)) }, values }; }
const byId = (id) => DEFAULT_MARKET_REFERENCE_TARGETS.find((item) => item.categoryId === id);
const fa = (value) => String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]);

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

	it("refines only Batch-1 bulb identities while preserving economy bulbs and categories six through fifty", () => {
		expect(byId("economy-bulbs").targets).toEqual([9, 12, 15, 20, 30, 50].map((watt) => ({ variantId: `${watt}w`, label: `لامپ LED اقتصادی ${fa(watt)} وات`, attributes: { watt } })));
		for (const target of byId("led-bulbs").targets) expect(target.attributes).toMatchObject({ formFactor: target.attributes.watt <= 20 ? "a-bulb" : "cylindrical", socketType: "E27" });
		for (const target of byId("filament-bulbs").targets) expect(target.attributes).toMatchObject({ shape: "a60", socketType: "E27" });
		for (const target of byId("candle-bulbs").targets) expect(target.attributes).toMatchObject({ shape: "candle", socketType: "E14" });
		for (const target of byId("halogen-bulbs").targets) expect(target.attributes).toMatchObject({ socketType: "GU10" });
		expect(DEFAULT_MARKET_REFERENCE_TARGETS.slice(5).map((targetSet) => [targetSet.categoryId, targetSet.targets.length])).toEqual([["led-tube-lights", 3], ["led-strips", 3], ["led-modules", 4], ["led-chips", 5], ["led-drivers", 5], ["led-power-supplies", 5], ["ceiling-panels", 5], ["downlights", 4], ["spotlights", 4], ["projectors", 5], ["street-lights", 4], ["wall-lights", 3], ["ceiling-lights", 4], ["emergency-lights", 5], ["sensor-lights", 3], ["cabinet-lights", 4], ["linear-lights", 4], ["track-lights", 4], ["garden-lights", 4], ["led-controllers", 4], ["led-strip-accessories", 5], ["wall-switches", 3], ["wall-sockets", 4], ["dimmers", 4], ["smart-switches", 4], ["industrial-plugs", 5], ["industrial-sockets", 5], ["miniature-circuit-breakers", 8], ["residual-current-devices", 5], ["molded-case-circuit-breakers", 5], ["fuse-holders", 5], ["distribution-boxes", 6], ["distribution-panels", 5], ["contactors", 6], ["electrical-relays", 5], ["time-switches", 3], ["voltage-protectors", 5], ["building-wire", 5], ["flexible-cable", 6], ["power-cable", 6], ["coaxial-cable", 3], ["conduit", 4], ["flexible-conduit", 5], ["trunking", 6], ["junction-boxes", 4]]);
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
