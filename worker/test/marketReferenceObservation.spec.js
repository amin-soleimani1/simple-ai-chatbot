import { describe, expect, it } from "vitest";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";
import { validateResearchObservationBatch } from "../src/marketReference/marketReferenceObservationService.js";

function batch(overrides = {}) {
	return {
		schemaVersion: 1,
		categoryId: "economy-bulbs",
		observations: [{
			variantId: "20w", price: 220000, currency: "TOMAN",
			source: { sourceId: "store-a", url: "https://example.com/product/123" },
			observedAt: "2026-09-22T10:00:00.000Z",
		}],
		...overrides,
	};
}

describe("market reference observation model", () => {
	it("accepts a valid observation batch without mutating it", () => {
		const value = batch(); const original = structuredClone(value);
		expect(validateResearchObservationBatch(value)).toBe(value);
		expect(value).toEqual(original);
	});

	it("accepts multiple observations for the same target, different targets, and different sources", () => {
		const first = batch().observations[0];
		const value = batch({ observations: [
			first,
			{ ...first, price: 215000, source: { sourceId: "store-b", url: "https://shop.example/item/20w" } },
			{ ...first, variantId: "9w", price: 120000, source: { sourceId: "store-c", url: "http://market.example/item/9w" } },
		] });
		expect(validateResearchObservationBatch(value)).toBe(value);
	});

	it("rejects invalid batch, observation, source, currency, price, URL, and timestamp fields", () => {
		const observation = batch().observations[0];
		const cases = [
			batch({ schemaVersion: 2 }), batch({ categoryId: " " }), batch({ observations: {} }),
			batch({ observations: [{ ...observation, variantId: " " }] }),
			batch({ observations: [{ ...observation, price: 0 }] }), batch({ observations: [{ ...observation, price: -1 }] }),
			batch({ observations: [{ ...observation, price: 1.5 }] }), batch({ observations: [{ ...observation, price: "220000" }] }),
			batch({ observations: [{ ...observation, currency: "IRR" }] }), batch({ observations: [{ ...observation, source: undefined }] }),
			batch({ observations: [{ ...observation, source: [] }] }), batch({ observations: [{ ...observation, source: { ...observation.source, sourceId: " " } }] }),
			batch({ observations: [{ ...observation, source: { ...observation.source, url: "not a URL" } }] }),
			batch({ observations: [{ ...observation, source: { ...observation.source, url: "/relative" } }] }),
			batch({ observations: [{ ...observation, source: { ...observation.source, url: "ftp://example.com/item" } }] }),
			batch({ observations: [{ ...observation, observedAt: "not-a-timestamp" }] }), batch({ observations: [{ ...observation, observedAt: "September 22, 2026" }] }),
			{ ...batch(), unexpected: true }, batch({ observations: [{ ...observation, unexpected: true }] }),
			batch({ observations: [{ ...observation, source: { ...observation.source, unexpected: true } }] }),
		];
		for (const value of cases) expect(() => validateResearchObservationBatch(value)).toThrow(MarketReferenceValidationError);
	});

	it("is pure and performs no storage operations", () => {
		expect(validateResearchObservationBatch(batch())).toBeTruthy();
	});
});
