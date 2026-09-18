import { Bot } from "lucide-react";

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return <article className={`flex gap-3 ${isUser ? "justify-start" : "justify-end"}`}>{!isUser && <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-[#1e1e1e]"><Bot size={17} /></div>}<p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[70%] ${isUser ? "rounded-tr-sm bg-[#303030] text-zinc-100" : "rounded-tl-sm bg-emerald-400/12 text-zinc-100"}`}>{message.content}</p></article>;
}
