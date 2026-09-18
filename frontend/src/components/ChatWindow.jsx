import { useEffect, useRef } from "react";
import BrandBanner from "./BrandBanner";
import MessageBubble from "./MessageBubble";
import SuggestionButtons from "./SuggestionButtons";
import StoreInfo from "./StoreInfo";
import WelcomeMessage from "./WelcomeMessage";

export default function ChatWindow({ messages, onSuggestionClick }) {
  const conversationRef = useRef(null);
  const hasUserMessage = messages.some((message) => message.role === "user");

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [messages]);

  return <section className="flex min-h-0 flex-1 flex-col"><div className="mx-auto w-full max-w-4xl shrink-0 px-2 pt-0.5 sm:px-6 sm:pt-1 lg:px-8"><BrandBanner /><StoreInfo /></div><div ref={conversationRef} className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8"><div className={`mx-auto w-full max-w-4xl ${hasUserMessage ? "py-3 sm:py-5 lg:py-6" : "flex min-h-full flex-col justify-center py-3 sm:py-5"}`}>{hasUserMessage ? <div className="space-y-4 sm:space-y-5">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div> : <WelcomeMessage />}</div></div><div className="shrink-0 px-3 pb-1 pt-1 sm:px-6 sm:pb-2 lg:px-8"><SuggestionButtons onSelect={onSuggestionClick} inConversation={hasUserMessage} /></div></section>;
}
