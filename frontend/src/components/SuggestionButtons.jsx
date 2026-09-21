import { ChevronLeft, ChevronRight, Cpu, LampDesk, PanelTop, Projector, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const priceListRequest = (categoryId) => ({ type: "price_table", categoryId });
const initialSuggestions = [{ label: "لامپ‌های اقتصادی", icon: LampDesk, presentationRequest: priceListRequest("economy-bulbs") }, { label: "لامپ‌های با گارانتی", icon: LampDesk, presentationRequest: priceListRequest("iranian-bulbs-warranty") }, { label: "پروژکتور", icon: Projector, presentationRequest: priceListRequest("projectors") }, { label: "تعمیرات", icon: Wrench, presentationRequest: priceListRequest("repairs") }, { label: "قیمت چیپ", icon: Cpu, sendAsText: true }, { label: "پنل سقفی", icon: PanelTop }];
const conversationSuggestions = [{ label: "لامپ‌های اقتصادی", icon: LampDesk, presentationRequest: priceListRequest("economy-bulbs") }, { label: "لامپ‌های با گارانتی", icon: LampDesk, presentationRequest: priceListRequest("iranian-bulbs-warranty") }, { label: "پروژکتور", icon: Projector, presentationRequest: priceListRequest("projectors") }, { label: "تعمیرات", icon: Wrench, presentationRequest: priceListRequest("repairs") }, { label: "قیمت چیپ", icon: Cpu, sendAsText: true }, { label: "پنل سقفی", icon: PanelTop }];
let hasCenteredConversationRail = false;
let hasHandledConversationRailHint = false;
function Suggestion({ label, icon: Icon, onSelect, landing = false, conversation = false, presentationRequest, sendAsText = false }) {
  const selectSuggestion = () => onSelect(sendAsText ? label : { content: label, presentationRequest });
  if (landing) return <button type="button" onClick={selectSuggestion} className="relative isolate flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-[#d9ad4a]/45 bg-[#161215] px-1.5 py-1.5 text-center text-[11px] font-medium leading-4 text-zinc-100 shadow-[0_0_0_1px_rgba(238,198,103,0.06),0_5px_14px_rgba(0,0,0,0.3),0_0_12px_rgba(217,173,74,0.07)] transition hover:border-[#d9ad4a]/55 hover:bg-[#1d1518] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70 sm:min-h-24 sm:text-xs"><span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(105,48,35,0.3),transparent_62%),radial-gradient(ellipse_at_100%_100%,rgba(98,64,27,0.15),transparent_50%)]" /><span aria-hidden="true" className="pointer-events-none absolute inset-px rounded-[15px] border border-[#f3d98e]/12 shadow-[inset_0_1px_0_rgba(255,238,192,0.18),inset_0_-1px_0_rgba(141,88,31,0.24),inset_0_0_12px_rgba(217,173,74,0.05)]" /><span aria-hidden="true" className="pointer-events-none absolute -top-4 left-1/2 h-8 w-16 -translate-x-1/2 rounded-full bg-[#e3bd62]/10 blur-xl" /><Icon size={22} strokeWidth={1.7} className="relative shrink-0 text-[#edcf78] drop-shadow-[0_1px_3px_rgba(227,189,98,0.32)]" /><span className="relative">{label}</span></button>;
  if (conversation) return <button type="button" onClick={selectSuggestion} className="shrink-0 whitespace-nowrap rounded-full border border-[#d9ad4a]/28 bg-[#d9ad4a]/[0.04] px-3 py-1.5 text-xs text-[#e7c66e] transition hover:border-[#d9ad4a]/50 hover:bg-[#d9ad4a]/10 focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/60">{label}</button>;
  return <button type="button" onClick={selectSuggestion} className="flex min-w-0 items-center justify-center gap-1 rounded-[14px] border border-white/15 bg-[#171216] px-1.5 py-1.5 text-center text-[10px] leading-4 text-zinc-200 transition hover:border-[#d9ad4a]/40 hover:bg-[#35262d] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/70 sm:px-2 sm:text-xs"><Icon size={13} className="shrink-0 text-[#e3bd62]" /><span>{label}</span></button>;
}

