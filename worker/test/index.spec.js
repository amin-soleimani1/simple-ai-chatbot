import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src";
import { getKnowledgeCategory, getRuntimeKnowledge, parseKnowledge, resolveKnowledgeCategory } from "../src/knowledge/knowledgeService.js";

const authEnv = {
	ADMIN_PIN: "123456",
	ADMIN_SESSION_SECRET: "test-only-session-signing-secret",
	ADMIN_AUTH_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
};

const localAuthEnv = { ...authEnv, ADMIN_COOKIE_MODE: "local" };

function request(path, options = {}) {
	return new Request(`http://example.com${path}`, options);
}

async function createSessionCookie() {
	const response = await worker.fetch(request("/admin/auth", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ pin: authEnv.ADMIN_PIN }),
	}), authEnv);
	return response.headers.get("Set-Cookie").split(";")[0];
}

function createKnowledgeEnv(initialValues = {}) {
	const values = new Map(Object.entries(initialValues));
	return {
		...authEnv,
		APP_CONFIG: {
			get: vi.fn(async (key) => values.get(key) ?? null),
			put: vi.fn(async (key, value) => values.set(key, value)),
		},
		_values: values,
	};
}

async function authenticatedKnowledgeRequest(path, options = {}, env = createKnowledgeEnv()) {
	const cookie = await createSessionCookie();
	return {
		env,
		response: await worker.fetch(request(path, {
			...options,
			headers: { Cookie: cookie, ...(options.headers ?? {}) },
		}), env),
	};
}

