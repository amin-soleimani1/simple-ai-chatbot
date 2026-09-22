import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_REFERENCE_BOOTSTRAP, validateDefaultMarketReferenceBootstrap } from "../src/marketReference/defaultMarketReferenceBootstrap.js";
import { DEFAULT_MARKET_REFERENCE_TARGETS } from "../src/marketReference/defaultMarketReferenceTargets.js";
import { validateMarketReference } from "../src/marketReference/marketReferenceService.js";

const byId = (id) => DEFAULT_MARKET_REFERENCE_BOOTSTRAP.find((dataset) => dataset.categoryId === id);
const target = (categoryId, variantId) => DEFAULT_MARKET_REFERENCE_TARGETS.find((set) => set.categoryId === categoryId).targets.find((item) => item.variantId === variantId);

describe("default market reference bootstrap", () => {
	it("contains only the approved Batch-1 and conservative Batch-2 datasets and variants", () => {
		expect(DEFAULT_MARKET_REFERENCE_BOOTSTRAP.map((dataset) => dataset.categoryId)).toEqual(["led-bulbs", "halogen-bulbs", "led-strips"]);
		expect(byId("led-bulbs").items.map((item) => item.variantId)).toEqual(["30w-cylindrical-e27", "40w-cylindrical-e27", "50w-cylindrical-e27"]);
		expect(byId("halogen-bulbs").items.map((item) => item.variantId)).toEqual(["7w-gu10"]);
		expect(byId("led-strips").items.map((item) => item.variantId)).toEqual(["12v-single-color-120led-5m"]);
		expect(["economy-bulbs", "filament-bulbs", "candle-bulbs"].map(byId)).toEqual([undefined, undefined, undefined]);
		expect(["led-tube-lights", "led-modules", "led-chips", "led-drivers"].map(byId)).toEqual([undefined, undefined, undefined, undefined]);
	});

	it("uses exact target labels and attributes with valid v2 Toman price ranges", () => {
		for (const dataset of DEFAULT_MARKET_REFERENCE_BOOTSTRAP) {
			expect(validateMarketReference(dataset)).toEqual(dataset);
			for (const item of dataset.items) {
				const predefined = target(dataset.categoryId, item.variantId);
				expect(item.label).toBe(predefined.label); expect(item.attributes).toEqual(predefined.attributes);
				expect(Number.isSafeInteger(item.minPrice) && item.minPrice > 0 && item.minPrice <= item.referencePrice && item.referencePrice <= item.maxPrice).toBe(true);
			}
		}
		expect(byId("led-bulbs").items.map(({ minPrice, referencePrice, maxPrice }) => [minPrice, referencePrice, maxPrice])).toEqual([[470000, 550000, 590000], [533066, 624800, 710000], [620000, 751400, 1028000]]);
		expect(byId("halogen-bulbs").items[0]).toMatchObject({ minPrice: 70900, referencePrice: 161100, maxPrice: 235000 });
		expect(byId("led-strips").items).toEqual([{ variantId: "12v-single-color-120led-5m", label: target("led-strips", "12v-single-color-120led-5m").label, attributes: target("led-strips", "12v-single-color-120led-5m").attributes, minPrice: 190000, referencePrice: 282500, maxPrice: 375000 }]);
	});

	it("has only manual research metadata and no inventory/status fields", () => {
		for (const dataset of DEFAULT_MARKET_REFERENCE_BOOTSTRAP) {
			expect(dataset.research).toEqual({ sampleCount: 1, method: "manual_market_research" });
			expect(JSON.stringify(dataset)).not.toMatch(/available|out_of_stock|not_sold|knowledge/i);
		}
	});

	it("validates identity deterministically without mutating definitions or external operations", () => {
		const original = structuredClone(DEFAULT_MARKET_REFERENCE_BOOTSTRAP);
		expect(validateDefaultMarketReferenceBootstrap()).toBe(DEFAULT_MARKET_REFERENCE_BOOTSTRAP);
		expect(validateDefaultMarketReferenceBootstrap(DEFAULT_MARKET_REFERENCE_BOOTSTRAP)).toBe(DEFAULT_MARKET_REFERENCE_BOOTSTRAP);
		expect(DEFAULT_MARKET_REFERENCE_BOOTSTRAP).toEqual(original);
	});
});
