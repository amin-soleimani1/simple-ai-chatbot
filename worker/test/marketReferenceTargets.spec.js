import { describe, expect, it, vi } from "vitest";
import { buildResearchTargetsKey, getResearchTargets, saveResearchTargets, validateResearchTargets } from "../src/marketReference/marketReferenceTargetsService.js";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";

function createEnv(initialValues = {}) { const values = new Map(Object.entries(initialValues)); return { APP_CONFIG: { get: vi.fn(async (key) => values.get(key) ?? null), put: vi.fn(async (key, value) => values.set(key, value)) }, _values: values }; }
function targetSet(overrides = {}) { return { schemaVersion: 1, categoryId: "economy-bulbs", targets: [{ variantId: "9w", label: "9 watt", attributes: { watt: 9 } }], ...overrides }; }

describe("market reference targets service", () => {
	it("validates a strict target set and saves/reads it without normalization", async () => {
		const value = targetSet({ targets: [
			{ variantId: "9w", label: "9 watt", attributes: { watt: 9, indoor: true, color: "white" } },
			{ variantId: "20w", label: "20 watt", attributes: { watt: 20 } },
		] });
		const env = createEnv();
		expect(validateResearchTargets(value)).toBe(value);
		expect(await saveResearchTargets(env, value)).toBe(value);
		expect(await getResearchTargets(env, "economy-bulbs")).toEqual(value);
		expect(env._values.get("market-reference:targets:economy-bulbs")).toBe(JSON.stringify(value));
	});

	it("uses a distinct category-scoped target key and keeps missing reads write-free", async () => {
		const env = createEnv();
		expect(buildResearchTargetsKey("economy-bulbs")).toBe("market-reference:targets:economy-bulbs");
		expect(await getResearchTargets(env, "economy-bulbs")).toBeNull();
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("rejects strict schema, target, and attribute validation failures", () => {
		const target = targetSet().targets[0];
		const cases = [
			targetSet({ schemaVersion: 2 }), targetSet({ categoryId: " " }), targetSet({ targets: [] }),
			targetSet({ targets: [target, target] }), targetSet({ targets: [{ ...target, variantId: " " } ] }),
			targetSet({ targets: [{ ...target, label: " " } ] }), targetSet({ targets: [{ ...target, attributes: {} } ] }),
			targetSet({ targets: [{ ...target, attributes: { watt: { value: 9 } } } ] }),
			targetSet({ targets: [{ ...target, attributes: { watt: [9] } } ] }),
			targetSet({ targets: [{ ...target, attributes: { watt: null } } ] }),
			targetSet({ targets: [{ ...target, attributes: { watt: Infinity } } ] }),
			{ ...targetSet(), unexpected: true }, targetSet({ targets: [{ ...target, unexpected: true } ] }),
		];
		for (const value of cases) expect(() => validateResearchTargets(value)).toThrow(MarketReferenceValidationError);
		expect(() => buildResearchTargetsKey(" ")).toThrow(MarketReferenceValidationError);
	});

	it("reports malformed stored target data as a validation failure without writing", async () => {
		for (const value of ["{bad-json", JSON.stringify(targetSet({ targets: [] }))]) {
			const env = createEnv({ "market-reference:targets:economy-bulbs": value });
			await expect(getResearchTargets(env, "economy-bulbs")).rejects.toBeInstanceOf(MarketReferenceValidationError);
			expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
		}
	});

	it("writes only its own key and leaves catalog, datasets, and Official Knowledge untouched", async () => {
		const catalog = JSON.stringify({ categories: [] }); const dataset = JSON.stringify({ items: [] }); const knowledge = JSON.stringify({ data: "official" });
		const env = createEnv({ "market-reference:catalog": catalog, "market-reference:economy-bulbs": dataset, "knowledge:economy-bulbs": knowledge });
		await saveResearchTargets(env, targetSet());
		expect(env.APP_CONFIG.put).toHaveBeenCalledTimes(1);
		expect(env.APP_CONFIG.put).toHaveBeenCalledWith("market-reference:targets:economy-bulbs", expect.any(String));
		expect(env._values.get("market-reference:catalog")).toBe(catalog);
		expect(env._values.get("market-reference:economy-bulbs")).toBe(dataset);
		expect(env._values.get("knowledge:economy-bulbs")).toBe(knowledge);
	});
});