describe("worker routes", () => {
	it("returns 404 for an unknown route (unit style)", async () => {
		const request = new Request("http://example.com");
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Endpoint not found." });
	});

	it("returns 404 for an unknown route (integration style)", async () => {
		const response = await SELF.fetch("http://example.com");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Endpoint not found." });
	});

	it("allows an admin auth attempt within the rate limit", async () => {
		const response = await worker.fetch(request("/admin/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.9" },
			body: JSON.stringify({ pin: "000000" }),
		}), authEnv);
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ success: false });
		expect(authEnv.ADMIN_AUTH_RATE_LIMIT.limit).toHaveBeenCalledWith({ key: "198.51.100.9" });
	});

	it("rejects an admin auth attempt after the rate limit", async () => {
		const rateLimitedEnv = { ...authEnv, ADMIN_AUTH_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: false }) } };
		const response = await worker.fetch(request("/admin/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json", "CF-Connecting-IP": "198.51.100.10" },
			body: JSON.stringify({ pin: authEnv.ADMIN_PIN }),
		}), rateLimitedEnv);
		expect(response.status).toBe(429);
		expect(await response.json()).toEqual({ success: false, error: "Too many attempts. Try again later." });
	});

	it("creates a signed session cookie for a correct admin PIN", async () => {
		const response = await worker.fetch(request("/admin/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pin: authEnv.ADMIN_PIN }),
		}), authEnv);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=7200");
		expect(response.headers.get("Set-Cookie")).toContain("Secure");
		expect(response.headers.get("Set-Cookie")).toContain("SameSite=None");
	});

	it("uses a non-secure SameSite=Lax cookie for local admin login", async () => {
		const response = await worker.fetch(request("/admin/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ pin: localAuthEnv.ADMIN_PIN }),
		}), localAuthEnv);
		const cookie = response.headers.get("Set-Cookie");
		expect(response.status).toBe(200);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).not.toContain("Secure");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=7200");
	});

	it("reports no session when the cookie is absent", async () => {
		const response = await worker.fetch(request("/admin/session"), authEnv);
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ authenticated: false });
	});

	it("accepts a valid signed session", async () => {
		const cookie = await createSessionCookie();
		const response = await worker.fetch(request("/admin/session", { headers: { Cookie: cookie } }), authEnv);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ authenticated: true });
	});

	it("expires the session cookie on logout", async () => {
		const response = await worker.fetch(request("/admin/logout", { method: "POST" }), authEnv);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ success: true });
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
		expect(response.headers.get("Set-Cookie")).toContain("Secure");
		expect(response.headers.get("Set-Cookie")).toContain("SameSite=None");
	});

	it("expires the session cookie with the local policy", async () => {
		const response = await worker.fetch(request("/admin/logout", { method: "POST" }), localAuthEnv);
		const cookie = response.headers.get("Set-Cookie");
		expect(response.status).toBe(200);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("SameSite=Lax");
		expect(cookie).not.toContain("Secure");
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("Max-Age=0");
	});

	it("keeps the existing GET /chat method guard", async () => {
		const response = await worker.fetch(request("/chat"), authEnv);
		expect(response.status).toBe(405);
	});

	it("allows PUT in an admin knowledge preflight from an allowed origin", async () => {
		const response = await worker.fetch(request("/admin/knowledge/projectors", {
			method: "OPTIONS",
			headers: { Origin: "http://127.0.0.1:5173", "Access-Control-Request-Method": "PUT" },
		}), authEnv);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
		expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
		expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, PATCH, OPTIONS");
	});

	it("keeps disallowed origins blocked for preflight", async () => {
		const response = await worker.fetch(request("/admin/knowledge/projectors", {
			method: "OPTIONS",
			headers: { Origin: "https://untrusted.example", "Access-Control-Request-Method": "PUT" },
		}), authEnv);
		expect(response.status).toBe(403);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("requires a session for knowledge routes", async () => {
		const response = await worker.fetch(request("/admin/knowledge"), createKnowledgeEnv());
		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ authenticated: false });
	});

	it("lists the six known knowledge categories", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge");
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.categories).toHaveLength(6);
		expect(body.categories.map((category) => category.id)).toContain("chips");
	});

	it("rejects an unknown knowledge category", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/unknown");
		expect(response.status).toBe(404);
	});

	it("gets an empty known knowledge category without seeding KV", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/chips", {}, env);
		expect(response.status).toBe(200);
		expect((await response.json()).knowledge).toBeNull();
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("parses Persian and Arabic digit price lists", () => {
		const category = getKnowledgeCategory("iranian-bulbs-warranty");
		expect(parseKnowledge(category, "۹وات ۱۶۰\n١٢ وات ١٨٠")).toEqual({
			valid: true,
			parsedData: { items: [{ watt: 9, price: 160000 }, { watt: 12, price: 180000 }] },
			errors: [],
		});
	});

	it("uses the explicit projector toman shorthand as millions", () => {
		const category = getKnowledgeCategory("projectors");
		expect(parseKnowledge(category, "50 وات 1 تومن").parsedData).toEqual({ items: [{ watt: 50, price: 1000000 }] });
	});

	it("uses thousand-toman units for ordinary price list values", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "20 وات 300").parsedData).toEqual({ items: [{ watt: 20, price: 300000 }] });
	});

	it("imports a Persian price-list heading and rows as normalized toman prices", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "قیمت لامپ بدون جعبه اقتصادی یکسال گارانتی\n۲۰وات ۲۲۰\n۳۰وات ۳۵۰\n۵۰وات ۴۸۰\n۶۰وات ۵۸۰")).toMatchObject({
			valid: true,
			parsedData: { items: [
				{ watt: 20, price: 220000 }, { watt: 30, price: 350000 },
				{ watt: 50, price: 480000 }, { watt: 60, price: 580000 },
			] },
		});
	});

	it("normalizes Persian, Arabic, English, and W watt syntax", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "۲۰وات ۲۲۰\n٣٠ وات ٣٥٠\n50W 480\n60w 580").parsedData).toEqual({ items: [
			{ watt: 20, price: 220000 }, { watt: 30, price: 350000 },
			{ watt: 50, price: 480000 }, { watt: 60, price: 580000 },
		] });
	});

	it("normalizes attached toman units and conservative million shorthand", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "20 وات 220تومن\n30 وات 1800تومان\n50 وات 1تومن\n60 وات 9 تومان\n70 وات 10 تومان").parsedData).toEqual({ items: [
			{ watt: 20, price: 220000 }, { watt: 30, price: 1800000 }, { watt: 50, price: 1000000 },
			{ watt: 60, price: 9000000 }, { watt: 70, price: 10000 },
		] });
	});

	it("keeps explicit full toman amounts unchanged", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "20 وات 220000 تومان\n30 وات 220,000 تومان\n50 وات ۲۲۰٬۰۰۰ تومان").parsedData).toEqual({ items: [
			{ watt: 20, price: 220000 }, { watt: 30, price: 220000 }, { watt: 50, price: 220000 },
		] });
	});

	it("uses the generalized million shorthand for projector imports without a category-specific rule", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "50 وات 1 تومان").parsedData).toEqual({ items: [{ watt: 50, price: 1000000 }] });
	});

	it("rejects zero, negative, and malformed price-list rows", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "0 وات 220").valid).toBe(false);
		expect(parseKnowledge(category, "20 وات 0").valid).toBe(false);
		expect(parseKnowledge(category, "-20 وات 220").valid).toBe(false);
		expect(parseKnowledge(category, "20 وات قیمت").valid).toBe(false);
	});

	it("parses a panel price per watt", () => {
		const category = getKnowledgeCategory("ceiling-panels");
		expect(parseKnowledge(category, "هر وات ۹۰۰۰ تومان").parsedData).toEqual({ pricePerWatt: 9000 });
	});

	it("accepts non-empty text knowledge", () => {
		const category = getKnowledgeCategory("chips");
		expect(parseKnowledge(category, "چیپ COB موجود است").valid).toBe(true);
	});

	it("rejects empty raw text", () => {
		const category = getKnowledgeCategory("chips");
		expect(parseKnowledge(category, "   ").errors[0]).toMatchObject({ line: 1, message: "متن نمی‌تواند خالی باشد." });
	});

	it("returns line-specific errors for incomplete price rows", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		const result = parseKnowledge(category, "9 وات\n12 وات 180");
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({ line: 1, message: "قیمت مشخص نشده است." });
	});

	it("rejects duplicate watt entries", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "9 وات 160\n9 وات 180").valid).toBe(false);
	});

	it("accepts a projector heading before four price rows", () => {
		const category = getKnowledgeCategory("projectors");
		const result = parseKnowledge(category, "پروژکتور\n۵۰وات ۵۰۰\n۱۰۰وات ۱تومن\n۱۵۰وات ۱۵۰۰\n۲۰۰وات ۲تومن");
		expect(result).toEqual({
			valid: true,
			parsedData: { items: [
				{ watt: 50, price: 500000 },
				{ watt: 100, price: 1000000 },
				{ watt: 150, price: 1500000 },
				{ watt: 200, price: 2000000 },
			] },
			errors: [],
		});
	});

	it("accepts a Persian bulb heading before price rows", () => {
		const category = getKnowledgeCategory("iranian-bulbs-warranty");
		const result = parseKnowledge(category, "لامپ ایرانی ضمانت یکساله\n۹وات ۱۶۰\n۱۲وات ۱۸۰");
		expect(result).toMatchObject({ valid: true, parsedData: { items: [{ watt: 9, price: 160000 }, { watt: 12, price: 180000 }] } });
	});

	it("rejects invalid text between valid price rows", () => {
		const category = getKnowledgeCategory("projectors");
		const result = parseKnowledge(category, "پروژکتور\n۵۰وات ۵۰۰\nمتن نامعتبر وسط لیست\n۱۰۰وات ۱تومن");
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({ line: 3, message: "فرمت هر خط باید مانند «۹ وات ۱۶۰» باشد." });
	});

	it("does not treat an incomplete watt row as a heading", () => {
		const category = getKnowledgeCategory("projectors");
		const result = parseKnowledge(category, "۱۵۰وات");
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({ line: 1, message: "قیمت مشخص نشده است." });
	});

	it("rejects a heading that has no valid price row after it", () => {
		const category = getKnowledgeCategory("projectors");
		expect(parseKnowledge(category, "پروژکتور").valid).toBe(false);
	});

	it("permits only the first text line as a heading", () => {
		const category = getKnowledgeCategory("projectors");
		const result = parseKnowledge(category, "پروژکتور\nلیست قیمت امروز\n۵۰وات ۵۰۰");
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual({ line: 2, message: "فرمت هر خط باید مانند «۹ وات ۱۶۰» باشد." });
	});

	it("keeps a price list without a heading valid", () => {
		const category = getKnowledgeCategory("economy-bulbs");
		expect(parseKnowledge(category, "۹وات ۱۶۰\n۱۲وات ۱۸۰")).toMatchObject({
			valid: true,
			parsedData: { items: [{ watt: 9, price: 160000 }, { watt: 12, price: 180000 }] },
		});
	});

	it("previews valid knowledge without writing to KV", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/preview", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "9 وات 160" }),
		}, env);
		expect(response.status).toBe(200);
		expect((await response.json())).toMatchObject({ valid: true, changed: true, parsedData: { items: [{ watt: 9, price: 160000 }] } });
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("returns validation errors from preview", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/preview", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "9 وات" }),
		});
		expect(response.status).toBe(400);
		expect((await response.json()).errors[0]).toMatchObject({ line: 1 });
	});

	it("saves validated knowledge to its category key", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs", {
			method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "9 وات 160" }),
		}, env);
		expect(response.status).toBe(200);
		expect((await response.json())).toMatchObject({ valid: true, changed: true, saved: true });
		expect(env.APP_CONFIG.put).toHaveBeenCalledWith("knowledge:economy-bulbs", expect.any(String));
	});

	it("does not write an unchanged semantic price list", async () => {
		const env = createKnowledgeEnv({
			"knowledge:economy-bulbs": JSON.stringify({ id: "economy-bulbs", parsedData: { items: [{ watt: 9, price: 160000 }] } }),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs", {
			method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "۹وات ۱۶۰" }),
		}, env);
		expect((await response.json())).toMatchObject({ valid: true, changed: false, saved: false });
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("reports added, updated and removed prices in a preview", async () => {
		const env = createKnowledgeEnv({
			"knowledge:economy-bulbs": JSON.stringify({ parsedData: { items: [{ watt: 9, price: 160000 }, { watt: 12, price: 180000 }] } }),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/preview", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "9 وات 170\n15 وات 220" }),
		}, env);
		expect((await response.json()).changes).toEqual(expect.arrayContaining([
			{ type: "updated", watt: 9, oldPrice: 160000, newPrice: 170000 },
			{ type: "added", watt: 15, price: 220000 },
			{ type: "removed", watt: 12, price: 180000 },
		]));
	});

	it("updates every price-list item by a percentage with one KV write", async () => {
		const env = createKnowledgeEnv({
			"knowledge:economy-bulbs": JSON.stringify({ id: "economy-bulbs", rawText: "old", parsedData: { items: [{ watt: 20, price: 220000 }, { watt: 30, price: 350000 }, { watt: 50, price: 480000 }] }, updatedAt: "2000-01-01T00:00:00.000Z" }),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/items", {
			method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percentage: 10, direction: "increase" }),
		}, env);
		expect(response.status).toBe(200);
		const { record } = await response.json();
		expect(record.parsedData.items).toEqual([{ watt: 20, price: 242000 }, { watt: 30, price: 385000 }, { watt: 50, price: 528000 }]);
		expect(record.rawText).toBe("20 وات 242000 تومان\n30 وات 385000 تومان\n50 وات 528000 تومان");
		expect(record.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
		expect(env.APP_CONFIG.put).toHaveBeenCalledTimes(1);
		const runtime = await getRuntimeKnowledge(env);
		expect(runtime.categories.find((category) => category.id === "economy-bulbs").data.items).toEqual([{ watt: 20, priceToman: 242000 }, { watt: 30, priceToman: 385000 }, { watt: 50, priceToman: 528000 }]);
	});

	it("applies batch decreases with Math.round semantics", async () => {
		const env = createKnowledgeEnv({
			"knowledge:economy-bulbs": JSON.stringify({ parsedData: { items: [{ watt: 9, price: 105 }, { watt: 12, price: 101 }] } }),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/items", {
			method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percentage: 10, direction: "decrease" }),
		}, env);
		expect((await response.json()).record.parsedData.items).toEqual([{ watt: 9, price: 95 }, { watt: 12, price: 91 }]);
	});

	it("rejects invalid batch price updates without writing any item", async () => {
		const cases = [
			{ path: "/admin/knowledge/missing/items", body: { percentage: 10, direction: "increase" } },
			{ path: "/admin/knowledge/chips/items", body: { percentage: 10, direction: "increase" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: 0, direction: "increase" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: -10, direction: "increase" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: 100, direction: "decrease" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: 101, direction: "decrease" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: 1001, direction: "increase" } },
			{ path: "/admin/knowledge/economy-bulbs/items", body: { percentage: 10, direction: "sideways" } },
		];
		for (const testCase of cases) {
			const env = createKnowledgeEnv({ "knowledge:economy-bulbs": JSON.stringify({ parsedData: { items: [{ watt: 9, price: 160000 }] } }) });
			const { response } = await authenticatedKnowledgeRequest(testCase.path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testCase.body) }, env);
			expect(response.status).toBeGreaterThanOrEqual(400);
			expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
		}
		const malformedEnv = createKnowledgeEnv({ "knowledge:economy-bulbs": JSON.stringify({ parsedData: { items: [{ watt: 9, price: 0 }] } }) });
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/items", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percentage: 10, direction: "increase" }) }, malformedEnv);
		expect(response.status).toBe(409);
		expect(malformedEnv.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("keeps the single-item price PATCH working", async () => {
		const env = createKnowledgeEnv({ "knowledge:economy-bulbs": JSON.stringify({ parsedData: { items: [{ watt: 9, price: 160000 }] } }) });
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/economy-bulbs/items/9", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ price: 170000 }) }, env);
		expect(response.status).toBe(200);
		expect((await response.json()).record.parsedData.items).toEqual([{ watt: 9, price: 170000 }]);
	});

	it("keeps knowledge method guards", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/chips", { method: "POST" });
		expect(response.status).toBe(405);
	});

	it("resolves default categories when the registry is absent", async () => {
		const category = await resolveKnowledgeCategory(createKnowledgeEnv(), "chips");
		expect(category).toMatchObject({ id: "chips", type: "text" });
	});

	it("resolves a dynamic category from the KV registry", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		expect(await resolveKnowledgeCategory(env, "led-strips")).toEqual({
			id: "led-strips", title: "ریسه LED", type: "text",
			status: "available", showInSuggestions: false, sortOrder: 0,
		});
	});

	it("gets a dynamic category", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/led-strips", {}, env);
		expect(response.status).toBe(200);
		expect((await response.json()).category).toEqual({
			id: "led-strips", title: "ریسه LED", type: "text",
			status: "available", showInSuggestions: false, sortOrder: 0,
		});
	});

	it("reads a legacy category with runtime metadata defaults without writing to KV", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "legacy-text", title: "Legacy text", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/legacy-text", {}, env);
		expect(response.status).toBe(200);
		expect((await response.json()).category).toMatchObject({
			id: "legacy-text", type: "text", status: "available", showInSuggestions: false, sortOrder: 0,
		});
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
		expect(env._values.get("knowledge:categories")).toBe(JSON.stringify([{ id: "legacy-text", title: "Legacy text", type: "text" }]));
	});

	it("previews a dynamic category", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/led-strips/preview", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "ریسه ۱۲ ولت" }),
		}, env);
		expect(response.status).toBe(200);
		expect((await response.json())).toMatchObject({ valid: true, changed: true, parsedData: { text: "ریسه ۱۲ ولت" } });
		expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
	});

	it("saves a dynamic category", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/led-strips", {
			method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rawText: "ریسه ۱۲ ولت" }),
		}, env);
		expect(response.status).toBe(200);
		expect(env.APP_CONFIG.put).toHaveBeenCalledWith("knowledge:led-strips", expect.any(String));
	});

	it("rejects an invalid dynamic category type in the registry", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "unsafe", title: "Unsafe", type: "custom_code" }]),
		});
		await expect(resolveKnowledgeCategory(env, "unsafe")).rejects.toThrow("type is invalid");
	});

	it("rejects an invalid dynamic category ID in the registry", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "Unsafe ID", title: "Unsafe", type: "text" }]),
		});
		await expect(resolveKnowledgeCategory(env, "Unsafe ID")).rejects.toThrow("lowercase slug");
	});

	it("rejects a dynamic category ID that conflicts with a default", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "chips", title: "Duplicate", type: "text" }]),
		});
		await expect(resolveKnowledgeCategory(env, "chips")).rejects.toThrow("conflicts with a default category");
	});

	it("creates a dynamic category in the registry", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "  ریسه   LED ", type: "text" }),
		}, env);
		expect(response.status).toBe(201);
		const { category } = await response.json();
		expect(category).toMatchObject({ title: "ریسه LED", type: "text" });
		expect(category.id).toMatch(/^category-[a-f0-9]{16}$/);
		expect(env.APP_CONFIG.put).toHaveBeenCalledWith("knowledge:categories", expect.any(String));
		expect(env.APP_CONFIG.put).not.toHaveBeenCalledWith(`knowledge:${category.id}`, expect.any(String));
	});

	it("keeps the legacy dynamic category creation request compatible", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Legacy category", type: "text" }),
		}, env);
		expect(response.status).toBe(201);
		const { category } = await response.json();
		expect(category).toMatchObject({ title: "Legacy category", type: "text" });
		expect(category.schemaVersion).toBeUndefined();
		expect(JSON.parse(env._values.get("knowledge:categories"))[0]).toEqual(category);
	});

	it("creates and stores a valid v2 dynamic category", async () => {
		const env = createKnowledgeEnv();
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "V2 category", type: "price_list", schemaVersion: 2,
				status: "out_of_stock", showInSuggestions: true, sortOrder: 12,
			}),
		}, env);
		expect(response.status).toBe(201);
		const { category } = await response.json();
		expect(category).toMatchObject({
			schemaVersion: 2, title: "V2 category", type: "price_list",
			status: "out_of_stock", showInSuggestions: true, sortOrder: 12,
		});
		expect(JSON.parse(env._values.get("knowledge:categories"))[0]).toEqual(category);
	});

	it("rejects invalid v2 category metadata", async () => {
		const invalidMetadata = [
			{ schemaVersion: 1, status: "available", showInSuggestions: false, sortOrder: 0 },
			{ schemaVersion: 2, status: "unknown", showInSuggestions: false, sortOrder: 0 },
			{ schemaVersion: 2, status: "available", showInSuggestions: "false", sortOrder: 0 },
			{ schemaVersion: 2, status: "available", showInSuggestions: false, sortOrder: -1 },
			{ schemaVersion: 2, status: "available", showInSuggestions: false, sortOrder: 1.5 },
		];
		for (const metadata of invalidMetadata) {
			const env = createKnowledgeEnv();
			const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
				method: "POST", headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ title: "Invalid category", type: "text", ...metadata }),
			}, env);
			expect(response.status).toBe(400);
			expect(env.APP_CONFIG.put).not.toHaveBeenCalled();
		}
	});

	it("requires a session to create a dynamic category", async () => {
		const response = await worker.fetch(request("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "ریسه LED", type: "text" }),
		}), createKnowledgeEnv());
		expect(response.status).toBe(401);
	});

	it("rejects an empty dynamic category title", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "   ", type: "text" }),
		});
		expect(response.status).toBe(400);
	});

	it("rejects an overlong dynamic category title", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "a".repeat(121), type: "text" }),
		});
		expect(response.status).toBe(400);
	});

	it("rejects an unsupported dynamic category type", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "ریسه LED", type: "custom_code" }),
		});
		expect(response.status).toBe(400);
	});

	it("rejects a duplicate dynamic category title", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "  ریسه   LED", type: "text" }),
		}, env);
		expect(response.status).toBe(409);
	});

	it("rejects a title that conflicts with a default category", async () => {
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "چیپ", type: "text" }),
		});
		expect(response.status).toBe(409);
	});

	it("recognizes a newly created category immediately", async () => {
		const env = createKnowledgeEnv();
		const created = await authenticatedKnowledgeRequest("/admin/knowledge/categories", {
			method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "ریسه LED", type: "text" }),
		}, env);
		const { category } = await created.response.json();
		const { response } = await authenticatedKnowledgeRequest(`/admin/knowledge/${category.id}`, {}, env);
		expect(response.status).toBe(200);
		expect((await response.json()).category).toMatchObject({
			...category,
			status: "available", showInSuggestions: false, sortOrder: 0,
		});
	});
});
