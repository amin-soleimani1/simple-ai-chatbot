import { describe, expect, it, vi } from "vitest";
import worker from "../src";
import { getRuntimeKnowledge } from "../src/knowledge/knowledgeService.js";

function createRuntimeEnv(initialValues = {}) {
	const values = new Map(Object.entries(initialValues));
	return {
		APP_CONFIG: {
			get: vi.fn(async (key) => values.get(key) ?? null),
			put: vi.fn(async (key, value) => values.set(key, value)),
		},
		_values: values,
	};
}

function priceListRecord(id = "economy-bulbs") {
	return JSON.stringify({ id, type: "price_list", rawText: "not parsed at runtime", parsedData: { items: [{ watt: 9, price: 160000 }] } });
}

describe("runtime knowledge", () => {
	it("includes saved default price, per-watt, and text categories without reparsing raw text", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord(),
			"knowledge:ceiling-panels": JSON.stringify({ id: "ceiling-panels", type: "per_watt_price", parsedData: { pricePerWatt: 9000 } }),
			"knowledge:chips": JSON.stringify({ id: "chips", type: "text", parsedData: { text: "Saved text knowledge" } }),
		}));

		expect(runtime.available).toBe(true);
		expect(runtime.categories).toEqual(expect.arrayContaining([
			{ title: expect.any(String), type: "price_list", data: { items: [{ watt: 9, priceToman: 160000 }] } },
			{ title: expect.any(String), type: "per_watt_price", data: { pricePerWattToman: 9000 } },
			{ title: expect.any(String), type: "text", data: { text: "Saved text knowledge" } },
		]));
	});

	it("omits unsaved default and dynamic categories", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord(),
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "LED strips", type: "text" }]),
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ title: expect.any(String), type: "price_list", data: { items: [{ watt: 9, priceToman: 160000 }] } }],
		});
	});

	it("includes a saved dynamic category", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "LED strips", type: "text" }]),
			"knowledge:led-strips": JSON.stringify({ id: "led-strips", type: "text", parsedData: { text: "12 volt strips" } }),
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ title: "LED strips", type: "text", data: { text: "12 volt strips" } }],
		});
	});

	it("skips malformed category records without failing runtime knowledge", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord(),
			"knowledge:chips": JSON.stringify({ id: "chips", type: "text", parsedData: { text: "" } }),
			"knowledge:repairs": "{not-json",
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ title: expect.any(String), type: "price_list", data: { items: [{ watt: 9, priceToman: 160000 }] } }],
		});
	});

	it("fails safe when KV access fails", async () => {
		const runtime = await getRuntimeKnowledge({ APP_CONFIG: { get: vi.fn().mockRejectedValue(new Error("KV unavailable")) } });
		expect(runtime).toEqual({ available: false, categories: [] });
	});

	it("uses runtime KV knowledge instead of static knowledge in the chat prompt", async () => {
		const env = createRuntimeEnv({ "knowledge:economy-bulbs": priceListRecord() });
		env.AI = { run: vi.fn().mockResolvedValue({ response: "ok" }) };
		const response = await worker.fetch(new Request("http://example.com/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: "price" }),
		}), env);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: "ok" });
		const prompt = env.AI.run.mock.calls[0][1].messages[0].content;
		expect(prompt).toContain('"available":true');
		expect(prompt).toContain('"priceToman":160000');
		expect(prompt).not.toContain('"boxedPrice"');
		expect(prompt).toContain("Perform any needed calculations internally.");
		expect(prompt).toContain("never show formulas, arithmetic steps, multiplication, addition, or calculation reasoning.");
	});

	it("passes unavailable runtime knowledge to the chat prompt when KV fails", async () => {
		const env = {
			APP_CONFIG: { get: vi.fn().mockRejectedValue(new Error("KV unavailable")) },
			AI: { run: vi.fn().mockResolvedValue({ response: "ok" }) },
		};
		const response = await worker.fetch(new Request("http://example.com/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: "price" }),
		}), env);

		expect(response.status).toBe(200);
		const prompt = env.AI.run.mock.calls[0][1].messages[0].content;
		expect(prompt).toContain('"available":false');
		expect(prompt).toContain('"categories":[]');
	});
});
