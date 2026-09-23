import { useCallback, useEffect, useRef, useState } from "react";

const DISMISSAL_KEY = "kian-pwa-install-dismissed-until";
const DISMISSAL_DURATION = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent)
    || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function isDismissed() {
  try { return Number(window.localStorage.getItem(DISMISSAL_KEY)) > Date.now(); } catch { return false; }
}

export default function InstallApp({ introductionComplete, manualOpen, onAvailabilityChange, onManualClose }) {
  const deferredPromptRef = useRef(null);
  const installButtonRef = useRef(null);
  const notNowButtonRef = useRef(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(isDismissed);
  const [showModal, setShowModal] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const iosFallbackAvailable = !installed && isIOS();
  const installPathAvailable = !installed && (canInstall || iosFallbackAvailable);
  const canAutoShow = introductionComplete && !dismissed && installPathAvailable;

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      if (isStandalone()) return;
      deferredPromptRef.current = event;
      setCanInstall(true);
    }
    function handleAppInstalled() {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setShowIOSGuide(false);
      setShowModal(false);
      setInstalled(true);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => { onAvailabilityChange(installPathAvailable); }, [installPathAvailable, onAvailabilityChange]);

  useEffect(() => {
    if (!canAutoShow) return undefined;
    const timeoutId = window.setTimeout(() => setShowModal(true), 500);
    return () => window.clearTimeout(timeoutId);
  }, [canAutoShow]);

  const isModalOpen = showModal || (manualOpen && installPathAvailable);

  const dismiss = useCallback(() => {
    const dismissedUntil = Date.now() + DISMISSAL_DURATION;
    try { window.localStorage.setItem(DISMISSAL_KEY, String(dismissedUntil)); } catch { /* The modal can still close for this session. */ }
    setDismissed(true);
    setShowModal(false);
    setShowIOSGuide(false);
    onManualClose(false);
  }, [onManualClose]);

  useEffect(() => {
    if (!isModalOpen) return undefined;
    installButtonRef.current?.focus();
    function handleKeyDown(event) {
      if (event.key === "Escape") dismiss();
      if (event.key !== "Tab") return;
      if (event.shiftKey && document.activeElement === installButtonRef.current) {
        event.preventDefault();
        notNowButtonRef.current?.focus();
      } else if (!event.shiftKey && document.activeElement === notNowButtonRef.current) {
        event.preventDefault();
        installButtonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismiss, isModalOpen]);

  async function handleInstall() {
    const deferredPrompt = deferredPromptRef.current;
    if (!deferredPrompt) {
      setShowIOSGuide(true);
      return;
    }
    const { outcome } = await deferredPrompt.prompt();
    deferredPromptRef.current = null;
    setCanInstall(false);
    setShowModal(false);
    onManualClose(false);
    if (outcome === "accepted") setInstalled(true);
  }

  if (!isModalOpen) return null;

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]" role="presentation"><section dir="rtl" role="dialog" aria-modal="true" aria-labelledby="install-modal-title" aria-describedby="install-modal-description" className="relative w-full max-w-sm rounded-2xl border border-[#d9ad4a]/35 bg-[#151115] p-5 text-right shadow-[0_16px_40px_rgba(0,0,0,0.5),0_0_22px_rgba(217,173,74,0.08)] sm:p-6"><span aria-hidden="true" className="pointer-events-none absolute inset-px rounded-[15px] border border-[#f3d98e]/10 shadow-[inset_0_1px_0_rgba(255,238,192,0.14)]" /><h2 id="install-modal-title" className="relative text-base font-semibold text-[#f5df9f]">دسترسی راحت‌تر به دستیار کیان</h2><p id="install-modal-description" className="relative mt-2 text-sm leading-6 text-zinc-300">برای دسترسی راحت‌تر و همیشگی به این دستیار، آن را روی دستگاه خود نصب کنید.</p>{showIOSGuide && <p className="relative mt-3 rounded-lg border border-[#d9ad4a]/20 bg-black/15 px-3 py-2 text-xs leading-5 text-zinc-300" role="status">از Share مرورگر، گزینهٔ Add to Home Screen را انتخاب کنید.</p>}<div className="relative mt-5 flex w-full gap-2" dir="rtl"><button ref={installButtonRef} type="button" onClick={handleInstall} className="flex-1 rounded-lg border border-[#e9c66d]/60 bg-[#332517] px-4 py-2 text-sm font-medium text-[#f5d980] shadow-[inset_0_1px_0_rgba(255,242,201,0.24),0_3px_8px_rgba(0,0,0,0.24)] transition hover:border-[#f3d98e]/85 hover:bg-[#3b2b19] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">نصب</button><button ref={notNowButtonRef} type="button" onClick={dismiss} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">فعلاً نه</button></div></section></div>;
}
