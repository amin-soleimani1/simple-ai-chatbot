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
		expect(DEFAULT_MARKET_REFERENCE_TARGETS.reduce((total, targetSet) => total + targetSet.targets.length, 0)).toBe(228);
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

	it("preserves economy bulbs while retaining the established non-Batch-1 category coverage", () => {
		expect(byId("economy-bulbs").targets).toEqual([9, 12, 15, 20, 30, 50].map((watt) => ({ variantId: `${watt}w`, label: `لامپ LED اقتصادی ${fa(watt)} وات`, attributes: { watt } })));
		for (const target of byId("led-bulbs").targets) expect(target.attributes).toMatchObject({ formFactor: target.attributes.watt <= 20 ? "a-bulb" : "cylindrical", socketType: "E27" });
		for (const target of byId("filament-bulbs").targets) expect(target.attributes).toMatchObject({ shape: "a60", socketType: "E27" });
		for (const target of byId("candle-bulbs").targets) expect(target.attributes).toMatchObject({ shape: "candle", socketType: "E14" });
		for (const target of byId("halogen-bulbs").targets) expect(target.attributes).toMatchObject({ socketType: "GU10" });
		expect(DEFAULT_MARKET_REFERENCE_TARGETS.slice(5).map((targetSet) => [targetSet.categoryId, targetSet.targets.length])).toEqual([["led-tube-lights", 3], ["led-strips", 4], ["led-modules", 4], ["led-chips", 5], ["led-drivers", 4], ["led-power-supplies", 5], ["ceiling-panels", 5], ["downlights", 4], ["spotlights", 4], ["projectors", 5], ["street-lights", 4], ["wall-lights", 3], ["ceiling-lights", 4], ["emergency-lights", 5], ["sensor-lights", 3], ["cabinet-lights", 4], ["linear-lights", 4], ["track-lights", 4], ["garden-lights", 4], ["led-controllers", 4], ["led-strip-accessories", 5], ["wall-switches", 3], ["wall-sockets", 4], ["dimmers", 4], ["smart-switches", 4], ["industrial-plugs", 5], ["industrial-sockets", 5], ["miniature-circuit-breakers", 8], ["residual-current-devices", 5], ["molded-case-circuit-breakers", 5], ["fuse-holders", 5], ["distribution-boxes", 6], ["distribution-panels", 5], ["contactors", 6], ["electrical-relays", 5], ["time-switches", 3], ["voltage-protectors", 5], ["building-wire", 5], ["flexible-cable", 6], ["power-cable", 6], ["coaxial-cable", 3], ["conduit", 4], ["flexible-conduit", 5], ["trunking", 6], ["junction-boxes", 4]]);
	});

	it("refines only Batch-2 identities with comparable strip and driver attributes", () => {
		expect(byId("led-tube-lights").targets.map((target) => target.attributes)).toEqual([{ watt: 9, lengthCm: 60 }, { watt: 18, lengthCm: 120 }, { watt: 20, lengthCm: 120 }]);
		expect(byId("led-strips").targets).toEqual([{ variantId: "12v-single-color-120led-5m", label: "ریسه نواری LED تک‌رنگ ۱۲ ولت تراکم ۱۲۰ کلاف ۵ متری", attributes: { voltage: 12, colorMode: "single-color", densityPerM: 120, lengthM: 5 } }, { variantId: "12v-single-color-240led-5m", label: "ریسه نواری LED تک‌رنگ ۱۲ ولت تراکم ۲۴۰ کلاف ۵ متری", attributes: { voltage: 12, colorMode: "single-color", densityPerM: 240, lengthM: 5 } }, { variantId: "24v-single-color-120led-5m", label: "ریسه نواری LED تک‌رنگ ۲۴ ولت تراکم ۱۲۰ کلاف ۵ متری", attributes: { voltage: 24, colorMode: "single-color", densityPerM: 120, lengthM: 5 } }, { variantId: "24v-single-color-240led-5m", label: "ریسه نواری LED تک‌رنگ ۲۴ ولت تراکم ۲۴۰ کلاف ۵ متری", attributes: { voltage: 24, colorMode: "single-color", densityPerM: 240, lengthM: 5 } }]);
		expect(byId("led-modules").targets.every((target) => Number.isFinite(target.attributes.watt) && /ماژول LED/.test(target.label))).toBe(true);
		expect(byId("led-chips").targets.every((target) => Number.isFinite(target.attributes.watt) && /چیپ LED/.test(target.label))).toBe(true);
		expect(byId("led-drivers").targets).toEqual([{ variantId: "7-12w-300ma", label: "درایور LED جریان ثابت ۷ تا ۱۲ وات ۳۰۰ میلی‌آمپر", attributes: { minWatt: 7, maxWatt: 12, outputCurrentMa: 300 } }, { variantId: "12-18w-300ma", label: "درایور LED جریان ثابت ۱۲ تا ۱۸ وات ۳۰۰ میلی‌آمپر", attributes: { minWatt: 12, maxWatt: 18, outputCurrentMa: 300 } }, { variantId: "18-36w-300ma", label: "درایور LED جریان ثابت ۱۸ تا ۳۶ وات ۳۰۰ میلی‌آمپر", attributes: { minWatt: 18, maxWatt: 36, outputCurrentMa: 300 } }, { variantId: "36-50w-300ma", label: "درایور LED جریان ثابت ۳۶ تا ۵۰ وات ۳۰۰ میلی‌آمپر", attributes: { minWatt: 36, maxWatt: 50, outputCurrentMa: 300 } }]);
		for (const id of ["led-tube-lights", "led-strips", "led-modules", "led-chips", "led-drivers"]) {
			const category = DEFAULT_MARKET_REFERENCE_CATALOG.categories.find((item) => item.id === id);
			expect(buildResearchQueries({ category: { id: category.id, title: category.title, variantSchema: category.variantSchema, enabled: category.enabled }, targets: byId(id) })[0].query).toMatch(/[\u0600-\u06ff]/);
		}
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
