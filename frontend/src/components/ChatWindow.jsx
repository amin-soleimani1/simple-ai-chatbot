import { useEffect, useRef } from "react";
import BrandBanner from "./BrandBanner";
import MessageBubble from "./MessageBubble";
import PromoBanner from "./PromoBanner";
import SuggestionButtons from "./SuggestionButtons";
import WelcomeMessage from "./WelcomeMessage";

export default function ChatWindow({ messages, onSuggestionClick }) {
  const conversationRef = useRef(null);
  const hasUserMessage = messages.some((message) => message.role === "user");

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  if (!hasUserMessage) {
    return <section className="flex min-h-0 flex-1 flex-col"><div ref={conversationRef} className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-4xl flex-col gap-1.5 py-1.5 sm:gap-2 sm:py-3 lg:px-8"><BrandBanner /><WelcomeMessage /><SuggestionButtons onSelect={onSuggestionClick} inConversation={false} /><PromoBanner /></div></div></section>;
  }

  return <section className="flex min-h-0 flex-1 flex-col"><div className="mx-auto w-full max-w-4xl shrink-0 px-2 pt-0.5 sm:px-6 sm:pt-1 lg:px-8"><BrandBanner /></div><div ref={conversationRef} className="conversation-scroll min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className="mx-auto w-full max-w-4xl py-3 sm:py-5 lg:py-6"><div className="space-y-4 sm:space-y-5">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div></div></div><div className="shrink-0 space-y-2 px-3 pb-1 pt-1 sm:px-6 sm:pb-2 lg:px-8"><SuggestionButtons onSelect={onSuggestionClick} inConversation /></div></section>;
}
