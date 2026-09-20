import { Menu } from "lucide-react";
import RobotAvatar from "./RobotAvatar";

export default function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d9ad4a]/20 bg-[#171216] px-3 sm:h-[60px] sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3" dir="rtl">
        <RobotAvatar />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">دستیار هوشمند کیان</p>
          <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] text-zinc-400">
            <span className="robot-status-dot" aria-hidden="true" />
            آخرین بازدید به تازگی
          </p>
        </div>
      </div>
      <button type="button" aria-label="منو" className="grid size-10 shrink-0 place-items-center rounded-lg text-[#e3bd62] transition hover:bg-white/10 hover:text-[#f4d477] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">
        <Menu size={21} strokeWidth={1.8} />
      </button>
    </header>
  );
}
