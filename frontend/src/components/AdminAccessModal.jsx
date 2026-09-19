import { useEffect, useRef, useState } from "react";

export default function AdminAccessModal({ onClose, onDenied, onGranted }) {
  const [step, setStep] = useState("confirm");
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef(null);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === "Escape" && !isSubmitting) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isSubmitting, onClose]);

  useEffect(() => {
    if (step === "pin") pinInputRef.current?.focus();
  }, [step]);

  function handlePinChange(event) {
    setPin(event.target.value.replace(/\D/g, "").slice(0, 6));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!pin || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const authenticated = await onGranted(pin);
      if (!authenticated) onDenied();
    } catch {
      onDenied();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onPointerDown={() => { if (!isSubmitting) onClose(); }} role="presentation">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#31121d] p-5 text-right text-zinc-100 shadow-2xl shadow-black/50 sm:p-6" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="admin-access-title" onPointerDown={(event) => event.stopPropagation()}>
        {step === "confirm" ? (
          <>
            <p id="admin-access-title" className="m-0 text-base font-semibold leading-7">این بخش فقط برای مالک دستیار هوشمند قابل دسترس است.</p>
            <p className="mb-0 mt-3 text-sm leading-7 text-zinc-300">آیا شما مالک دستیار هوشمند هستید؟</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setStep("pin")} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#3b1522] transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/70">بله</button>
              <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/40">خیر</button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <label id="admin-access-title" className="block text-base font-semibold leading-7" htmlFor="admin-pin">لطفاً کد دسترسی را وارد کنید</label>
            <input ref={pinInputRef} id="admin-pin" value={pin} onChange={handlePinChange} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" className="mt-5 h-12 w-full rounded-xl border border-white/15 bg-[#240d16] px-4 text-center tracking-[0.4em] text-zinc-100 outline-none transition focus:border-white/45 focus:ring-2 focus:ring-white/15" aria-label="کد دسترسی شش رقمی" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="submit" disabled={!pin || isSubmitting} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#3b1522] transition hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-45">{isSubmitting ? "در حال بررسی..." : "تأیید"}</button>
              <button type="button" disabled={isSubmitting} onClick={onClose} className="min-h-11 rounded-xl border border-white/15 px-4 text-sm font-semibold text-zinc-100 transition hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-45">بی‌خیال</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
