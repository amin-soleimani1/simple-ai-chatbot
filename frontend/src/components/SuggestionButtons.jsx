import { Cpu, LampDesk, Lightbulb, PanelTop, Projector, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const priceListRequest = (categoryId) => ({ type: "price_table", categoryId });
const suggestionPresentation = Object.freeze({
  "economy-bulbs": { label: "لامپ‌های اقتصادی", icon: LampDesk },
  "iranian-bulbs-warranty": { label: "لامپ‌های با گارانتی", icon: LampDesk },
  projectors: { label: "پروژکتور", icon: Projector },
  repairs: { label: "تعمیرات", icon: Wrench },
  chips: { label: "قیمت چیپ", icon: Cpu },
  "ceiling-panels": { label: "پنل سقفی", icon: PanelTop },
});
let hasCenteredConversationRail = false;
let hasShownLandingScrollHint = false;
let hasShownConversationDiscoveryHint = false;
function Suggestion({ id, label, icon: Icon, type, onSelect, landing = false, conversation = false }) {
	const selectSuggestion = (event) => onSelect(type === "price_list" ? { content: label, presentationRequest: priceListRequest(id) } : label, event.currentTarget, id);
	if (landing) return <button type="button" data-landing-animation={`suggestion-${id}`} onClick={selectSuggestion} className="relative isolate flex h-20 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-[#d9ad4a]/45 bg-[#161215] px-1.5 py-1.5 text-center text-[11px] font-medium leading-4 text-zinc-100 shadow-[0_0_0_1px_rgba(238,198,103,0.06),0_5px_14px_rgba(0,0,0,0.3),0_0_12px_rgba(217,173,74,0.07)] transition hover:border-[#d9ad4a]/55 hover:bg-[#1d1518] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70 sm:h-24 sm:text-xs"><span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(105,48,35,0.3),transparent_62%),radial-gradient(ellipse_at_100%_100%,rgba(98,64,27,0.15),transparent_50%)]" /><span aria-hidden="true" className="pointer-events-none absolute inset-px rounded-[15px] border border-[#f3d98e]/12 shadow-[inset_0_1px_0_rgba(255,238,192,0.18),inset_0_-1px_0_rgba(141,88,31,0.24),inset_0_0_12px_rgba(217,173,74,0.05)]" /><span aria-hidden="true" className="pointer-events-none absolute -top-4 left-1/2 h-8 w-16 -translate-x-1/2 rounded-full bg-[#e3bd62]/10 blur-xl" /><Icon size={22} strokeWidth={1.7} className="relative shrink-0 text-[#edcf78] drop-shadow-[0_1px_3px_rgba(227,189,98,0.32)]" /><span className="relative">{label}</span></button>;
  if (conversation) return <button type="button" onClick={selectSuggestion} className="shrink-0 whitespace-nowrap rounded-full border border-[#d9ad4a]/28 bg-[#d9ad4a]/[0.04] px-3 py-1.5 text-xs text-[#e7c66e] transition hover:border-[#d9ad4a]/50 hover:bg-[#d9ad4a]/10 focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/60">{label}</button>;
  return <button type="button" onClick={selectSuggestion} className="flex min-w-0 items-center justify-center gap-1 rounded-[14px] border border-white/15 bg-[#171216] px-1.5 py-1.5 text-center text-[10px] leading-4 text-zinc-200 transition hover:border-[#d9ad4a]/40 hover:bg-[#35262d] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70 sm:px-2 sm:text-xs"><Icon size={13} className="shrink-0 text-[#e3bd62]" /><span>{label}</span></button>;
}

