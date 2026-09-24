import { describe, expect, it, vi } from "vitest";
import worker from "../src";
import { getRuntimeKnowledge, KNOWLEDGE_CATEGORIES } from "../src/knowledge/knowledgeService.js";

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

function priceListRecord(id = "economy-bulbs", items = [{ watt: 9, price: 160000 }]) {
	return JSON.stringify({ id, type: "price_list", rawText: "not parsed at runtime", parsedData: { items } });
}

function categoryWithStatus(id, status) {
	const category = KNOWLEDGE_CATEGORIES.find((item) => item.id === id);
	return { ...category, schemaVersion: 2, status, showInSuggestions: true, sortOrder: 10 };
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
			{ id: "economy-bulbs", title: expect.any(String), type: "price_list", status: "available", data: { items: [{ watt: 9, priceToman: 160000, available: true }] } },
			{ id: "ceiling-panels", title: expect.any(String), type: "per_watt_price", status: "available", data: { pricePerWattToman: 9000 } },
			{ id: "chips", title: expect.any(String), type: "text", status: "available", data: { text: "Saved text knowledge" } },
		]));
	});

	it("omits unsaved default and dynamic categories", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord(),
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "LED strips", type: "text" }]),
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ id: "economy-bulbs", title: expect.any(String), type: "price_list", status: "available", data: { items: [{ watt: 9, priceToman: 160000, available: true }] } }],
		});
	});

	it("includes a saved dynamic category", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "LED strips", type: "text" }]),
			"knowledge:led-strips": JSON.stringify({ id: "led-strips", type: "text", parsedData: { text: "12 volt strips" } }),
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ id: "led-strips", title: "LED strips", type: "text", status: "available", data: { text: "12 volt strips" } }],
		});
	});

	it("keeps legacy dynamic categories available to runtime knowledge without migrating KV", async () => {
		const env = createRuntimeEnv({
			"knowledge:categories": JSON.stringify([{ id: "legacy-bulbs", title: "Legacy bulbs", type: "price_list" }]),
			"knowledge:legacy-bulbs": priceListRecord("legacy-bulbs"),
		});
		expect(await getRuntimeKnowledge(env)).toEqual({
			available: true,
			categories: [{ id: "legacy-bulbs", title: "Legacy bulbs", type: "price_list", status: "available", data: { items: [{ watt: 9, priceToman: 160000, available: true }] } }],
		});
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("exposes explicit item availability and defaults legacy items to available without KV writes", async () => {
		const env = createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [
				{ watt: 20, price: 220000, available: true },
				{ watt: 30, price: 350000, available: false },
				{ watt: 40, price: 420000 },
			]),
		});
		const runtime = await getRuntimeKnowledge(env);
		expect(runtime.categories.find((category) => category.id === "economy-bulbs").data.items).toEqual([
			{ watt: 20, priceToman: 220000, available: true },
			{ watt: 30, priceToman: 350000, available: false },
			{ watt: 40, priceToman: 420000, available: true },
		]);
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("keeps category status separate from item availability in runtime knowledge", async () => {
		const economyCategory = KNOWLEDGE_CATEGORIES.find((category) => category.id === "economy-bulbs");
		for (const status of ["available", "out_of_stock", "not_sold"]) {
			const runtime = await getRuntimeKnowledge(createRuntimeEnv({
				"knowledge:categories": JSON.stringify([{ ...economyCategory, schemaVersion: 2, status, showInSuggestions: false, sortOrder: 0 }]),
				"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [{ watt: 20, price: 220000, available: true }]),
			}));
			const category = runtime.categories.find((item) => item.id === "economy-bulbs");
			expect(category.status).toBe(status);
			expect(category.data.items[0]).toEqual({ watt: 20, priceToman: 220000, available: true });
		}
	});

	it("skips malformed category records without failing runtime knowledge", async () => {
		const runtime = await getRuntimeKnowledge(createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord(),
			"knowledge:chips": JSON.stringify({ id: "chips", type: "text", parsedData: { text: "" } }),
			"knowledge:repairs": "{not-json",
		}));

		expect(runtime).toEqual({
			available: true,
			categories: [{ id: "economy-bulbs", title: expect.any(String), type: "price_list", status: "available", data: { items: [{ watt: 9, priceToman: 160000, available: true }] } }],
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
		expect(prompt).toContain('"priceToman":160000');
		expect(prompt).toContain('"available":true');
		expect(prompt).toContain("takes precedence over item availability");
		expect(prompt).toContain("current purchasable price");
		expect(prompt).toContain('"status":"available"');
		expect(prompt).toContain('"priceSource":"store"');
		expect(prompt).not.toContain('"marketReferences"');
		expect(prompt).not.toContain('"priceSource":"market_reference"');
		expect(prompt).not.toContain('"boxedPrice"');
		expect(prompt).toContain("قانون قطعی محاسبات");
		expect(prompt).toContain("هرگز operands، operators، equation، formula، ضرب، جمع، مراحل محاسبه یا reasoning محاسباتی را نمایش نده");
		expect(prompt).toContain("24 × 9000");
		expect(prompt).toContain("24 * 9000");
		expect(prompt).toContain("قیمت پنل سقفی ۲۴ وات، ۲۱۶ هزار تومان است.");
	});

	it("distinguishes missing Official Knowledge from explicit available, out-of-stock, and not-sold statuses in the chat prompt", async () => {
		const env = createRuntimeEnv({
			"knowledge:categories": JSON.stringify([
				categoryWithStatus("economy-bulbs", "available"),
				categoryWithStatus("projectors", "out_of_stock"),
				categoryWithStatus("repairs", "not_sold"),
			]),
			"knowledge:economy-bulbs": priceListRecord("economy-bulbs"),
			"knowledge:projectors": priceListRecord("projectors"),
			"knowledge:repairs": priceListRecord("repairs"),
		});
		env.AI = { run: vi.fn().mockResolvedValue({ response: "ok" }) };
		await worker.fetch(new Request("http://example.com/chat", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "unknown product" }),
		}), env);

		const prompt = env.AI.run.mock.calls[0][1].messages[0].content;
		expect(prompt).toContain("در حال حاضر اطلاعات این محصول در فهرست محصولات فروشگاه ثبت نشده. برای دیدن محصولات ثبت‌شده می‌توانید پیشنهادهای پایین صفحه را بررسی کنید.");
		expect(prompt).toContain("نبود اطلاعات Official Store Knowledge به معنی ناموجود، اتمام موجودی یا نفروختن محصول نیست");
		expect(prompt).toContain('"status":"available"');
		expect(prompt).toContain('"status":"out_of_stock"');
		expect(prompt).toContain('"status":"not_sold"');
	});

	it("returns a structured price table for a saved requested price-list category without calling AI", async () => {
		const env = createRuntimeEnv({
			"knowledge:projectors": JSON.stringify({
				id: "projectors",
				type: "price_list",
				parsedData: { items: [{ watt: 50, price: 500000, available: true }, { watt: 100, price: 1000000, available: false }] },
			}),
		});
		env.AI = { run: vi.fn() };

		const response = await worker.fetch(new Request("http://example.com/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: "projectors",
				presentationRequest: { type: "price_table", categoryId: "projectors" },
			}),
		}), env);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			message: expect.any(String),
			presentation: {
				type: "price_table",
				categoryId: "projectors",
				title: expect.any(String),
				status: "available",
				rows: [{ watt: 50, priceToman: 500000, available: true }, { watt: 100, priceToman: 1000000, available: false }],
			},
		});
		expect(env.AI.run).not.toHaveBeenCalled();
	});

	it("does not read orphaned Market Reference data for conversational responses", async () => {
		const env = createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [{ watt: 9, price: 160000, available: false }]),
			"market-reference:economy-bulbs": JSON.stringify({ unused: true }),
		});
		env.AI = { run: vi.fn().mockResolvedValue({ response: "ok" }) };
		await worker.fetch(new Request("http://example.com/chat", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "price" }),
		}), env);
		const prompt = env.AI.run.mock.calls[0][1].messages[0].content;
		expect(prompt).toContain('"priceSource":"store"');
		expect(prompt).not.toContain("marketReferences");
		expect(prompt).not.toContain("market_reference");
		expect(env.APP_CONFIG.get.mock.calls.map(([key]) => key)).not.toContain("market-reference:economy-bulbs");
	});

	it("keeps unavailable Official Store items in structured price tables without Market Reference fallback", async () => {
		const env = createRuntimeEnv({
			"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [{ watt: 9, price: 160000, available: false }]),
			"market-reference:economy-bulbs": JSON.stringify({ unused: true }),
		});
		env.AI = { run: vi.fn() };
		const response = await worker.fetch(new Request("http://example.com/chat", {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: "price", presentationRequest: { type: "price_table", categoryId: "economy-bulbs" } }),
		}), env);
		const presentation = (await response.json()).presentation;
		expect(presentation.rows).toEqual([{ watt: 9, priceToman: 160000, available: false }]);
		expect(presentation.marketReference).toBeUndefined();
		expect(env.APP_CONFIG.get.mock.calls.map(([key]) => key)).not.toContain("market-reference:economy-bulbs");
	});

	it("keeps Official Store category status authoritative without Market Reference reads", async () => {
		for (const status of ["out_of_stock", "not_sold"]) {
			const env = createRuntimeEnv({
				"knowledge:categories": JSON.stringify([categoryWithStatus("economy-bulbs", status)]),
				"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [{ watt: 9, price: 160000, available: true }]),
				"market-reference:economy-bulbs": JSON.stringify({ unused: true }),
			});
			env.AI = { run: vi.fn() };
			const response = await worker.fetch(new Request("http://example.com/chat", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "price", presentationRequest: { type: "price_table", categoryId: "economy-bulbs" } }),
			}), env);
			const presentation = (await response.json()).presentation;
			expect(presentation.status).toBe(status);
			expect(presentation.rows).toEqual(status === "not_sold" ? [] : [{ watt: 9, priceToman: 160000, available: true }]);
			expect(presentation.marketReference).toBeUndefined();
			expect(env.APP_CONFIG.get.mock.calls.map(([key]) => key)).not.toContain("market-reference:economy-bulbs");
		}
	});

	it("keeps category status precedence in structured price tables", async () => {
		const economyCategory = KNOWLEDGE_CATEGORIES.find((category) => category.id === "economy-bulbs");
		for (const status of ["out_of_stock", "not_sold"]) {
			const env = createRuntimeEnv({
				"knowledge:categories": JSON.stringify([{ ...economyCategory, schemaVersion: 2, status, showInSuggestions: false, sortOrder: 0 }]),
				"knowledge:economy-bulbs": priceListRecord("economy-bulbs", [{ watt: 20, price: 220000, available: true }]),
			});
			const response = await worker.fetch(new Request("http://example.com/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message: "prices", presentationRequest: { type: "price_table", categoryId: "economy-bulbs" } }),
			}), env);
			const presentation = (await response.json()).presentation;
			expect(presentation.status).toBe(status);
			expect(presentation.rows).toEqual(status === "not_sold" ? [] : [{ watt: 20, priceToman: 220000, available: true }]);
		}
	});

	it("keeps ordinary chat responses on the existing text path", async () => {
		const env = createRuntimeEnv({ "knowledge:projectors": priceListRecord("projectors") });
		env.AI = { run: vi.fn().mockResolvedValue({ response: "text reply" }) };
		const response = await worker.fetch(new Request("http://example.com/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: "single product question" }),
		}), env);

		expect(await response.json()).toEqual({ message: "text reply" });
		expect(env.AI.run).toHaveBeenCalledOnce();
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
