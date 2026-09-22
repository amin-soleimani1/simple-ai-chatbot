export const STORAGE_KEYS = Object.freeze({
	STORE_CONFIG: "config:store",
	AI_CONFIG: "config:ai",
	APPEARANCE_CONFIG: "config:appearance",
	SUGGESTIONS_CONFIG: "config:suggestions",
	KNOWLEDGE_CATEGORIES: "knowledge:categories",
	MARKET_REFERENCE_CATALOG: "market-reference:catalog",
});

export function knowledgeCategoryKey(categoryId) {
	return `knowledge:${categoryId}`;
}

export function marketReferenceKey(categoryId) {
	return `market-reference:${categoryId}`;
}

export function marketReferenceTargetsKey(categoryId) {
	return `market-reference:targets:${categoryId}`;
}
