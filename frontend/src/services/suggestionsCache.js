const CACHE_KEY = "chatbot:suggestions";
const SCHEMA_VERSION = 1;
export const SUGGESTIONS_FRESHNESS_TTL_MS = 24 * 60 * 60 * 1000;
export const SUGGESTIONS_FALLBACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const SUGGESTION_TYPES = new Set(["price_list", "per_watt_price", "text"]);
const SUGGESTION_STATUSES = new Set(["available", "out_of_stock", "not_sold"]);

function isValidSuggestions(suggestions) {
  return Array.isArray(suggestions) && suggestions.every((suggestion) => (
    typeof suggestion?.id === "string" && suggestion.id.trim()
    && typeof suggestion.title === "string" && suggestion.title.trim()
    && SUGGESTION_TYPES.has(suggestion.type)
    && SUGGESTION_STATUSES.has(suggestion.status)
    && Number.isSafeInteger(suggestion.sortOrder) && suggestion.sortOrder >= 0
  ));
}

function removeCache() {
  try { window.localStorage.removeItem(CACHE_KEY); } catch { /* Storage may be unavailable. */ }
}

export function readSuggestionsCache() {
  let record;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    record = JSON.parse(raw);
  } catch {
    removeCache();
    return null;
  }

  const savedAtMs = Date.parse(record?.savedAt);
  const ageMs = Date.now() - savedAtMs;
  if (
    record?.schemaVersion !== SCHEMA_VERSION
    || !Number.isFinite(savedAtMs)
    || ageMs < 0
    || ageMs > SUGGESTIONS_FALLBACK_TTL_MS
    || !isValidSuggestions(record.suggestions)
  ) {
    removeCache();
    return null;
  }

  return {
    suggestions: record.suggestions,
    savedAt: record.savedAt,
    isFresh: ageMs <= SUGGESTIONS_FRESHNESS_TTL_MS,
  };
}

export function writeSuggestionsCache(suggestions) {
  if (!isValidSuggestions(suggestions)) return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      suggestions,
    }));
  } catch { /* A storage quota/privacy failure must not affect live Suggestions. */ }
}
