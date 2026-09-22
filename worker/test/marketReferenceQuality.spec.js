import { describe, expect, it } from "vitest";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";
import { evaluateMarketReferenceCandidate } from "../src/marketReference/marketReferenceQualityService.js";

function targets(overrides = {}) { return { schemaVersion: 1, categoryId: "economy-bulbs", targets: [{ variantId: "20w", label: "20 watt", attributes: { watt: 20 } }], ...overrides }; }
function aggregate(variants = [variant() ], overrides = {}) { return { schemaVersion: 1, categoryId: "economy-bulbs", variants, ...overrides }; }
function variant(overrides = {}) { return { variantId: "20w", minPrice: 100, referencePrice: 120, maxPrice: 140, stats: { rawObservationCount: 3, deduplicatedObservationCount: 3, retainedObservationCount: 3, outlierCount: 0, independentSourceCount: 2 }, ...overrides }; }
const metadata = { title: "Bulbs", updatedAt: "2026-09-22T10:00:00.000Z", researchMethod: "manual_market_research" };
function evaluate(input = {}) { return evaluateMarketReferenceCandidate({ targets: input.targets ?? targets(), aggregation: input.aggregation ?? aggregate(), metadata: input.metadata ?? metadata }); }

describe("market reference quality gate", () => {
	it("builds a passing candidate using target labels, attributes, target order, and retained sample count", () => {
		const targetSet = targets({ targets: [{ variantId: "9w", label: "nine", attributes: { watt: 9 } }, { variantId: "20w", label: "twenty", attributes: { watt: 20 } }] });
		const result = evaluate({ targets: targetSet, aggregation: aggregate([variant({ variantId: "20w" }), variant({ variantId: "9w", stats: { rawObservationCount: 4, deduplicatedObservationCount: 4, retainedObservationCount: 4, outlierCount: 0, independentSourceCount: 2 } })]) });
		expect(result).toMatchObject({ passed: true, eligible: true, candidate: { schemaVersion: 2, research: { sampleCount: 7 }, items: [{ variantId: "9w", label: "nine", attributes: { watt: 9 } }, { variantId: "20w", label: "twenty", attributes: { watt: 20 } }] } });
	});

	it("accepts the explicit automated research method while preserving manual compatibility", () => {
		const result = evaluate({ metadata: { ...metadata, researchMethod: "automated_market_research" } });
		expect(result.candidate.research.method).toBe("automated_market_research");
	});

	it("passes exact policy thresholds including 0.50 dispersion", () => {
		expect(evaluate({ aggregation: aggregate([variant({ minPrice: 100, referencePrice: 200, maxPrice: 200 })]) }).passed).toBe(true);
	});

	it("returns ordered normal quality failures without a candidate", () => {
		const result = evaluate({ aggregation: aggregate([variant({ minPrice: 100, referencePrice: 100, maxPrice: 151, stats: { rawObservationCount: 2, deduplicatedObservationCount: 2, retainedObservationCount: 2, outlierCount: 0, independentSourceCount: 1 } })]) });
		expect(result).toEqual({ passed: false, eligible: false, variants: [{ variantId: "20w", passed: false, reasons: ["INSUFFICIENT_OBSERVATIONS", "INSUFFICIENT_SOURCES", "EXCESSIVE_DISPERSION"] }], candidate: null });
	});

	it("rejects missing and unknown variants without partial publication", () => {
		const missing = evaluate({ targets: targets({ targets: [{ variantId: "20w", label: "twenty", attributes: { watt: 20 } }, { variantId: "9w", label: "nine", attributes: { watt: 9 } }] }) });
		expect(missing).toMatchObject({ passed: false, candidate: null, variants: [{ variantId: "20w", passed: true }, { variantId: "9w", reasons: ["MISSING_AGGREGATION"] }] });
		const unknown = evaluate({ aggregation: aggregate([variant(), variant({ variantId: "other" })]) });
		expect(unknown).toMatchObject({ passed: false, candidate: null, variants: [{ variantId: "20w", passed: true }, { variantId: "other", reasons: ["UNKNOWN_VARIANT"] }] });
	});

	it("throws controlled errors for category mismatch, malformed contracts, and invalid metadata", () => {
		expect(() => evaluate({ aggregation: aggregate([variant()], { categoryId: "other" }) })).toThrow(MarketReferenceValidationError);
		expect(() => evaluate({ targets: { ...targets(), unexpected: true } })).toThrow(MarketReferenceValidationError);
		expect(() => evaluate({ aggregation: aggregate([variant({ minPrice: 130, referencePrice: 120 })]) })).toThrow(MarketReferenceValidationError);
		expect(() => evaluate({ aggregation: aggregate([variant(), variant()]) })).toThrow(MarketReferenceValidationError);
		expect(() => evaluate({ metadata: { ...metadata, title: "" } })).toThrow(MarketReferenceValidationError);
	});

	it("is deterministic and does not mutate inputs", () => {
		const input = { targets: targets(), aggregation: aggregate(), metadata: { ...metadata } }; const original = structuredClone(input);
		expect(evaluateMarketReferenceCandidate(input)).toEqual(evaluateMarketReferenceCandidate(input));
		expect(input).toEqual(original);
	});
});
