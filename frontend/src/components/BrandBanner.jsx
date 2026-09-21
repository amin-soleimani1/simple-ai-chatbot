import banner from "../assets/banner_2.webp";

export default function BrandBanner() {
  return <div className="mx-auto flex w-full justify-center"><img src={banner} alt="دستیار هوشمند" className="h-auto w-full max-w-[34rem] object-contain sm:max-w-xl lg:max-w-2xl" /></div>;
}
