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

  return <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm transition-opacity duration-[180ms] ${isConfirming ? "opacity-0" : "opacity-100"}`} role="presentation">
    <section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="welcome-modal-title" className={`w-full max-w-sm rounded-3xl border border-white/10 bg-[#2d2026] p-5 text-right shadow-2xl shadow-black/35 transition-opacity duration-[180ms] sm:p-6 ${isConfirming ? "opacity-0" : "opacity-100"}`}>
      <p id="welcome-modal-title" className="text-sm leading-7 text-zinc-100 sm:text-base">برای دریافت پاسخ دقیق‌تر، لطفاً سؤال خود را کوتاه و مشخص بنویسید.</p>
      <p className="mt-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-sm text-zinc-400">مثال: لامپ ۱۰۰ وات چند؟</p>
      <button ref={buttonRef} type="button" onClick={confirm} disabled={isConfirming} className={`mt-5 min-h-11 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-[#21180d] transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4d477] ${isConfirming ? "bg-[#f4d477] shadow-[0_0_18px_rgba(244,212,119,0.65)]" : "bg-[#d9ad4a] hover:bg-[#e3bd62] active:bg-[#f4d477] active:shadow-[0_0_18px_rgba(244,212,119,0.65)]"}`}>باشه</button>
    </section>
  </div>;
}
