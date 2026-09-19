function getNamespace(env) {
	if (!env?.APP_CONFIG) {
		throw new Error("APP_CONFIG KV binding is not available.");
	}

	return env.APP_CONFIG;
}

export async function getJson(env, key) {
	const value = await getNamespace(env).get(key);

	if (value === null) {
		return null;
	}

	try {
		return JSON.parse(value);
	} catch (error) {
		throw new Error(`Invalid JSON stored for key: ${key}`, { cause: error });
	}
}

export async function putJson(env, key, value) {
	const serializedValue = JSON.stringify(value);

	if (serializedValue === undefined) {
		throw new TypeError(`Value for key ${key} cannot be serialized as JSON.`);
	}

	await getNamespace(env).put(key, serializedValue);
}

export async function deleteKey(env, key) {
	await getNamespace(env).delete(key);
}
