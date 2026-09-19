const SESSION_DURATION_SECONDS = 2 * 60 * 60;
const SESSION_COOKIE_NAME = "admin_session";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(value) {
	let binary = "";
	for (const byte of value) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
	try {
		const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
		return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
	} catch {
		return null;
	}
}

async function signingKey(secret) {
	return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function sign(value, secret) {
	const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(value));
	return toBase64Url(new Uint8Array(signature));
}

function readCookie(request, name) {
	const cookies = request.headers.get("Cookie") ?? "";
	return cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

export function hasAdminSecrets(env) {
	return typeof env.ADMIN_PIN === "string" && env.ADMIN_PIN.length > 0
		&& typeof env.ADMIN_SESSION_SECRET === "string" && env.ADMIN_SESSION_SECRET.length > 0;
}

export async function pinsMatch(candidate, expected) {
	const [candidateHash, expectedHash] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
		crypto.subtle.digest("SHA-256", encoder.encode(expected)),
	]);
	const candidateBytes = new Uint8Array(candidateHash);
	const expectedBytes = new Uint8Array(expectedHash);
	let difference = 0;
	for (let index = 0; index < candidateBytes.length; index += 1) difference |= candidateBytes[index] ^ expectedBytes[index];
	return difference === 0;
}

export async function createAdminSession(secret) {
	const payload = toBase64Url(encoder.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS })));
	return `${payload}.${await sign(payload, secret)}`;
}

export async function requireAdmin(request, env) {
	const token = readCookie(request, SESSION_COOKIE_NAME);
	if (!token || !hasAdminSecrets(env)) return false;
	const [payload, signature, extra] = token.split(".");
	if (!payload || !signature || extra || !fromBase64Url(signature)) return false;

	const validSignature = await crypto.subtle.verify("HMAC", await signingKey(env.ADMIN_SESSION_SECRET), fromBase64Url(signature), encoder.encode(payload));
	if (!validSignature) return false;

	try {
		const data = JSON.parse(decoder.decode(fromBase64Url(payload)));
		return Number.isInteger(data.exp) && data.exp > Math.floor(Date.now() / 1000);
	} catch {
		return false;
	}
}

function usesLocalCookiePolicy(env) {
	return env?.ADMIN_COOKIE_MODE === "local";
}

function cookiePolicy(env) {
	return usesLocalCookiePolicy(env)
		? "HttpOnly; SameSite=Lax; Path=/"
		: "HttpOnly; Secure; SameSite=None; Path=/";
}

export function sessionCookie(token, env) {
	return `${SESSION_COOKIE_NAME}=${token}; ${cookiePolicy(env)}; Max-Age=${SESSION_DURATION_SECONDS}`;
}

export function expiredSessionCookie(env) {
	return `${SESSION_COOKIE_NAME}=; ${cookiePolicy(env)}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
