import { validateRawSearchResult, validateSearchQuery } from "./marketReferenceResearchProvider.js";

const ENDPOINT = "https://google.serper.dev/search";

export class SerperSearchProviderError extends Error {
	constructor(message, status) { super(message); this.name = "SerperSearchProviderError"; this.status = status; }
}
function normalizedUrl(value) {
	if (typeof value !== "string") return null;
	try { const parsed = new URL(value); if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null; parsed.hash = ""; return parsed.href; } catch { return null; }
}

export async function searchWithSerper({ searchQuery, apiKey, fetchImpl = fetch }) {
	const query = validateSearchQuery(searchQuery);
	if (typeof apiKey !== "string" || !apiKey.trim()) throw new SerperSearchProviderError("Serper API key is required.");
	let response;
	try {
		response = await fetchImpl(ENDPOINT, { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ q: query.query, gl: "ir", hl: "fa", num: 10 }) });
	} catch { throw new SerperSearchProviderError("Serper search request failed."); }
	if (!response?.ok) throw new SerperSearchProviderError("Serper search request was rejected.", Number.isInteger(response?.status) ? response.status : undefined);
	let payload;
	try { payload = await response.json(); } catch { throw new SerperSearchProviderError("Serper search response was invalid."); }
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new SerperSearchProviderError("Serper search response was invalid.");
	const urls = new Set();
	const results = (Array.isArray(payload.organic) ? payload.organic : []).flatMap((organic) => {
		const url = normalizedUrl(organic?.link);
		if (!url || urls.has(url)) return [];
		urls.add(url);
		return [{ sourceId: url, url, title: typeof organic.title === "string" ? organic.title : "", snippet: typeof organic.snippet === "string" ? organic.snippet : "" }];
	});
	return validateRawSearchResult({ schemaVersion: 1, queryId: query.queryId, results });
}
