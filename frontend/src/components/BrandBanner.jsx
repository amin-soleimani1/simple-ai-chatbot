import banner from "../assets/banner.png";

export default function BrandBanner() {
  return <div className="mx-auto mb-5 flex w-full -translate-y-[15%] justify-center sm:mb-6 lg:mb-8"><img src={banner} alt="دستیار هوشمند" className="h-auto w-full max-w-[26rem] object-contain sm:max-w-xl lg:max-w-2xl" /></div>;
}
