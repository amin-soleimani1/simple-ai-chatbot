import { WifiOff } from "lucide-react";
import { useEffect, useRef } from "react";

export default function OfflineScreen({ onRetry, retryFailed }) {
  const retryButtonRef = useRef(null);

  useEffect(() => { retryButtonRef.current?.focus(); }, []);

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#090709]/95 px-5 backdrop-blur-sm" role="presentation"><section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="offline-screen-title" aria-describedby="offline-screen-description" className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#d9ad4a]/30 bg-[#151115] p-6 text-center shadow-[0_16px_40px_rgba(0,0,0,0.52),0_0_22px_rgba(217,173,74,0.08)]"><span aria-hidden="true" className="pointer-events-none absolute inset-px rounded-[15px] border border-[#f3d98e]/10 shadow-[inset_0_1px_0_rgba(255,238,192,0.14)]" /><div className="relative mx-auto grid size-12 place-items-center rounded-full border border-[#d9ad4a]/30 bg-[#d9ad4a]/[0.06] text-[#e3bd62]"><WifiOff size={23} strokeWidth={1.7} /></div><h1 id="offline-screen-title" className="relative mt-4 text-base font-semibold text-[#f5df9f]">اتصال اینترنت برقرار نیست</h1><p id="offline-screen-description" className="relative mt-2 text-sm leading-6 text-zinc-300">برای استفاده از دستیار هوشمند لطفاً اتصال اینترنت خود را بررسی کنید.</p>{retryFailed && <p className="relative mt-3 text-xs text-zinc-400" role="status">هنوز اتصال اینترنت برقرار نشده است.</p>}<button ref={retryButtonRef} type="button" onClick={onRetry} className="relative mt-5 w-full rounded-xl border border-[#e9c66d]/60 bg-[#332517] px-4 py-2.5 text-sm font-medium text-[#f5d980] shadow-[inset_0_1px_0_rgba(255,242,201,0.24),0_3px_8px_rgba(0,0,0,0.24)] transition hover:border-[#f3d98e]/85 hover:bg-[#3b2b19] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">تلاش مجدد</button></section></div>;
}
