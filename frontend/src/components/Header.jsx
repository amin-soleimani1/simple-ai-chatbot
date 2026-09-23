import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import RobotAvatar from "./RobotAvatar";
import StoreDrawer from "./StoreDrawer";

export default function Header({ onAdminClick, onInstallClick, installAvailable, robotState, isSending }) {
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const installAttentionTimerRef = useRef(null);
  const hasShownInstallAttentionRef = useRef(false);
  const [showInstallAttention, setShowInstallAttention] = useState(false);

  useEffect(() => () => window.clearTimeout(installAttentionTimerRef.current), []);

  useEffect(() => {
    if (!isDrawerMounted) return undefined;
    const animationFrame = window.requestAnimationFrame(() => setIsDrawerOpen(true));
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isDrawerMounted]);

  useEffect(() => {
    if (!isDrawerOpen) return undefined;
    function closeOnEscape(event) { if (event.key === "Escape") setIsDrawerOpen(false); }
    document.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDrawerOpen]);

  function openDrawer() {
    setIsDrawerMounted(true);
    if (installAvailable && !hasShownInstallAttentionRef.current) {
      hasShownInstallAttentionRef.current = true;
      setShowInstallAttention(true);
      installAttentionTimerRef.current = window.setTimeout(() => setShowInstallAttention(false), 1500);
    }
  }
  function closeDrawer() { setIsDrawerOpen(false); setShowInstallAttention(false); }
  function handleDrawerExited() {
    setIsDrawerMounted(false);
    menuButtonRef.current?.focus();
  }
  function openAdminAccess() {
    closeDrawer();
    onAdminClick();
  }
  function openInstallModal() {
    closeDrawer();
    window.setTimeout(onInstallClick, 240);
  }
  const isSleeping = robotState === "sleeping";
  const statusText = isSleeping ? "آخرین بازدید به تازگی" : robotState === "waking" || !isSending ? "آنلاین" : "در حال نوشتن ...";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#d9ad4a]/20 bg-[linear-gradient(135deg,#0e0a0d_0%,#0a080a_65%,#100a0d_100%)] px-3 sm:h-[60px] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3" dir="rtl">
          <RobotAvatar state={robotState} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight text-zinc-100">دستیار هوشمند کیان</p>
            <p className="mt-1 flex items-center gap-1 whitespace-nowrap text-[10px] text-zinc-400">
              <span className={`robot-status-dot${isSleeping ? "" : " robot-status-dot--online"}`} aria-hidden="true" />
              {statusText}
            </p>
          </div>
        </div>
        <button ref={menuButtonRef} type="button" onClick={openDrawer} aria-label="باز کردن منو" aria-expanded={isDrawerOpen} aria-controls="store-information-drawer" className="grid size-10 shrink-0 place-items-center rounded-lg text-[#e3bd62] transition hover:bg-white/10 hover:text-[#f4d477] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">
          <Menu size={30} strokeWidth={1.9} />
        </button>
      </header>
      {isDrawerMounted && <StoreDrawer isOpen={isDrawerOpen} onClose={closeDrawer} onExited={handleDrawerExited} onAdminClick={openAdminAccess} onInstallClick={openInstallModal} installAvailable={installAvailable} showInstallAttention={showInstallAttention} closeButtonRef={closeButtonRef} />}
    </>
  );
}
