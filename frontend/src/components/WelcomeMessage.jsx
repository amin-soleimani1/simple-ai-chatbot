export default function WelcomeMessage() {
  return (
    <section className="relative isolate mx-auto w-full max-w-[34rem] overflow-hidden rounded-2xl border border-[#d9ad4a]/45 bg-[#161215] px-4 py-5 text-center shadow-[0_0_0_1px_rgba(238,198,103,0.08),0_10px_26px_rgba(0,0,0,0.38),0_0_22px_rgba(217,173,74,0.1),0_8px_20px_rgba(156,104,35,0.1)] sm:max-w-xl sm:px-5 sm:py-4">
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_0%,rgba(105,48,35,0.32),transparent_60%),radial-gradient(ellipse_at_100%_100%,rgba(98,64,27,0.18),transparent_50%)]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-px rounded-[15px] border border-[#f3d98e]/12 shadow-[inset_0_1px_0_rgba(255,238,192,0.2),inset_0_-1px_0_rgba(141,88,31,0.28),inset_0_0_18px_rgba(217,173,74,0.06)]" />
      <span aria-hidden="true" className="pointer-events-none absolute -top-8 left-1/2 h-14 w-40 -translate-x-1/2 rounded-full bg-[#e3bd62]/10 blur-2xl" />
      <div className="relative">
        <p className="text-base font-bold text-[#f5df9f] sm:text-lg">👋 سلام</p>
        <h1 className="mt-1.5 text-sm font-semibold leading-5 text-zinc-50 sm:text-base sm:leading-6">من دستیار هوشمند کیان هستم</h1>
        <p className="mt-1 text-xs leading-5 text-zinc-300 sm:text-sm sm:leading-6">
          در مورد محصولات، قیمت‌ها، گارانتی، تعمیرات<br />
          و هر سوال دیگه‌ای از من بپرسید.
        </p>
      </div>
    </section>
  );
}