function ConversationRail({ onSelect, suggestions }) {
  const railRef = useRef(null);
  const [discoveryPhase, setDiscoveryPhase] = useState("idle");

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    let centerFrame;
    centerFrame = window.requestAnimationFrame(() => {
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 1) return;
      if (!hasCenteredConversationRail) {
        rail.scrollLeft = maxScroll / 2;
        hasCenteredConversationRail = true;
      }
    });

    return () => {
      window.cancelAnimationFrame(centerFrame);
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail || hasShownConversationDiscoveryHint || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let setupFrame;
    let ringTimer;
    let nudgeTimer;
    let finishTimer;
    function cancelDiscovery() {
      hasShownConversationDiscoveryHint = true;
      window.clearTimeout(ringTimer); window.clearTimeout(nudgeTimer); window.clearTimeout(finishTimer);
      setDiscoveryPhase("idle");
    }
    setupFrame = window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (rail.scrollWidth <= rail.clientWidth + 1) return;
      rail.addEventListener("scroll", cancelDiscovery, { once: true });
      rail.addEventListener("pointerdown", cancelDiscovery, { once: true });
      rail.addEventListener("wheel", cancelDiscovery, { once: true, passive: true });
      ringTimer = window.setTimeout(() => {
        setDiscoveryPhase("ring");
        nudgeTimer = window.setTimeout(() => {
          setDiscoveryPhase("nudge");
          finishTimer = window.setTimeout(() => { hasShownConversationDiscoveryHint = true; setDiscoveryPhase("idle"); }, 414);
        }, 483);
      }, 1500);
    }));
    return () => { window.cancelAnimationFrame(setupFrame); window.clearTimeout(ringTimer); window.clearTimeout(nudgeTimer); window.clearTimeout(finishTimer); rail.removeEventListener("scroll", cancelDiscovery); rail.removeEventListener("pointerdown", cancelDiscovery); rail.removeEventListener("wheel", cancelDiscovery); };
  }, []);

  return <div className={`conversation-suggestion-rail-wrap relative mx-auto w-full max-w-4xl ${discoveryPhase === "ring" ? "conversation-suggestion-rail-wrap--hint-ring" : ""}`}><div ref={railRef} className="conversation-suggestion-rail overflow-x-auto" dir="ltr"><div className={`flex w-max min-w-full flex-nowrap gap-2 py-1 ${discoveryPhase === "nudge" ? "conversation-suggestion-rail__content--nudge" : ""}`} dir="rtl">{suggestions.map((suggestion) => <Suggestion key={suggestion.id} {...suggestion} conversation onSelect={onSelect} />)}</div></div><div className="conversation-suggestion-rail__hint-overlay" aria-hidden="true"><span className="conversation-suggestion-rail__hint-ring" /></div></div>;
}

function LandingSuggestions({ onSelect, suggestions }) {
  const viewportRef = useRef(null);
  const [phase, setPhase] = useState("idle");
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || hasShownLandingScrollHint || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let ringTimer;
    let nudgeTimer;
    let finishTimer;
    function cancelHint() {
      hasShownLandingScrollHint = true;
      window.clearTimeout(ringTimer); window.clearTimeout(nudgeTimer); window.clearTimeout(finishTimer);
      setPhase("idle");
    }
    const frame = window.requestAnimationFrame(() => {
      if (viewport.scrollHeight <= viewport.clientHeight + 1) return;
      viewport.addEventListener("scroll", cancelHint, { once: true });
      viewport.addEventListener("pointerdown", cancelHint, { once: true });
      ringTimer = window.setTimeout(() => {
        setPhase("ring");
        nudgeTimer = window.setTimeout(() => {
          setPhase("nudge");
          finishTimer = window.setTimeout(() => { hasShownLandingScrollHint = true; setPhase("idle"); }, 414);
        }, 483);
      }, 1500);
    });
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(ringTimer); window.clearTimeout(nudgeTimer); window.clearTimeout(finishTimer); viewport.removeEventListener("scroll", cancelHint); viewport.removeEventListener("pointerdown", cancelHint); };
  }, []);
  return <div ref={viewportRef} className={`landing-suggestions mx-auto w-full max-w-4xl ${phase === "ring" ? "landing-suggestions--hint-ring" : ""}`} dir="rtl"><div className={`grid grid-cols-3 gap-2 ${phase === "nudge" ? "landing-suggestions__content--nudge" : ""}`}>{suggestions.map((suggestion) => <Suggestion key={suggestion.id} {...suggestion} landing onSelect={onSelect} />)}</div><span className="landing-suggestions__hint-ring" aria-hidden="true" /></div>;
}

export default function SuggestionButtons({ onSelect, suggestions, loading, error, inConversation }) {
  if (loading) return <p className="mx-auto py-2 text-center text-xs text-zinc-400" role="status">در حال دریافت پیشنهادها...</p>;
  if (error) return <p className="mx-auto py-2 text-center text-xs text-zinc-400" role="status">پیشنهادها فعلاً در دسترس نیستند.</p>;
  if (!suggestions.length) return null;
  const presentedSuggestions = suggestions.map((suggestion) => ({ ...suggestion, ...(suggestionPresentation[suggestion.id] ?? { label: suggestion.title, icon: Lightbulb }) }));
  if (inConversation) return <ConversationRail onSelect={onSelect} suggestions={presentedSuggestions} />;
  return <LandingSuggestions onSelect={onSelect} suggestions={presentedSuggestions} />;
}
