import { useEffect, useRef, useState } from "react";
import AdminAccessModal from "./components/AdminAccessModal";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import Header from "./components/Header";
import InstallApp from "./components/InstallApp";
import OfflineScreen from "./components/OfflineScreen";
import WelcomeModal from "./components/WelcomeModal";
import { authenticateAdmin, getAdminSession, getSuggestions, sendMessage } from "./services/api";
import { readSuggestionsCache, writeSuggestionsCache } from "./services/suggestionsCache";
import { getSuggestionsEpisodeStartAction, getSuggestionsRetryDelay, getSuggestionsSuccessState } from "./services/suggestionsLifecycle";
import AdminPanel from "./admin/AdminPanel";
import { getAdminPath, navigateTo, replaceTo, restoreAdminRoute } from "./admin/adminRoutes";

restoreAdminRoute();

function ChatbotApp() {
  const [messages, setMessages] = useState([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [robotState, setRobotState] = useState("sleeping");
  const hasRobotWokenRef = useRef(false);
  const robotWakeTimerRef = useRef(null);
  const [viewMode, setViewMode] = useState("landing");
  const [landingTransition, setLandingTransition] = useState(null);
  const hasStartedConversationRef = useRef(false);
  const landingTransitionTimerRef = useRef(null);
  const landingBackGuardRef = useRef(false);
  const responsePresentationTimerRef = useRef(null);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [startupSuggestionsCache] = useState(() => readSuggestionsCache());
  const [suggestions, setSuggestions] = useState(() => startupSuggestionsCache?.suggestions ?? []);
  const [suggestionsLoading, setSuggestionsLoading] = useState(() => !startupSuggestionsCache);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const suggestionsResolvedRef = useRef(Boolean(startupSuggestionsCache));
  const suggestionsRequestInFlightRef = useRef(false);
  const suggestionsRefreshRequestedRef = useRef(false);
  const suggestionsRetryTimerRef = useRef(null);
  const suggestionsTimeoutTimerRef = useRef(null);
  const suggestionsAbortControllerRef = useRef(null);
  const suggestionsEpisodeActiveRef = useRef(false);
  const suggestionsAttemptCountRef = useRef(0);
  const lastForegroundRecoveryRef = useRef(0);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [manualInstallOpen, setManualInstallOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(() => window.navigator.onLine);
  const [retryFailed, setRetryFailed] = useState(false);

  useEffect(() => {
    let active = true;
    function clearSuggestionsRetryTimer() {
      window.clearTimeout(suggestionsRetryTimerRef.current);
      suggestionsRetryTimerRef.current = null;
    }
    function clearSuggestionsTimeoutTimer() {
      window.clearTimeout(suggestionsTimeoutTimerRef.current);
      suggestionsTimeoutTimerRef.current = null;
    }
    function stopSuggestionsRequest() {
      clearSuggestionsTimeoutTimer();
      suggestionsAbortControllerRef.current?.abort();
      suggestionsAbortControllerRef.current = null;
      suggestionsRequestInFlightRef.current = false;
    }
    function finishEpisodeWithFailure() {
      suggestionsEpisodeActiveRef.current = false;
      clearSuggestionsRetryTimer();
      if (!suggestionsResolvedRef.current) setSuggestionsError(true);
    }
    function scheduleSuggestionsRetry(delay, runAttempt) {
      clearSuggestionsRetryTimer();
      suggestionsRetryTimerRef.current = window.setTimeout(() => {
        suggestionsRetryTimerRef.current = null;
        runAttempt();
      }, delay);
    }
    function startRefreshEpisode() {
      const startAction = getSuggestionsEpisodeStartAction({
        online: window.navigator.onLine,
        resolved: suggestionsResolvedRef.current,
      });
      if (startAction !== "start") {
        if (startAction === "resolve-unavailable") {
          suggestionsEpisodeActiveRef.current = false;
          setSuggestionsLoading(false);
          setSuggestionsError(true);
        }
        return;
      }
      if (suggestionsRequestInFlightRef.current) {
        suggestionsRefreshRequestedRef.current = true;
        return;
      }
      if (suggestionsEpisodeActiveRef.current) return;
      suggestionsEpisodeActiveRef.current = true;
      suggestionsAttemptCountRef.current = 0;
      runAttempt();
    }
    function runAttempt() {
      if (!active || !window.navigator.onLine || !suggestionsEpisodeActiveRef.current) return;
      if (suggestionsRequestInFlightRef.current) {
        suggestionsRefreshRequestedRef.current = true;
        return;
      }
      suggestionsAttemptCountRef.current += 1;
      suggestionsRequestInFlightRef.current = true;
      if (!suggestionsResolvedRef.current) {
        setSuggestionsLoading(true);
        setSuggestionsError(false);
      }
      const controller = new AbortController();
      let timedOut = false;
      suggestionsAbortControllerRef.current = controller;
      const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 10000);
      suggestionsTimeoutTimerRef.current = timeoutId;
      getSuggestions({ signal: controller.signal }).then((nextSuggestions) => {
        if (!active) return;
        const successState = getSuggestionsSuccessState(nextSuggestions);
        suggestionsResolvedRef.current = successState.resolved;
        suggestionsEpisodeActiveRef.current = false;
        suggestionsRefreshRequestedRef.current = false;
        clearSuggestionsRetryTimer();
        setSuggestions(successState.suggestions);
        setSuggestionsLoading(successState.loading);
        setSuggestionsError(successState.error);
        writeSuggestionsCache(nextSuggestions);
      }).catch(() => {
        if (!active) return;
        if (!window.navigator.onLine && !timedOut) {
          suggestionsEpisodeActiveRef.current = false;
        } else if (window.navigator.onLine) {
          const delay = getSuggestionsRetryDelay(suggestionsAttemptCountRef.current);
          if (delay !== null) scheduleSuggestionsRetry(delay, runAttempt);
          else finishEpisodeWithFailure();
        } else {
          finishEpisodeWithFailure();
        }
      }).finally(() => {
        window.clearTimeout(timeoutId);
        if (suggestionsTimeoutTimerRef.current === timeoutId) suggestionsTimeoutTimerRef.current = null;
        const isCurrentRequest = suggestionsAbortControllerRef.current === controller;
        if (isCurrentRequest) {
          suggestionsAbortControllerRef.current = null;
          suggestionsRequestInFlightRef.current = false;
        }
        if (!active) return;
        if (!suggestionsResolvedRef.current && !suggestionsEpisodeActiveRef.current) setSuggestionsLoading(false);
        if (suggestionsRefreshRequestedRef.current && !suggestionsEpisodeActiveRef.current && window.navigator.onLine) {
          suggestionsRefreshRequestedRef.current = false;
          startRefreshEpisode();
        }
      });
    }
    function handleOnline() {
      setIsOnline(true);
      setRetryFailed(false);
      startRefreshEpisode();
    }
    function handleOffline() {
      setIsOnline(false);
      setRetryFailed(false);
      clearSuggestionsRetryTimer();
      suggestionsEpisodeActiveRef.current = false;
      suggestionsRefreshRequestedRef.current = false;
      stopSuggestionsRequest();
      if (!suggestionsResolvedRef.current) {
        setSuggestionsLoading(false);
        setSuggestionsError(true);
      }
    }
    function handleForegroundRecovery() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastForegroundRecoveryRef.current < 1000) return;
      lastForegroundRecoveryRef.current = now;
      startRefreshEpisode();
    }
    function handlePageShow(event) {
      if (event.persisted) handleForegroundRecovery();
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleForegroundRecovery);
    window.addEventListener("pageshow", handlePageShow);
    if (window.navigator.onLine) handleOnline();
    else handleOffline();
    return () => {
      active = false;
      clearSuggestionsRetryTimer();
      suggestionsEpisodeActiveRef.current = false;
      suggestionsRefreshRequestedRef.current = false;
      stopSuggestionsRequest();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleForegroundRecovery);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  useEffect(() => {
    if (!showAccessDenied) return undefined;
    const timeoutId = window.setTimeout(() => setShowAccessDenied(false), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [showAccessDenied]);

  useEffect(() => () => window.clearTimeout(robotWakeTimerRef.current), []);
  useEffect(() => () => window.clearTimeout(landingTransitionTimerRef.current), []);
  useEffect(() => () => window.clearTimeout(responsePresentationTimerRef.current), []);

  useEffect(() => {
    if (!window.history.state?.chatbotScreen) window.history.replaceState({ chatbotScreen: "landing" }, "", window.location.href);
    const onPopState = (event) => {
      if (event.state?.chatbotScreen === "conversation") { setViewMode("conversation"); return; }
      if (!event.state?.chatbotScreen && !landingBackGuardRef.current) {
        landingBackGuardRef.current = true;
        window.history.pushState({ chatbotScreen: "landing" }, "", window.location.href);
      }
      setViewMode("landing");
      setLandingTransition(null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function handleSend(input, sourceElement, suggestionId) {
    const content = typeof input === "string" ? input : input?.content;
    const presentationRequest = typeof input === "string" ? undefined : input?.presentationRequest;
    const text = typeof content === "string" ? content.trim() : "";

    if (!text || isSendingRef.current) return;

    const isFirstMessage = viewMode === "landing";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const requestStartedAt = performance.now();

    if (isFirstMessage) {
      hasStartedConversationRef.current = true;
      const rect = sourceElement?.getBoundingClientRect?.();
      const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight - 110 };
      const selectedId = suggestionId ? `suggestion-${suggestionId}` : null;
      setLandingTransition({ origin, selectedId });
      setViewMode("transitioning");
      window.history.pushState({ chatbotScreen: "conversation" }, "", window.location.href);
      const transitionDuration = reducedMotion ? 0 : 560;
      landingTransitionTimerRef.current = window.setTimeout(() => setViewMode("conversation"), transitionDuration);
    }

    if (!hasRobotWokenRef.current) {
      hasRobotWokenRef.current = true;
      setRobotState("waking");
      robotWakeTimerRef.current = window.setTimeout(() => setRobotState("awake"), 600);
    }

    const history = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-6)
      .map(({ role, content: previousContent }) => ({ role, content: previousContent }));

    isSendingRef.current = true;
    setIsSending(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);

    try {
      const response = await sendMessage(text, history, presentationRequest);
      const minimumPresentationTime = reducedMotion ? 0 : (isFirstMessage ? 1110 : 320);
      const remainingPresentationTime = Math.max(0, minimumPresentationTime - (performance.now() - requestStartedAt));
      if (remainingPresentationTime) await new Promise((resolve) => {
        responsePresentationTimerRef.current = window.setTimeout(resolve, remainingPresentationTime);
      });
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: response.message, presentation: response.presentation }]);
    } catch {
      const minimumPresentationTime = reducedMotion ? 0 : (isFirstMessage ? 1110 : 320);
      const remainingPresentationTime = Math.max(0, minimumPresentationTime - (performance.now() - requestStartedAt));
      if (remainingPresentationTime) await new Promise((resolve) => {
        responsePresentationTimerRef.current = window.setTimeout(resolve, remainingPresentationTime);
      });
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: "خطایی در ارتباط با سرور رخ داد." }]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }
  function closeAdminAccess() { setAdminAccessOpen(false); }
  function openInstallModal() { setManualInstallOpen(true); }
  function retryConnection() {
    const online = window.navigator.onLine;
    setIsOnline(online);
    setRetryFailed(!online);
  }
  function denyAdminAccess() { setAdminAccessOpen(false); setShowAccessDenied(true); }
  async function grantAdminAccess(pin) {
    const authenticated = await authenticateAdmin(pin);
    if (authenticated) {
      setAdminAccessOpen(false);
      navigateTo("/admin");
    }
    return authenticated;
  }

  return <main dir="rtl" className="chatbot-background flex h-dvh min-h-dvh flex-col overflow-hidden text-zinc-100"><Header onAdminClick={() => setAdminAccessOpen(true)} onInstallClick={openInstallModal} installAvailable={installAvailable} robotState={robotState} isSending={isSending} /><ChatWindow messages={messages} onSuggestionClick={handleSend} viewMode={viewMode} transition={landingTransition} suggestions={suggestions} suggestionsLoading={suggestionsLoading} suggestionsError={suggestionsError} /><ChatInput onSend={handleSend} isSending={isSending} /><InstallApp introductionComplete={!showWelcomeModal} manualOpen={manualInstallOpen} onAvailabilityChange={setInstallAvailable} onManualClose={setManualInstallOpen} />{showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}{showAccessDenied && <div className="fixed inset-x-4 top-4 z-[70] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#3a1722] px-4 py-3 text-center text-sm text-zinc-100 shadow-xl shadow-black/40" role="status">متأسفم، دسترسی برای شما امکان‌پذیر نیست</div>}{adminAccessOpen && <AdminAccessModal onClose={closeAdminAccess} onDenied={denyAdminAccess} onGranted={grantAdminAccess} />}{!isOnline && <OfflineScreen onRetry={retryConnection} retryFailed={retryFailed} />}</main>;
}

function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => getAdminPath(window.location.pathname).startsWith("/admin"));
  const [adminSessionState, setAdminSessionState] = useState(() => (
    getAdminPath(window.location.pathname).startsWith("/admin") ? "checking" : "idle"
  ));
  const isAdminRouteRef = useRef(isAdminRoute);

  useEffect(() => {
    const updateRoute = () => {
      const nextIsAdminRoute = getAdminPath(window.location.pathname).startsWith("/admin");
      if (nextIsAdminRoute && !isAdminRouteRef.current) setAdminSessionState("checking");
      isAdminRouteRef.current = nextIsAdminRoute;
      setIsAdminRoute(nextIsAdminRoute);
    };
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  useEffect(() => {
    if (!isAdminRoute) return undefined;
    let active = true;
    getAdminSession().then((authenticated) => {
      if (!active) return;
      if (authenticated) setAdminSessionState("authenticated");
      else replaceTo("/");
    }).catch(() => { if (active) replaceTo("/"); });
    return () => { active = false; };
  }, [isAdminRoute]);

  if (isAdminRoute && adminSessionState !== "authenticated") return <main className="grid min-h-dvh place-items-center bg-[#210c14] text-sm text-zinc-300" dir="rtl">در حال بررسی دسترسی...</main>;
  return isAdminRoute ? <AdminPanel onLogout={() => replaceTo("/")} /> : <ChatbotApp />;
}

export default App;
