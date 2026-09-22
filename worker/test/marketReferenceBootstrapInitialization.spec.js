import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MARKET_REFERENCE_BOOTSTRAP } from "../src/marketReference/defaultMarketReferenceBootstrap.js";
import { initializeMarketReferenceBootstrap, seedDefaultMarketReferenceBootstrapDatasets } from "../src/marketReference/marketReferenceBootstrapInitializationService.js";

function env(initial = {}) { const values = new Map(Object.entries(initial)); return { APP_CONFIG: { get: vi.fn(async (key) => values.get(key) ?? null), put: vi.fn(async (key, value) => values.set(key, value)) }, values }; }

describe("market reference bootstrap initialization", () => {
	it("validates and creates only the three approved missing dataset keys", async () => {
		const value = env(); const result = await seedDefaultMarketReferenceBootstrapDatasets(value);
		expect(result).toEqual({ created: ["led-bulbs", "halogen-bulbs", "led-strips"], skipped: [] });
		expect(value.APP_CONFIG.put.mock.calls.map(([key]) => key)).toEqual(["market-reference:led-bulbs", "market-reference:halogen-bulbs", "market-reference:led-strips"]);
		expect(value.values.get("market-reference:economy-bulbs")).toBeUndefined();
	});

	it("skips valid existing datasets unchanged and is idempotent", async () => {
		const existing = JSON.stringify(DEFAULT_MARKET_REFERENCE_BOOTSTRAP[0]); const value = env({ "market-reference:led-bulbs": existing, "market-reference:catalog": "catalog", "knowledge:led-bulbs": "knowledge" });
		const first = await initializeMarketReferenceBootstrap(value);
		expect(first.datasets).toEqual({ created: ["halogen-bulbs", "led-strips"], skipped: ["led-bulbs"] });
		expect(value.values.get("market-reference:led-bulbs")).toBe(existing); expect(value.values.get("market-reference:catalog")).toBe("catalog"); expect(value.values.get("knowledge:led-bulbs")).toBe("knowledge");
		const second = await initializeMarketReferenceBootstrap(value);
		expect(second.datasets).toEqual({ created: [], skipped: ["led-bulbs", "halogen-bulbs", "led-strips"] });
		expect(second.targets.createdCategoryIds).toEqual([]); expect(second.targets.skippedCategoryIds).toHaveLength(50);
	});

	it("rejects unavailable KV bindings and malformed existing data without overwriting it", async () => {
		await expect(seedDefaultMarketReferenceBootstrapDatasets({})).rejects.toThrow("APP_CONFIG KV binding is not available.");
		const value = env({ "market-reference:led-bulbs": "{bad" });
		await expect(seedDefaultMarketReferenceBootstrapDatasets(value)).rejects.toThrow();
		expect(value.APP_CONFIG.put).not.toHaveBeenCalled();
	});
});
