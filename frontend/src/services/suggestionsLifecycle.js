const MAX_SUGGESTIONS_ATTEMPTS = 3;

export function getSuggestionsEpisodeStartAction({ online, resolved }) {
  if (online) return "start";
  return resolved ? "idle" : "resolve-unavailable";
}

export function getSuggestionsRetryDelay(attemptCount) {
  if (attemptCount >= MAX_SUGGESTIONS_ATTEMPTS) return null;
  return 1000 * (2 ** (attemptCount - 1));
}

export function getSuggestionsSuccessState(suggestions) {
  return {
    suggestions,
    resolved: true,
    loading: false,
    error: false,
  };
}
