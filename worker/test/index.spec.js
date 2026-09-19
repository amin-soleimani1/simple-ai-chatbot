import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src";
import { getKnowledgeCategory, parseKnowledge, resolveKnowledgeCategory } from "../src/knowledge/knowledgeService.js";

const authEnv = {
	ADMIN_PIN: "123456",
	ADMIN_SESSION_SECRET: "test-only-session-signing-secret",
	ADMIN_AUTH_RATE_LIMIT: { limit: vi.fn().mockResolvedValue({ success: true }) },
};

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
	});

	it("keeps the existing GET /chat method guard", async () => {
		const response = await worker.fetch(request("/chat"), authEnv);
		expect(response.status).toBe(405);
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
		expect(await resolveKnowledgeCategory(env, "led-strips")).toEqual({ id: "led-strips", title: "ریسه LED", type: "text" });
	});

	it("gets a dynamic category", async () => {
		const env = createKnowledgeEnv({
			"knowledge:categories": JSON.stringify([{ id: "led-strips", title: "ریسه LED", type: "text" }]),
		});
		const { response } = await authenticatedKnowledgeRequest("/admin/knowledge/led-strips", {}, env);
		expect(response.status).toBe(200);
		expect((await response.json()).category).toEqual({ id: "led-strips", title: "ریسه LED", type: "text" });
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
		expect((await response.json()).category).toEqual(category);
	});
});
