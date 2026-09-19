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

  return <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-md transition-opacity duration-[180ms] ${isConfirming ? "opacity-0" : "opacity-100"}`} role="presentation">
    <section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" className={`w-full max-w-sm rounded-3xl border border-white/15 bg-[#211d20]/85 p-5 text-right shadow-2xl shadow-black/45 backdrop-blur-xl transition-opacity duration-[180ms] sm:p-6 ${isConfirming ? "opacity-0" : "opacity-100"}`}>
      <p id="welcome-modal-title" className="text-sm leading-7 text-zinc-100 sm:text-base">این دستیار برای دسترسی سریع‌تر به اطلاعات کالاها و قیمت‌های فروشگاه <span className="font-semibold text-[#e3bd62]">کالای روشنایی کیان</span> طراحی شده است.</p>
      <p className="mt-3 text-sm leading-6 text-zinc-400">این یک چت‌بات عمومی نیست.</p>
      <ul className="mt-2 space-y-1.5 p-0 text-sm leading-6 text-zinc-400"><li className="relative before:absolute before:-right-3 before:content-['•']">لطفاً فقط درباره کالاها و خدمات مرتبط با فروشگاه سؤال بپرسید.</li><li className="relative before:absolute before:-right-3 before:content-['•']">سؤال خود را ساده و واضح مطرح کنید.</li></ul>
      <p className="mt-4 border-t border-white/10 pt-3 text-sm text-zinc-300"><span className="font-medium text-[#e3bd62]">مثال:</span> قیمت لامپ ۲۰ وات چنده؟</p>
      <button ref={buttonRef} type="button" onClick={confirm} disabled={isConfirming} className={`mt-5 min-h-11 w-full rounded-xl border border-[#d9ad4a]/50 bg-[#d9ad4a]/15 px-4 py-2.5 text-sm font-medium text-[#f4d477] transition duration-150 hover:bg-[#d9ad4a]/25 active:bg-[#d9ad4a]/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d477] ${isConfirming ? "opacity-70" : ""}`}>باشه</button>
    </section>
  </div>;
}
