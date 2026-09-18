import BrandBanner from "./BrandBanner";
import MessageBubble from "./MessageBubble";
import SuggestionButtons from "./SuggestionButtons";
import WelcomeMessage from "./WelcomeMessage";

export default function ChatWindow({ messages, onSuggestionClick }) {
  const hasUserMessage = messages.some((message) => message.role === "user");
  return <section className="flex-1 overflow-y-auto"><div className={`mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 ${hasUserMessage ? "py-7 sm:py-8 lg:py-10" : "flex min-h-full flex-col justify-end pb-3 pt-8 sm:pb-5 sm:pt-10 lg:pb-6 lg:pt-8"}`}><div className={hasUserMessage ? "-mb-[6px]" : ""}><BrandBanner /></div>{hasUserMessage ? <><div className="space-y-6">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}</div><SuggestionButtons onSelect={onSuggestionClick} limit={3} /></> : <><WelcomeMessage /><SuggestionButtons onSelect={onSuggestionClick} /></>}</div></section>;
}
