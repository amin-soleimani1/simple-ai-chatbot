import { Clock3, Download, MapPin, Phone, ShieldCheck, Store, UserRound, X } from "lucide-react";
import { storeDetails } from "../data/storeDetails";

function DetailItem({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3 py-3.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center text-[#e3bd62]">
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-zinc-400">{label}</p>
        <div className="mt-1 text-sm leading-6 text-zinc-100">{children}</div>
      </div>
    </div>
  );
}

export default function StoreDrawer({ isOpen, onClose, onExited, onAdminClick, onInstallClick, installAvailable, showInstallAttention, closeButtonRef }) {
  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!isOpen}>
      <div className={`absolute inset-0 bg-[rgba(6,5,7,0.48)] backdrop-blur-sm transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`} onPointerDown={onClose} />
      <aside id="store-information-drawer" className={`absolute inset-y-0 left-0 flex w-[80vw] max-w-[22rem] flex-col border-r border-[#d9ad4a]/24 bg-[rgba(10,7,9,0.74)] text-right text-zinc-100 shadow-[8px_0_24px_rgba(0,0,0,0.34),0_0_16px_rgba(217,173,74,0.06)] backdrop-blur-md transition-transform duration-[240ms] ease-out ${isOpen ? "translate-x-0" : "-translate-x-full"}`} dir="rtl" role="dialog" aria-modal="true" aria-labelledby="store-drawer-title" inert={isOpen ? undefined : ""} onPointerDown={(event) => event.stopPropagation()} onTransitionEnd={(event) => { if (event.target === event.currentTarget && !isOpen) onExited(); }}>
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(95,39,31,0.18),transparent_46%),radial-gradient(ellipse_at_0%_100%,rgba(177,125,43,0.06),transparent_40%)]" />
        <div className="relative flex min-h-full flex-col">
          <div className="flex items-start justify-between border-b border-[#d9ad4a]/20 px-4 pb-4 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center text-[#e7c66e]"><Store size={19} strokeWidth={1.7} /></span>
              <div>
                <h2 id="store-drawer-title" className="text-sm font-semibold text-zinc-50">{storeDetails.name}</h2>
                <p className="mt-1 text-[11px] text-zinc-400">اطلاعات فروشگاه</p>
              </div>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="بستن منو" className="grid size-9 place-items-center rounded-full border border-[#d9ad4a]/30 bg-[rgba(11,8,10,0.5)] text-zinc-200 shadow-[inset_0_1px_0_rgba(255,238,192,0.12),0_0_10px_rgba(217,173,74,0.06)] transition hover:border-[#e3bd62]/55 hover:text-[#f4d477] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/60"><X size={18} /></button>
          </div>

          <div className="divide-y divide-[#d9ad4a]/18 px-4">
            <DetailItem icon={UserRound} label="فروشنده">{storeDetails.seller}</DetailItem>
            <DetailItem icon={Phone} label="شماره تماس"><a className="text-[#e8c96f] underline-offset-4 hover:underline" dir="ltr" href={`tel:${storeDetails.phone}`}>{storeDetails.phone}</a></DetailItem>
            <DetailItem icon={MapPin} label="آدرس">{storeDetails.address}</DetailItem>
            <DetailItem icon={Clock3} label="ساعات کاری">{storeDetails.hours}</DetailItem>
            {installAvailable && <button type="button" onClick={onInstallClick} className="relative flex w-full gap-3 py-3.5 text-right text-sm text-zinc-200 transition hover:text-[#efd080] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/60"><span className="mt-0.5 grid size-8 shrink-0 place-items-center text-[#e3bd62]"><Download size={16} strokeWidth={1.8} /></span><span className="mt-1 min-w-0 text-sm leading-6 text-zinc-100">نصب برنامه</span>{showInstallAttention && <span className="install-attention-dot absolute left-2 top-1/2 -translate-y-1/2" aria-hidden="true" />}</button>}
          </div>

          <div className="mt-auto border-t border-[#d9ad4a]/18 px-4 py-3">
            <button type="button" onClick={onAdminClick} className="flex w-full items-center gap-3 py-2.5 text-right text-sm text-zinc-200 transition hover:text-[#efd080] focus:outline-none focus:ring-2 focus:ring-[#d9ad4a]/60">
              <ShieldCheck size={18} className="text-[#e3bd62]" strokeWidth={1.8} />
              پنل مدیریت
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
