import { getJson, putJson } from "../storage/configStore.js";
import { buildMarketReferenceKey, validateMarketReference } from "./marketReferenceService.js";
import { DEFAULT_MARKET_REFERENCE_BOOTSTRAP, validateDefaultMarketReferenceBootstrap } from "./defaultMarketReferenceBootstrap.js";
import { seedDefaultMarketReferenceTargets } from "./marketReferenceTargetsService.js";

function assertBinding(env) {
	if (!env?.APP_CONFIG || typeof env.APP_CONFIG.get !== "function" || typeof env.APP_CONFIG.put !== "function") throw new Error("APP_CONFIG KV binding is not available.");
}

/** Seeds only missing frozen bootstrap datasets after validating the full collection. */
export async function seedDefaultMarketReferenceBootstrapDatasets(env) {
	assertBinding(env);
	const bootstrap = validateDefaultMarketReferenceBootstrap();
	const validated = bootstrap.map((dataset) => validateMarketReference(dataset));
	const created = []; const skipped = [];
	for (const dataset of validated) {
		const key = buildMarketReferenceKey(dataset.categoryId);
		const existing = await getJson(env, key);
		if (existing !== null) { validateMarketReference(existing); skipped.push(dataset.categoryId); continue; }
		await putJson(env, key, dataset);
		created.push(dataset.categoryId);
	}
	return { created, skipped };
}

/** Explicit, idempotent initialization; it never seeds the catalog or publishes data. */
export async function initializeMarketReferenceBootstrap(env) {
	assertBinding(env);
	return {
		targets: await seedDefaultMarketReferenceTargets(env),
		datasets: await seedDefaultMarketReferenceBootstrapDatasets(env),
	};
}
