import { Check, Copy, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const contactName = "آقای فرهادی";
const phoneNumber = "09374267189";

function FilledUserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[19px] fill-current"><path d="M12 2.75a4.75 4.75 0 1 0 0 9.5 4.75 4.75 0 0 0 0-9.5ZM12 14.25c-5.1 0-8.25 2.95-8.25 6.25 0 .41.34.75.75.75h15a.75.75 0 0 0 .75-.75c0-3.3-3.15-6.25-8.25-6.25Z" /></svg>;
}

export default function Header({ onAdminClick }) {
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const contactRef = useRef(null);
  useEffect(() => {
    if (!isContactOpen) return undefined;
    function closeOnOutsideClick(event) { if (!contactRef.current?.contains(event.target)) setIsContactOpen(false); }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [isContactOpen]);
  async function copyPhoneNumber() {
    try { await navigator.clipboard.writeText(phoneNumber); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }
  return <header className="relative flex h-11 shrink-0 items-center justify-between border-b border-white/7 px-3 sm:h-12 sm:px-6"><div ref={contactRef} className="relative"><button type="button" aria-label="تماس با ما" aria-expanded={isContactOpen} onClick={() => setIsContactOpen((open) => !open)} className="rounded-lg p-2 text-[#e3bd62] transition hover:bg-white/10 hover:text-[#f4d477] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70"><Phone size={20} /></button>{isContactOpen && <div className="absolute right-0 top-[calc(100%+0.4rem)] z-50 w-48 rounded-xl border border-[#d9ad4a]/30 bg-[#241a1f] p-3 text-right shadow-xl shadow-black/40"><p className="text-xs font-semibold text-zinc-100">تماس با ما</p><p className="mt-2 text-sm text-zinc-300">{contactName}</p><div className="mt-1 flex items-center justify-between gap-2" dir="ltr"><span className="text-sm text-zinc-300">{phoneNumber}</span><button type="button" onClick={copyPhoneNumber} aria-label="کپی شماره تماس" className="grid size-6 place-items-center rounded-md text-[#e3bd62] transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70">{copied ? <Check size={15} /> : <Copy size={14} />}</button></div></div>}</div><span className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-semibold text-zinc-100">دستیار هوشمند</span><button type="button" aria-label="ورود به پنل مدیریت" onClick={onAdminClick} className="rounded-lg p-2 text-[#e3bd62] transition hover:bg-white/10 hover:text-[#f4d477]"><FilledUserIcon /></button></header>;
}
