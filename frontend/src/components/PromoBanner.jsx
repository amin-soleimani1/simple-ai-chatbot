import hero from "../assets/hero-2.webp";

export default function PromoBanner() {
  return (
    <div className="mx-auto w-full max-w-[34rem] overflow-hidden rounded-2xl border border-[#d9ad4a]/20 shadow-[0_0_18px_rgba(217,173,74,0.05)] sm:max-w-xl">
      <img src={hero} alt="پیشنهاد ویژه کالای روشنایی کیان" className="h-auto w-full object-contain" />
    </div>
  );
}
