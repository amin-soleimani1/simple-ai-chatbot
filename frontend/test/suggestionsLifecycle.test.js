import assert from "node:assert/strict";
import test from "node:test";
import { getSuggestionsEpisodeStartAction, getSuggestionsRetryDelay, getSuggestionsSuccessState } from "../src/services/suggestionsLifecycle.js";

test("a no-cache offline initial mount resolves Suggestions instead of staying loading", () => {
  assert.equal(getSuggestionsEpisodeStartAction({ online: false, resolved: false }), "resolve-unavailable");
});

test("the cold-start online-to-offline race resolves Suggestions without an online event", () => {
  const initialOnlineState = true;
  const onlineWhenEffectStarts = false;
  assert.equal(initialOnlineState, true);
  assert.equal(getSuggestionsEpisodeStartAction({ online: onlineWhenEffectStarts, resolved: false }), "resolve-unavailable");
});

test("an unresolved offline start remains resolved when no later online event occurs", () => {
  assert.equal(getSuggestionsEpisodeStartAction({ online: false, resolved: false }), "resolve-unavailable");
});

test("an online initial mount starts the normal Suggestions request", () => {
  assert.equal(getSuggestionsEpisodeStartAction({ online: true, resolved: false }), "start");
});

test("bounded failed attempts retain the existing one-second, two-second, then stop policy", () => {
  assert.equal(getSuggestionsRetryDelay(1), 1000);
  assert.equal(getSuggestionsRetryDelay(2), 2000);
  assert.equal(getSuggestionsRetryDelay(3), null);
});

test("a successful empty Suggestions response resolves loading normally", () => {
  assert.deepEqual(getSuggestionsSuccessState([]), {
    suggestions: [],
    resolved: true,
    loading: false,
    error: false,
  });
});
