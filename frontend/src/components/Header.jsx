import { Menu, MessageSquarePlus } from "lucide-react";

export default function Header() {
  return <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/7 px-4 sm:px-6"><button aria-label="باز کردن منو" className="rounded-lg p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"><Menu size={22} /></button><div className="flex items-center gap-3"><span className="text-sm font-semibold text-zinc-100">دستیار هوشمند</span><button aria-label="گفت‌وگوی جدید" className="rounded-lg p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"><MessageSquarePlus size={20} /></button></div></header>;
}
