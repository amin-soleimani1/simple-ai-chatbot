import { Code2, Lightbulb, PenLine, Search, Sparkles, WandSparkles } from "lucide-react";

const suggestions = [{ label: "برای یک ایده کمکم کن", icon: Lightbulb }, { label: "یک متن حرفه‌ای بنویس", icon: PenLine }, { label: "یک موضوع را توضیح بده", icon: Search }, { label: "در کدنویسی کمکم کن", icon: Code2 }, { label: "پیشنهاد جدید ۱", icon: Sparkles }, { label: "پیشنهاد جدید ۲", icon: WandSparkles }];
export default function SuggestionButtons({ onSelect, limit = 6 }) {
  return <div className="mx-auto mt-5 grid w-full grid-cols-3 gap-2 sm:mt-6 sm:gap-2.5 lg:mt-7 lg:max-w-4xl">{suggestions.slice(0, limit).map(({ label, icon: Icon }) => <button key={label} onClick={() => onSelect(label)} className="flex h-8 items-center gap-1.5 rounded-[17px] border border-white/10 bg-[#2a1f24] px-2 py-0 text-right text-[9px] text-zinc-200 transition hover:border-white/20 hover:bg-[#35262d] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70 sm:h-9 sm:gap-2 sm:px-2.5 sm:text-[11px]"><Icon size={13} className="shrink-0 text-[#e3bd62] sm:size-[14px]" /><span className="truncate whitespace-nowrap">{label}</span></button>)}</div>;
}
