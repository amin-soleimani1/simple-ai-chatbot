import { useEffect, useRef } from "react";
import BrandBanner from "./BrandBanner";
import MessageBubble from "./MessageBubble";
import PromoBanner from "./PromoBanner";
import SuggestionButtons from "./SuggestionButtons";
import WelcomeMessage from "./WelcomeMessage";

export default function ChatWindow({ messages, onSuggestionClick, viewMode }) {
  const conversationRef = useRef(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  if (viewMode !== "conversation") {
    const isTransitioning = viewMode === "transitioning";
    const exitClass = "transition-[opacity,transform] duration-300 ease-out motion-reduce:delay-0 motion-reduce:transition-none";
    return <section className="flex min-h-0 flex-1 flex-col"><div ref={conversationRef} className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5 py-1.5 sm:gap-2 sm:py-3 lg:px-8"><div className={`${exitClass} delay-0 ${isTransitioning ? "-translate-y-2 scale-[.99] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}><BrandBanner /></div><div className={`${exitClass} delay-100 ${isTransitioning ? "-translate-y-2 scale-[.99] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}><WelcomeMessage /></div><div className={`${exitClass} delay-200 ${isTransitioning ? "-translate-y-2 scale-[.99] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}><SuggestionButtons onSelect={onSuggestionClick} inConversation={false} /></div><div className={`${exitClass} delay-300 ${isTransitioning ? "-translate-y-2 scale-[.99] opacity-0" : "translate-y-0 scale-100 opacity-100"}`}><PromoBanner /></div></div></div></section>;
  }

  return <section className="flex min-h-0 flex-1 flex-col"><div ref={conversationRef} className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-4xl py-3 sm:py-5 lg:py-6"><div className="space-y-4 sm:space-y-5">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div></div></div><div className="shrink-0 overflow-hidden px-3 pb-1 pt-1 sm:px-6 sm:pb-2 lg:px-8"><SuggestionButtons onSelect={onSuggestionClick} inConversation /></div></section>;
}
