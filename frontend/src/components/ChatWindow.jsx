import { useEffect, useLayoutEffect, useRef } from "react";
import BrandBanner from "./BrandBanner";
import MessageBubble from "./MessageBubble";
import PromoBanner from "./PromoBanner";
import SuggestionButtons from "./SuggestionButtons";
import WelcomeMessage from "./WelcomeMessage";

function LandingScreen({ onSuggestionClick, viewMode, transition, suggestions, suggestionsLoading, suggestionsError }) {
  const rootRef = useRef(null);
  const exiting = viewMode === "transitioning";
  useLayoutEffect(() => {
    if (!exiting || !rootRef.current || !transition?.origin) return undefined;
    const nodes = rootRef.current.querySelectorAll("[data-landing-animation]");
    nodes.forEach((node) => {
      const box = node.getBoundingClientRect();
      const selected = node.dataset.landingAnimation === transition.selectedId;
      const delay = selected ? 145 : Math.min(360, Math.round(Math.hypot(box.left + box.width / 2 - transition.origin.x, box.top + box.height / 2 - transition.origin.y) * .22));
      node.style.setProperty("--landing-exit-delay", `${delay}ms`);
      node.classList.toggle("landing-exit-item--selected", selected);
    });
    return () => nodes.forEach((node) => { node.style.removeProperty("--landing-exit-delay"); node.classList.remove("landing-exit-item--selected"); });
  }, [exiting, transition]);
  return <section ref={rootRef} className={`landing-screen flex min-h-0 flex-1 flex-col ${exiting ? "landing-screen--exiting" : ""}`}><div className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-between gap-1 py-0.5 sm:gap-1.5 sm:py-2 lg:px-8"><div data-landing-animation="banner" className="landing-exit-item"><BrandBanner /></div><div data-landing-animation="welcome" className="landing-exit-item"><WelcomeMessage /></div><div data-landing-animation="suggestions" className="landing-exit-item"><SuggestionButtons onSelect={onSuggestionClick} suggestions={suggestions} loading={suggestionsLoading} error={suggestionsError} /></div><div data-landing-animation="promo" className="landing-exit-item"><PromoBanner /></div></div></div></section>;
}

export default function ChatWindow({ messages, onSuggestionClick, viewMode, transition, suggestions, suggestionsLoading, suggestionsError }) {
  const conversationRef = useRef(null);
  const awaitingAssistantResponse = messages.at(-1)?.role === "user";
  useEffect(() => { if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight; }, [messages]);
  if (viewMode !== "conversation") return <LandingScreen onSuggestionClick={onSuggestionClick} viewMode={viewMode} transition={transition} suggestions={suggestions} suggestionsLoading={suggestionsLoading} suggestionsError={suggestionsError} />;
  return <section className="flex min-h-0 flex-1 flex-col"><div ref={conversationRef} className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-4xl py-3 sm:py-5 lg:py-6"><div className="space-y-4 sm:space-y-5">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{awaitingAssistantResponse && <div className="message-entry message-entry--assistant flex justify-end -ml-2 sm:-ml-3" role="status" aria-label="در حال دریافت پاسخ"><span className="assistant-processing-indicator" /></div>}</div></div></div><div className="shrink-0 overflow-hidden px-3 pb-1 pt-1 sm:px-6 sm:pb-2 lg:px-8"><SuggestionButtons onSelect={onSuggestionClick} suggestions={suggestions} loading={suggestionsLoading} error={suggestionsError} inConversation /></div></section>;
}