function ConversationRail({ onSelect }) {
  const railRef = useRef(null);
  const [showHints, setShowHints] = useState(false);
  const [hintPosition, setHintPosition] = useState(null);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    let centerFrame;
    let interactionFrame;
    let hintStartTimeout;
    let hintEndTimeout;
    let hasOverflow = false;

    function updateHintPosition() {
      const bounds = rail.getBoundingClientRect();
      setHintPosition({ top: Math.max(12, bounds.top - 27), left: bounds.left + 14, right: window.innerWidth - bounds.right + 14 });
    }

    function dismissHints() {
      if (!hasOverflow || hasHandledConversationRailHint) return;
      hasHandledConversationRailHint = true;
      window.clearTimeout(hintStartTimeout);
      window.clearTimeout(hintEndTimeout);
      setShowHints(false);
    }
    function dismissOnWheel(event) { if (event.deltaX) dismissHints(); }

    centerFrame = window.requestAnimationFrame(() => {
      const maxScroll = rail.scrollWidth - rail.clientWidth;
      if (maxScroll <= 1) return;
      hasOverflow = true;
      if (!hasCenteredConversationRail) {
        rail.scrollLeft = maxScroll / 2;
        hasCenteredConversationRail = true;
      }
      interactionFrame = window.requestAnimationFrame(() => {
        updateHintPosition();
        window.addEventListener("resize", updateHintPosition);
        rail.addEventListener("pointerdown", dismissHints, { once: true });
        rail.addEventListener("touchstart", dismissHints, { once: true });
        rail.addEventListener("scroll", dismissHints, { once: true });
        rail.addEventListener("wheel", dismissOnWheel, { passive: true });
        if (hasHandledConversationRailHint) return;
        hintStartTimeout = window.setTimeout(() => {
          if (hasHandledConversationRailHint) return;
          setShowHints(true);
          hintEndTimeout = window.setTimeout(() => {
            hasHandledConversationRailHint = true;
            setShowHints(false);
          }, 2500);
        }, 3000);
      });
    });

    return () => {
      window.cancelAnimationFrame(centerFrame);
      window.cancelAnimationFrame(interactionFrame);
      window.clearTimeout(hintStartTimeout);
      window.clearTimeout(hintEndTimeout);
      rail.removeEventListener("pointerdown", dismissHints);
      rail.removeEventListener("touchstart", dismissHints);
      rail.removeEventListener("scroll", dismissHints);
      rail.removeEventListener("wheel", dismissOnWheel);
      window.removeEventListener("resize", updateHintPosition);
    };
  }, []);

  return <><div ref={railRef} className="conversation-suggestion-rail relative mx-auto w-full max-w-4xl overflow-x-auto" dir="ltr"><div className="flex w-max min-w-full flex-nowrap gap-2 py-1" dir="rtl">{conversationSuggestions.map((suggestion) => <Suggestion key={suggestion.label} {...suggestion} conversation onSelect={onSelect} />)}</div></div>{hintPosition && <div className={`conversation-scroll-hints ${showHints ? "conversation-scroll-hints--visible" : ""}`} aria-hidden="true" style={hintPosition}><span className="conversation-scroll-hint conversation-scroll-hint--left"><ChevronLeft size={13} className="conversation-scroll-hint__chevron" /><ChevronLeft size={13} className="conversation-scroll-hint__chevron conversation-scroll-hint__chevron--second" /><ChevronLeft size={13} className="conversation-scroll-hint__chevron conversation-scroll-hint__chevron--third" /></span><span className="conversation-scroll-hint conversation-scroll-hint--right"><ChevronRight size={13} className="conversation-scroll-hint__chevron" /><ChevronRight size={13} className="conversation-scroll-hint__chevron conversation-scroll-hint__chevron--second" /><ChevronRight size={13} className="conversation-scroll-hint__chevron conversation-scroll-hint__chevron--third" /></span></div>}</>;
}

export default function SuggestionButtons({ onSelect, inConversation }) { if (inConversation) return <ConversationRail onSelect={onSelect} />; return <div className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-2" dir="rtl">{initialSuggestions.map((suggestion) => <Suggestion key={suggestion.label} {...suggestion} landing onSelect={onSelect} />)}</div>; }
