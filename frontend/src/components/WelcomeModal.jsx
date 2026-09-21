import { useEffect, useRef, useState } from "react";

export default function WelcomeModal({ onClose }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const buttonRef = useRef(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  function confirm() {
    if (isConfirming) return;
    setIsConfirming(true);
    window.setTimeout(onClose, 180);
  }

  return <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[rgba(6,5,7,0.48)] px-4 backdrop-blur-sm transition-opacity duration-[180ms] ${isConfirming ? "opacity-0" : "opacity-100"}`} role="presentation">
    <section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" className={`relative isolate w-full max-w-sm overflow-hidden rounded-3xl border border-[#d9ad4a]/28 bg-[rgba(10,7,9,0.78)] p-5 text-right shadow-[0_12px_32px_rgba(0,0,0,0.42),0_0_18px_rgba(217,173,74,0.06)] backdrop-blur-md transition-opacity duration-[180ms] sm:p-6 ${isConfirming ? "opacity-0" : "opacity-100"}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(95,39,31,0.2),transparent_48%),radial-gradient(ellipse_at_0%_100%,rgba(177,125,43,0.06),transparent_42%)]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-px -z-10 rounded-[23px] border border-[#f3d98e]/10 shadow-[inset_0_1px_0_rgba(255,238,192,0.15),inset_0_-1px_0_rgba(0,0,0,0.34)]" />
      <p id="welcome-modal-title" className="text-sm leading-7 text-zinc-100 sm:text-base">این دستیار برای دسترسی سریع‌تر به اطلاعات کالاها و قیمت‌های فروشگاه <span className="font-semibold text-[#e3bd62]">کالای روشنایی کیان</span> طراحی شده است.</p>
      <p className="mt-3 text-sm leading-6 text-zinc-400">این یک چت‌بات عمومی نیست.</p>
      <ul className="mt-2 space-y-1.5 p-0 text-sm leading-6 text-zinc-400"><li className="relative before:absolute before:-right-3 before:content-['•']">لطفاً فقط درباره کالاها و خدمات مرتبط با فروشگاه سؤال بپرسید.</li><li className="relative before:absolute before:-right-3 before:content-['•']">سؤال خود را ساده و واضح مطرح کنید.</li></ul>
      <p className="mt-4 border-t border-white/10 pt-3 text-sm text-zinc-300"><span className="font-medium text-[#e3bd62]">مثال:</span> قیمت لامپ ۲۰ وات چنده؟</p>
      <button ref={buttonRef} type="button" onClick={confirm} disabled={isConfirming} className={`relative isolate mt-5 min-h-11 w-full overflow-hidden rounded-xl border border-[#e9c66d]/65 bg-[radial-gradient(circle_at_30%_18%,rgba(255,244,204,0.28),transparent_34%),linear-gradient(145deg,#332517_0%,#171115_55%,#26190f_100%)] px-4 py-2.5 text-sm font-medium text-[#f5d980] shadow-[inset_0_1px_0_rgba(255,242,201,0.42),inset_0_-1px_0_rgba(0,0,0,0.52),inset_0_0_8px_rgba(217,173,74,0.16),0_0_12px_rgba(217,173,74,0.16),0_3px_8px_rgba(0,0,0,0.3)] transition-[transform,border-color,filter,box-shadow] duration-200 hover:border-[#f3d98e]/85 hover:brightness-110 hover:shadow-[inset_0_1px_0_rgba(255,242,201,0.5),inset_0_-1px_0_rgba(0,0,0,0.5),inset_0_0_9px_rgba(217,173,74,0.22),0_0_15px_rgba(217,173,74,0.22),0_3px_8px_rgba(0,0,0,0.3)] active:scale-[.98] before:pointer-events-none before:absolute before:inset-px before:-z-10 before:rounded-[11px] before:border before:border-[#fff0be]/15 before:shadow-[inset_0_1px_0_rgba(255,243,211,0.16)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[#363136] disabled:text-zinc-500 disabled:shadow-none disabled:before:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d477] ${isConfirming ? "opacity-70" : ""}`}><span className="relative">باشه</span></button>
    </section>
  </div>;
}
