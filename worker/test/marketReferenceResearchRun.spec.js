import { describe, expect, it, vi } from "vitest";
import { MarketReferenceResearchRunError, runMarketReferenceResearch } from "../src/marketReference/marketReferenceResearchRunService.js";

const observedAt = "2026-09-22T10:00:00.000Z";
function category(overrides = {}) { return { id: "led-bulbs", title: "لامپ LED", variantSchema: "wattage", enabled: true, sortOrder: 1, ...overrides }; }
function targets(items = [{ variantId: "20w", label: "20 وات", attributes: { watt: 20 } }], categoryId = "led-bulbs") { return { schemaVersion: 1, categoryId, targets: items }; }
function item(title, sourceId) { return { sourceId, url: `https://example.com/${sourceId}`, title, snippet: "" }; }
function raw(query, results) { return { schemaVersion: 1, queryId: query.queryId, results }; }
function candidate(price = 220000) { return { schemaVersion: 1, matched: true, variantId: "20w", price, currency: "TOMAN", evidence: { variantText: "20 وات", priceText: `${price} تومان` } }; }

describe("market reference research run orchestration", () => {
	it("runs queries sequentially, preserves target/result order, creates an automated candidate, and never calls AI for deterministic observations", async () => {
		const provider = vi.fn(async (query) => raw(query, [item("20 وات 220000 تومان", "a"), item("20 وات 220000 تومان", "b"), item("20 وات 220000 تومان", "c")]));
		const ai = vi.fn();
		const result = await runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: provider, invokeModel: ai });
		expect(provider).toHaveBeenCalledOnce(); expect(provider.mock.calls[0][0]).toMatchObject({ queryId: "led-bulbs:20w:price", variantId: "20w" }); expect(ai).not.toHaveBeenCalled();
		expect(result).toMatchObject({ schemaVersion: 1, categoryId: "led-bulbs", observedAt, stats: { targetCount: 1, queryCount: 1, rawResultCount: 3, deterministicObservationCount: 3, aiObservationCount: 0, totalObservationCount: 3 }, candidate: { research: { method: "automated_market_research" } } });
		expect(result.quality.passed).toBe(true);
	});

	it("uses AI at most once for each unresolved eligible result and aggregates mixed deterministic and grounded AI observations", async () => {
		const provider = vi.fn(async (query) => raw(query, [item("20 وات 220000 تومان", "d"), item("20 وات 220000 تومان / 30 وات 350000 تومان", "e"), item("20 وات 220000 تومان / 30 وات 350000 تومان", "f")]));
		const ai = vi.fn().mockResolvedValue(candidate());
		const result = await runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: provider, invokeModel: ai });
		expect(ai).toHaveBeenCalledTimes(2);
		expect(result.stats).toMatchObject({ deterministicObservationCount: 1, aiObservationCount: 2, totalObservationCount: 3 });
		expect(result.candidate).toMatchObject({ research: { method: "automated_market_research" } });
	});

	it("treats zero results, unusable evidence, and matched:false as normal quality rejection", async () => {
		const zero = await runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: vi.fn(async (query) => raw(query, [])) });
		expect(zero).toMatchObject({ stats: { rawResultCount: 0, totalObservationCount: 0 }, candidate: null, quality: { passed: false, variants: [{ reasons: ["MISSING_AGGREGATION"] }] } });
		const noMatch = await runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: vi.fn(async (query) => raw(query, [item("20 وات 220000 تومان / 30 وات 350000 تومان", "x")])), invokeModel: vi.fn().mockResolvedValue({ schemaVersion: 1, matched: false }) });
		expect(noMatch).toMatchObject({ candidate: null, stats: { aiObservationCount: 0 } });
	});

	it("preserves target order and checks provider query identity", async () => {
		const targetSet = targets([{ variantId: "30w", label: "30 وات", attributes: { watt: 30 } }, { variantId: "20w", label: "20 وات", attributes: { watt: 20 } }]);
		const provider = vi.fn(async (query) => raw(query, []));
		await runMarketReferenceResearch({ category: category(), targets: targetSet, observedAt, searchProvider: provider });
		expect(provider.mock.calls.map(([query]) => query.variantId)).toEqual(["30w", "20w"]);
		await expect(runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: vi.fn(async () => ({ schemaVersion: 1, queryId: "wrong", results: [] })) })).rejects.toBeInstanceOf(MarketReferenceResearchRunError);
	});

	it("rejects category mismatches and wraps provider and AI infrastructure/contract failures", async () => {
		await expect(runMarketReferenceResearch({ category: category(), targets: targets([{ variantId: "20w", label: "20 وات", attributes: { watt: 20 } }], "other"), observedAt, searchProvider: vi.fn() })).rejects.toBeInstanceOf(MarketReferenceResearchRunError);
		await expect(runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: vi.fn().mockRejectedValue(new Error("api-key-secret")) })).rejects.toThrow("Research search provider failed.");
		await expect(runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: vi.fn().mockResolvedValue({ broken: true }) })).rejects.toThrow("Research search provider returned an invalid result.");
		const unresolved = vi.fn(async (query) => raw(query, [item("20 وات 220000 تومان / 30 وات 350000 تومان", "x")]));
		await expect(runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: unresolved, invokeModel: vi.fn().mockRejectedValue(new Error("model-secret")) })).rejects.toThrow("Research AI extraction failed.");
		await expect(runMarketReferenceResearch({ category: category(), targets: targets(), observedAt, searchProvider: unresolved, invokeModel: vi.fn().mockResolvedValue({ bad: true }) })).rejects.toThrow("Research AI extraction failed.");
	});

	it("is deterministic and does not mutate inputs or persist", async () => {
		const value = { category: category(), targets: targets(), observedAt, searchProvider: async (query) => raw(query, []) }; const original = structuredClone({ category: value.category, targets: value.targets, observedAt: value.observedAt });
		const first = await runMarketReferenceResearch(value); const second = await runMarketReferenceResearch(value);
		expect(first).toEqual(second); expect({ category: value.category, targets: value.targets, observedAt: value.observedAt }).toEqual(original);
	});
});
