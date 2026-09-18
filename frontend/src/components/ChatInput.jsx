import { ArrowUp } from "lucide-react";
import { useState } from "react";

export default function ChatInput({ onSend }) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  function submit(event) { event.preventDefault(); if (value.trim()) { setIsSending(true); onSend(value); setValue(""); window.setTimeout(() => setIsSending(false), 180); } }
  function handleKeyDown(event) { if (event.key === "Enter" && !event.shiftKey) submit(event); }
  return <footer className="shrink-0 px-3 pb-3 pt-2 sm:px-5 sm:pb-5 lg:px-8 lg:pb-6 lg:pt-4"><form onSubmit={submit} className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-[22px] border border-white/10 bg-[#2d2026] p-2 shadow-2xl shadow-black/30 focus-within:border-white/20 sm:gap-3 sm:p-2.5 lg:rounded-[34px] lg:p-3"><textarea value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={handleKeyDown} rows={1} placeholder="پیام خود را بنویسید..." aria-label="پیام شما" className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 sm:min-h-11 sm:py-2.5 lg:min-h-12 lg:px-4 lg:text-base" /><button type="submit" disabled={!value.trim()} aria-label="ارسال پیام" className={`grid size-9 shrink-0 place-items-center rounded-[17px] text-[#21180d] transition duration-150 sm:size-10 lg:size-11 lg:rounded-[22px] ${isSending ? "bg-[#f4d477] shadow-[0_0_18px_rgba(244,212,119,0.65)]" : "bg-[#d9ad4a] hover:bg-[#e3bd62] active:bg-[#f4d477] active:shadow-[0_0_18px_rgba(244,212,119,0.65)] disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-400"}`}><ArrowUp size={18} className="lg:size-5" /></button></form><p className="mt-2.5 text-center text-xs text-zinc-500 sm:mt-3">ممکن است پاسخ‌ها دقیق نباشند؛ اطلاعات مهم را بررسی کنید.</p></footer>;
}
