import { Bot } from "lucide-react";
import PriceTable from "./PriceTable";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  const bubbleClass = `max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[70%] ${isUser ? "rounded-tr-sm bg-[#303030] text-zinc-100" : "rounded-tl-sm bg-emerald-400/12 text-zinc-100"}`;
  const isPriceTable = !isUser && message.presentation?.type === "price_table";
  return <article className={`flex gap-3 ${isUser ? "justify-start" : "justify-end"}`}>{!isUser && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-[#1e1e1e]"><Bot size={17} /></div>}{isPriceTable ? <div className={bubbleClass}><p className="mb-2 font-medium">{message.content}</p><PriceTable presentation={message.presentation} /></div> : <p className={`${bubbleClass} whitespace-pre-wrap`}>{message.content}</p>}</article>;
}
