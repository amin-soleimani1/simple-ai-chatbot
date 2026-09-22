import { describe, expect, it, vi } from "vitest";
import { MarketReferenceAiExtractionError, buildAiExtractionPrompt, extractWithAiFallback, isAiFallbackEligible, observationFromGroundedAiCandidate, validateAiExtractionResult } from "../src/marketReference/marketReferenceAiEvidenceExtractor.js";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";

const observedAt = "2026-09-22T10:00:00.000Z";
function category(variantSchema = "wattage") { return { id: "led-bulbs", title: "لامپ LED", variantSchema, enabled: true, sortOrder: 1 }; }
function target(attributes = { watt: 20 }, variantId = "20w", label = "20 وات") { return { variantId, label, attributes }; }
function item(title, snippet = "", sourceId = "source") { return { sourceId, url: `https://example.com/${sourceId}`, title, snippet }; }
function input(overrides = {}) { return { category: category(), target: target(), rawResultItem: item("20 وات 220000 تومان / 30 وات 350000 تومان"), queryId: "led-bulbs:20w:price", observedAt, ...overrides }; }
function candidate(overrides = {}) { return { schemaVersion: 1, matched: true, variantId: "20w", price: 220000, currency: "TOMAN", evidence: { variantText: "20 وات", priceText: "220000 تومان" }, ...overrides }; }

describe("market reference AI evidence extraction boundary", () => {
	it("marks unresolved wattage and ampere Toman evidence eligible, but rejects empty, no-Toman, unsupported, and deterministic-success inputs", () => {
		expect(isAiFallbackEligible(input())).toBe(true);
		expect(isAiFallbackEligible(input({ category: category("ampere"), target: target({ ampere: 16 }, "16a", "16 آمپر"), queryId: "led-bulbs:16a:price", rawResultItem: item("16 آمپر 220000 تومان / 25 آمپر 300000 تومان") }))).toBe(true);
		for (const value of [input({ rawResultItem: item("20 وات 220000 ریال") }), input({ rawResultItem: item(" ", " ") }), input({ category: category("model"), target: target({ model: "X" }, "x", "X"), queryId: "led-bulbs:x:price" }), input({ rawResultItem: item("20 وات 220000 تومان") })]) expect(isAiFallbackEligible(value)).toBe(false);
	});

	it("enforces the strict discriminated candidate contract", () => {
		expect(validateAiExtractionResult({ schemaVersion: 1, matched: false })).toEqual({ schemaVersion: 1, matched: false });
		expect(validateAiExtractionResult(candidate())).toEqual(candidate());
		for (const value of [{ schemaVersion: 1, matched: false, price: 1 }, { ...candidate(), extra: true }, candidate({ currency: "IRR" }), candidate({ price: 0 }), candidate({ price: 1.5 })]) expect(() => validateAiExtractionResult(value)).toThrow(MarketReferenceValidationError);
	});

	it("constructs a deterministic minimal prompt without source identity or unrelated data", () => {
		const value = input(); const prompt = buildAiExtractionPrompt(value);
		expect(prompt).toBe(buildAiExtractionPrompt(value));
		expect(prompt).toContain("220000 تومان");
		expect(prompt).not.toContain(value.rawResultItem.url);
		expect(prompt).not.toContain(value.rawResultItem.sourceId);
	});

	it("grounds exact wattage and ampere candidates and maps only trusted source/time fields", () => {
		const wattObservation = observationFromGroundedAiCandidate(input(), candidate());
		expect(wattObservation).toEqual({ variantId: "20w", price: 220000, currency: "TOMAN", source: { sourceId: "source", url: "https://example.com/source" }, observedAt });
		const ampInput = input({ category: category("ampere"), target: target({ ampere: 16 }, "16a", "16 آمپر"), queryId: "led-bulbs:16a:price", rawResultItem: item("16A 220,000 تومان / 25A 300000 تومان") });
		expect(observationFromGroundedAiCandidate(ampInput, candidate({ variantId: "16a", evidence: { variantText: "16A", priceText: "220,000 تومان" } }))).toMatchObject({ variantId: "16a", price: 220000, source: { sourceId: "source" }, observedAt });
	});

	it("rejects hallucinated prices, variants, evidence, Rial, altered values, and substring variants", () => {
		const cases = [
			candidate({ price: 999999 }), candidate({ variantId: "30w" }), candidate({ evidence: { variantText: "50 وات", priceText: "220000 تومان" } }), candidate({ evidence: { variantText: "20 وات", priceText: "999999 تومان" } }), candidate({ evidence: { variantText: "120W", priceText: "220000 تومان" } }),
		];
		for (const value of cases) expect(observationFromGroundedAiCandidate(input(), value)).toBeNull();
		const rial = input({ rawResultItem: item("20 وات 220000 ریال") });
		expect(observationFromGroundedAiCandidate(rial, candidate())).toBeNull();
		const amp = input({ category: category("ampere"), target: target({ ampere: 16 }, "16a", "16 آمپر"), queryId: "led-bulbs:16a:price", rawResultItem: item("116A 220000 تومان") });
		expect(observationFromGroundedAiCandidate(amp, candidate({ variantId: "16a", evidence: { variantText: "116A", priceText: "220000 تومان" } }))).toBeNull();
	});

	it("calls the injected model at most once only for eligible input", async () => {
		const invokeModel = vi.fn().mockResolvedValue(candidate());
		expect(await extractWithAiFallback({ ...input(), invokeModel })).toMatchObject({ price: 220000 });
		expect(invokeModel).toHaveBeenCalledOnce();
		const noCall = vi.fn();
		expect(await extractWithAiFallback({ ...input({ rawResultItem: item("20 وات 220000 تومان") }), invokeModel: noCall })).toBeNull();
		expect(noCall).not.toHaveBeenCalled();
	});

	it("returns no observation for matched:false, surfaces malformed candidates and invocation failures as controlled errors", async () => {
		expect(await extractWithAiFallback({ ...input(), invokeModel: vi.fn().mockResolvedValue({ schemaVersion: 1, matched: false }) })).toBeNull();
		await expect(extractWithAiFallback({ ...input(), invokeModel: vi.fn().mockResolvedValue({ broken: true }) })).rejects.toBeInstanceOf(MarketReferenceAiExtractionError);
		await expect(extractWithAiFallback({ ...input(), invokeModel: vi.fn().mockRejectedValue(new Error("secret-value")) })).rejects.toThrow("AI extraction model invocation failed.");
	});

	it("is pure and preserves its inputs", () => {
		const value = input(); const original = structuredClone(value);
		expect(observationFromGroundedAiCandidate(value, candidate())).toEqual(observationFromGroundedAiCandidate(value, candidate()));
		expect(value).toEqual(original);
	});
});
