import { describe, expect, it, vi } from "vitest";
import { getMarketReferenceCatalog, saveMarketReferenceCatalog, validateMarketReferenceCatalog } from "../src/marketReference/marketReferenceCatalogService.js";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";

function createEnv(initialValues = {}) { const values = new Map(Object.entries(initialValues)); return { APP_CONFIG: { get: vi.fn(async (key) => values.get(key) ?? null), put: vi.fn(async (key, value) => values.set(key, value)) }, _values: values }; }
function catalog(categories = [{ id: "led-bulbs", title: "لامپ LED", variantSchema: "wattage", enabled: true, sortOrder: 10 }], overrides = {}) { return { schemaVersion: 1, categories, ...overrides }; }

describe("market reference catalog service", () => {
	it("saves and reads a valid catalog without sorting it", async () => {
		const value = catalog([{ id: "second", title: "دوم", variantSchema: "generic", enabled: false, sortOrder: 50 }, { id: "first", title: "اول", variantSchema: "wattage", enabled: true, sortOrder: 10 }]); const env = createEnv();
		expect(await saveMarketReferenceCatalog(env, value)).toEqual(value); expect(await getMarketReferenceCatalog(env)).toEqual(value); expect(env._values.get("market-reference:catalog")).toBe(JSON.stringify(value));
	});
	it("accepts every supported variant schema", () => { for (const variantSchema of ["wattage", "ampere", "breaker_model", "cable_size", "model", "size", "generic"]) expect(validateMarketReferenceCatalog(catalog([{ id: variantSchema, title: variantSchema, variantSchema, enabled: true, sortOrder: 0 }]))).toBeTruthy(); });
	it("rejects invalid schemas and category fields", () => {
		const category = catalog().categories[0]; const cases = [catalog([], {}), catalog([category, category]), catalog([{ ...category, id: " " }]), catalog([{ ...category, title: " " }]), catalog([{ ...category, variantSchema: "unknown" }]), catalog([{ ...category, enabled: "true" }]), catalog([{ ...category, sortOrder: -1 }]), catalog([{ ...category, sortOrder: 1.5 }]), catalog([category], { unexpected: true }), catalog([{ ...category, unexpected: true }]), catalog([category], { schemaVersion: 2 })]; for (const value of cases) expect(() => validateMarketReferenceCatalog(value)).toThrow(MarketReferenceValidationError);
	});
	it("distinguishes a missing catalog and never writes while reading", async () => { const env = createEnv(); expect(await getMarketReferenceCatalog(env)).toBeNull(); expect(env.APP_CONFIG.put).not.toHaveBeenCalled(); });
	it("reports malformed JSON and invalid stored schemas as controlled failures", async () => { for (const value of ["{bad-json", JSON.stringify(catalog([], {}))]) { const env = createEnv({ "market-reference:catalog": value }); await expect(getMarketReferenceCatalog(env)).rejects.toBeInstanceOf(MarketReferenceValidationError); expect(env.APP_CONFIG.put).not.toHaveBeenCalled(); } });
	it("writes only the catalog key and leaves datasets and knowledge untouched", async () => { const dataset = JSON.stringify({ data: "dataset" }); const knowledge = JSON.stringify({ data: "knowledge" }); const env = createEnv({ "market-reference:led-bulbs": dataset, "knowledge:led-bulbs": knowledge }); await saveMarketReferenceCatalog(env, catalog()); expect(env.APP_CONFIG.put).toHaveBeenCalledTimes(1); expect(env.APP_CONFIG.put).toHaveBeenCalledWith("market-reference:catalog", expect.any(String)); expect(env._values.get("market-reference:led-bulbs")).toBe(dataset); expect(env._values.get("knowledge:led-bulbs")).toBe(knowledge); });
});
