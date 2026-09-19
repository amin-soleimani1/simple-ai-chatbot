import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi } from "vitest";
import worker from "../src";

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
});
