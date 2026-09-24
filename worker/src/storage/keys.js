export const STORAGE_KEYS = Object.freeze({
	STORE_CONFIG: "config:store",
	AI_CONFIG: "config:ai",
	APPEARANCE_CONFIG: "config:appearance",
	SUGGESTIONS_CONFIG: "config:suggestions",
	KNOWLEDGE_CATEGORIES: "knowledge:categories",
});

export function knowledgeCategoryKey(categoryId) {
	return `knowledge:${categoryId}`;
}
