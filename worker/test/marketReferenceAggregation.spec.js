import { describe, expect, it } from "vitest";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";
import { aggregateResearchObservations } from "../src/marketReference/marketReferenceAggregationService.js";

function observation(variantId, price, sourceId, observedAt = "2026-09-22T10:00:00.000Z") {
	return { variantId, price, currency: "TOMAN", source: { sourceId, url: `https://${sourceId}.example/${variantId}` }, observedAt };
}
function batch(observations) { return { schemaVersion: 1, categoryId: "economy-bulbs", observations }; }
function variant(result, variantId = "20w") { return result.variants.find((item) => item.variantId === variantId); }

describe("market reference aggregation service", () => {
	it("aggregates one, two, and three observations with deterministic medians", () => {
		expect(variant(aggregateResearchObservations(batch([observation("20w", 220000, "a")])))).toMatchObject({ minPrice: 220000, referencePrice: 220000, maxPrice: 220000 });
		expect(variant(aggregateResearchObservations(batch([observation("20w", 200000, "a"), observation("20w", 220001, "b")])))).toMatchObject({ minPrice: 200000, referencePrice: 210001, maxPrice: 220001 });
		expect(variant(aggregateResearchObservations(batch([observation("20w", 100, "a"), observation("20w", 200, "b"), observation("20w", 300, "c")])))).toMatchObject({ minPrice: 100, referencePrice: 200, maxPrice: 300 });
	});

	it("groups variants independently and returns them in lexicographic order", () => {
		const result = aggregateResearchObservations(batch([observation("9w", 90, "a"), observation("20w", 200, "b")]));
		expect(result.variants.map((item) => item.variantId)).toEqual(["20w", "9w"]);
		expect(variant(result, "9w").referencePrice).toBe(90);
	});

	it("deduplicates identical evidence by latest timestamp without adding statistical weight", () => {
		const first = observation("20w", 200, "a", "2026-09-20T10:00:00.000Z");
		const latest = { ...first, price: 300, observedAt: "2026-09-22T10:00:00.000Z" };
		const result = variant(aggregateResearchObservations(batch([first, latest, observation("20w", 100, "b")])));
		expect(result).toMatchObject({ minPrice: 100, referencePrice: 200, maxPrice: 300, stats: { rawObservationCount: 3, deduplicatedObservationCount: 2, retainedObservationCount: 2, outlierCount: 0, independentSourceCount: 2 } });
	});

	it("preserves independent evidence and resolves equal-timestamp conflicting duplicates by lower input index", () => {
		const first = observation("20w", 300, "a"); const second = { ...first, price: 100 };
		const result = variant(aggregateResearchObservations(batch([first, second, observation("20w", 200, "b")])));
		expect(result).toMatchObject({ minPrice: 200, referencePrice: 250, maxPrice: 300, stats: { rawObservationCount: 3, deduplicatedObservationCount: 2 } });
		expect(variant(aggregateResearchObservations(batch([observation("20w", 200, "a"), observation("20w", 200, "b")]))).stats.deduplicatedObservationCount).toBe(2);
	});

	it("filters high and low Tukey-IQR outliers while retaining values exactly on fences", () => {
		const high = variant(aggregateResearchObservations(batch([100, 101, 102, 103, 104, 1000].map((price, index) => observation("20w", price, `h${index}`)))));
		const low = variant(aggregateResearchObservations(batch([1, 100, 101, 102, 103, 104].map((price, index) => observation("20w", price, `l${index}`)))));
		const fence = variant(aggregateResearchObservations(batch([100, 110, 120, 130, 140, 185].map((price, index) => observation("20w", price, `f${index}`)))));
		expect(high).toMatchObject({ minPrice: 100, maxPrice: 104, stats: { outlierCount: 1, retainedObservationCount: 5 } });
		expect(low).toMatchObject({ minPrice: 100, maxPrice: 104, stats: { outlierCount: 1, retainedObservationCount: 5 } });
		expect(fence).toMatchObject({ minPrice: 100, maxPrice: 185, stats: { outlierCount: 0 } });
	});

	it("handles zero IQR and reports complete aggregation statistics", () => {
		const result = variant(aggregateResearchObservations(batch([100, 100, 100, 100, 100, 1000].map((price, index) => observation("20w", price, `s${index}`)))));
		expect(result).toEqual({ variantId: "20w", minPrice: 100, referencePrice: 100, maxPrice: 100, stats: { rawObservationCount: 6, deduplicatedObservationCount: 6, retainedObservationCount: 5, outlierCount: 1, independentSourceCount: 5 } });
	});

	it("does not mutate input and produces equivalent numeric aggregation for reordered input", () => {
		const value = batch([observation("20w", 100, "a"), observation("20w", 200, "b"), observation("20w", 300, "c"), observation("20w", 400, "d")]);
		const original = structuredClone(value); const reordered = batch([...value.observations].reverse());
		expect(aggregateResearchObservations(value)).toEqual(aggregateResearchObservations(reordered));
		expect(value).toEqual(original);
	});

	it("rejects invalid or malformed batches through the observation validation contract", () => {
		expect(() => aggregateResearchObservations(batch([]))).toThrow(MarketReferenceValidationError);
		expect(() => aggregateResearchObservations(batch([{ ...observation("20w", 100, "a"), price: "100" }]))).toThrow(MarketReferenceValidationError);
	});
});
