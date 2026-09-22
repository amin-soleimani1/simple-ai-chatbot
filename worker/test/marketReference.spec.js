import { describe, expect, it, vi } from "vitest";
import { buildMarketReferenceKey, calculateMarketReferenceFreshness, getMarketReference, MarketReferenceValidationError, saveMarketReference, validateMarketReference } from "../src/marketReference/marketReferenceService.js";

function createMarketEnv(initialValues = {}) {
	const values = new Map(Object.entries(initialValues));
	return {
		APP_CONFIG: {
			get: vi.fn(async (key) => values.get(key) ?? null),
			put: vi.fn(async (key, value) => values.set(key, value)),
		},
		_values: values,
	};
}

function reference(overrides = {}) {
	return {
		schemaVersion: 1,
		categoryId: "economy-bulbs",
		title: "لامپ اقتصادی",
		updatedAt: "2026-09-22T00:00:00.000Z",
		research: { sampleCount: 5, method: "manual_market_research" },
		items: [{ watt: 9, minPrice: 120000, maxPrice: 160000, referencePrice: 140000 }],
		...overrides,
	};
}

describe("market reference service", () => {
	it("builds isolated Market Reference keys", () => {
		expect(buildMarketReferenceKey("economy-bulbs")).toBe("market-reference:economy-bulbs");
		expect(() => buildMarketReferenceKey(" ")).toThrow(MarketReferenceValidationError);
	});

	it("saves and reads a valid Market Reference with derived freshness", async () => {
		const env = createMarketEnv();
		const saved = await saveMarketReference(env, reference());
		expect(saved).toEqual(reference());
		expect(env._values.get("market-reference:economy-bulbs")).toBe(JSON.stringify(reference()));
		expect(await getMarketReference(env, "economy-bulbs", "2026-09-23T00:00:00.000Z")).toEqual({ ...reference(), freshness: "current" });
	});

	it("returns null for a category without a Market Reference and never writes while reading", async () => {
		const env = createMarketEnv();
		expect(await getMarketReference(env, "projectors")).toBeNull();
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("rejects malformed schemas with controlled validation errors", () => {
		const cases = [
			reference({ schemaVersion: 2 }),
			reference({ categoryId: "" }),
			reference({ title: " " }),
			reference({ updatedAt: "not-a-timestamp" }),
			reference({ research: { sampleCount: 0, method: "manual_market_research" } }),
			reference({ research: { sampleCount: 1, method: "automated" } }),
			reference({ items: [] }),
			reference({ items: [{ watt: 0, minPrice: 120000, maxPrice: 160000, referencePrice: 140000 }] }),
			reference({ items: [{ watt: 9, minPrice: 120000, maxPrice: 160000, referencePrice: 140000 }, { watt: 9, minPrice: 120000, maxPrice: 160000, referencePrice: 140000 }] }),
			reference({ items: [{ watt: 9, minPrice: 0, maxPrice: 160000, referencePrice: 140000 }] }),
			reference({ items: [{ watt: 9, minPrice: 120000, maxPrice: 160000, referencePrice: 110000 }] }),
			reference({ items: [{ watt: 9, minPrice: 120000, maxPrice: 160000, referencePrice: 170000 }] }),
			{ ...reference(), unexpected: true },
		];
		for (const invalidReference of cases) expect(() => validateMarketReference(invalidReference)).toThrow(MarketReferenceValidationError);
	});

	it("calculates freshness at exact 30-day and 60-day boundaries", () => {
		const now = "2026-09-22T00:00:00.000Z";
		expect(calculateMarketReferenceFreshness("2026-09-01T00:00:00.001Z", now)).toBe("current");
		expect(calculateMarketReferenceFreshness("2026-08-23T00:00:00.000Z", now)).toBe("current");
		expect(calculateMarketReferenceFreshness("2026-08-22T23:59:59.999Z", now)).toBe("stale");
		expect(calculateMarketReferenceFreshness("2026-07-24T00:00:00.000Z", now)).toBe("stale");
		expect(calculateMarketReferenceFreshness("2026-07-23T23:59:59.999Z", now)).toBe("outdated");
	});

	it("writes only the Market Reference key and preserves Official Store Knowledge", async () => {
		const knowledgeRecord = JSON.stringify({ parsedData: { items: [{ watt: 9, price: 160000 }] } });
		const categoryRegistry = JSON.stringify([{ id: "economy-bulbs", title: "لامپ اقتصادی", type: "price_list" }]);
		const env = createMarketEnv({
			"knowledge:economy-bulbs": knowledgeRecord,
			"knowledge:categories": categoryRegistry,
		});
		await saveMarketReference(env, reference());
		expect(env.APP_CONFIG.put).toHaveBeenCalledWith("market-reference:economy-bulbs", expect.any(String));
		expect(env._values.get("knowledge:economy-bulbs")).toBe(knowledgeRecord);
		expect(env._values.get("knowledge:categories")).toBe(categoryRegistry);
	});
});
