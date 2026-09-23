import PriceTable from "./PriceTable";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const bubbleClass = `max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[70%] ${isUser ? "rounded-tr-sm bg-[#303030] text-zinc-100" : "px-1 py-0 text-zinc-200"}`;
  const isPriceTable = !isUser && message.presentation?.type === "price_table";
  return <article className={`message-entry message-entry--${isUser ? "user" : "assistant"} flex ${isUser ? "justify-start" : "justify-end -ml-2 sm:-ml-3"}`}>{isPriceTable ? <div className={`${bubbleClass} ${!isUser ? "assistant-response-reveal" : ""}`}><p className="mb-2 font-medium">{message.content}</p><PriceTable presentation={message.presentation} /></div> : <p className={`${bubbleClass} ${!isUser ? "assistant-response-reveal" : ""} whitespace-pre-wrap`}>{message.content}</p>}</article>;
}
