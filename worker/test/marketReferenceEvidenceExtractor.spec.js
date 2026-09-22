import { describe, expect, it } from "vitest";
import { extractResearchObservations } from "../src/marketReference/marketReferenceEvidenceExtractor.js";
import { MarketReferenceValidationError } from "../src/marketReference/marketReferenceService.js";
import { validateResearchObservationBatch } from "../src/marketReference/marketReferenceObservationService.js";

const observedAt = "2026-09-22T10:00:00.000Z";
function category(variantSchema = "wattage", overrides = {}) { return { id: "led-bulbs", title: "لامپ LED", variantSchema, enabled: true, sortOrder: 1, ...overrides }; }
function target(attributes = { watt: 20 }, overrides = {}) { return { variantId: "20w", label: "20 وات", attributes, ...overrides }; }
function raw(results, queryId = "led-bulbs:20w:price") { return { schemaVersion: 1, queryId, results }; }
function result(title, snippet = "", sourceId = "source") { return { sourceId, url: `https://example.com/${sourceId}`, title, snippet }; }
function extract({ category: cat = category(), target: item = target(), rawSearchResult = raw([result("لامپ 20 وات، 220,000 تومان")]), observedAt: time = observedAt } = {}) { return extractResearchObservations({ category: cat, target: item, rawSearchResult, observedAt: time }); }

describe("market reference deterministic evidence extractor", () => {
	it("extracts explicit comma, Persian, Arabic-Indic, separator, and تومن/Toman evidence", () => {
		const cases = [
			["20W 220,000 تومان", 220000], ["۲۰ وات ۲۲۰٬۰۰۰ تومان", 220000], ["٢٠ وات ٢٢٠٬٠٠٠ تومن", 220000], ["20 W 220000 تومان", 220000],
		];
		for (const [text, price] of cases) expect(extract({ rawSearchResult: raw([result(text)]) }).observations[0].price).toBe(price);
	});

	it("uses title and snippet only, preserves source fields and input ordering", () => {
		const value = raw([result("20 وات 220000 تومان", "", "one"), result("20 وات 230000 تومان", "", "two")]);
		const output = extract({ rawSearchResult: value });
		expect(output.observations.map((item) => [item.price, item.source.sourceId, item.source.url, item.observedAt])).toEqual([[220000, "one", "https://example.com/one", observedAt], [230000, "two", "https://example.com/two", observedAt]]);
		expect(validateResearchObservationBatch(output)).toBe(output);
	});

	it("rejects bare, Rial-only, query-only, zero, malformed, ranged, old/new, and multiple-price evidence", () => {
		const cases = ["20 وات 220000", "20 وات 220000 ریال", "20 وات 0 تومان", "20 وات 22,00 تومان", "20 وات از 200,000 تا 250,000 تومان", "20 وات 220000 تومان، قبلی 250000 تومان", "20 وات 220000 تومان و 250000 تومان"];
		for (const text of cases) expect(extract({ rawSearchResult: raw([result(text)]) }).observations).toEqual([]);
		expect(extract({ rawSearchResult: raw([result("20 وات 220000")]) }).observations).toEqual([]);
	});

	it("matches exact wattage forms without substring matches and skips conflicting variants", () => {
		for (const text of ["20 وات 220000 تومان", "20W 220000 تومان", "20 W 220000 تومان", "۲۰ وات ۲۲۰۰۰۰ تومان"]) expect(extract({ rawSearchResult: raw([result(text)]) }).observations).toHaveLength(1);
		for (const text of ["120W 220000 تومان", "200W 220000 تومان", "30 وات 220000 تومان", "20 وات 220000 تومان / 30 وات 350000 تومان"]) expect(extract({ rawSearchResult: raw([result(text)]) }).observations).toEqual([]);
	});

	it("matches exact ampere forms without substring matches", () => {
		const cat = category("ampere"); const item = target({ ampere: 16 }, { variantId: "16a", label: "16 آمپر" });
		for (const text of ["16 آمپر 220000 تومان", "۱۶ آمپر ۲۲۰۰۰۰ تومان", "16A 220000 تومان", "16 A 220000 تومان"]) expect(extract({ category: cat, target: item, rawSearchResult: raw([result(text)], "led-bulbs:16a:price") }).observations).toHaveLength(1);
		for (const text of ["116A 220000 تومان", "25 آمپر 220000 تومان"]) expect(extract({ category: cat, target: item, rawSearchResult: raw([result(text)], "led-bulbs:16a:price") }).observations).toEqual([]);
	});

	it("keeps repeated identical prices unambiguous, emits at most one observation per raw result, and returns empty for unsupported schemas", () => {
		expect(extract({ rawSearchResult: raw([result("20 وات 220000 تومان، 220,000 تومان")]) }).observations).toHaveLength(1);
		expect(extract({ category: category("model"), target: target({ model: "X" }, { variantId: "x", label: "X" }), rawSearchResult: raw([result("X 220000 تومان")], "led-bulbs:x:price") }).observations).toEqual([]);
	});

	it("rejects malformed contracts, invalid timestamps, and query identity mismatches", () => {
		const cases = [
			() => extract({ rawSearchResult: raw([], "led-bulbs:other:price") }),
			() => extract({ rawSearchResult: { schemaVersion: 1, queryId: "led-bulbs:20w:price", results: [{}] } }),
			() => extract({ target: target({ watt: 0 }) }), () => extract({ category: category("bad") }), () => extract({ observedAt: "not-a-time" }),
		];
		for (const attempt of cases) expect(attempt).toThrow(MarketReferenceValidationError);
	});

	it("is pure and deterministic", () => {
		const input = { category: category(), target: target(), rawSearchResult: raw([result("20 وات 220000 تومان")]), observedAt };
		const original = structuredClone(input);
		expect(extract(input)).toEqual(extract(input));
		expect(input).toEqual(original);
	});
});
