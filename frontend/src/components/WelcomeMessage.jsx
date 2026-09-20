import { Lightbulb } from "lucide-react";

export default function WelcomeMessage() {
  return <section className="text-center"><div className="inline-flex p-1.5 text-[#e3bd62]"><Lightbulb size={26} className="scale-[1.6] sm:size-7" /></div><h1 className="mt-1 text-[13.8px] font-semibold leading-8 tracking-tight text-zinc-50 sm:text-[16.1px] sm:leading-9">به چت‌بات <span className="font-bold text-[#e3bd62]">کالای روشنایی کیان</span> خوش آمدید.</h1><div className="mt-1 text-[8px] leading-6 text-zinc-400 sm:text-[10px] sm:leading-7"><p className="text-[7.406px] sm:text-[9.2575px]">می‌تونید درباره قیمت لامپ، تعمیرات، پروژکتور، پنل سقفی و ... از من بپرسید.</p><p className="mt-[1px] text-center text-[9.2px] sm:text-[11.5px]">یا یکی از پیشنهادها را انتخاب کنید.</p></div></section>;
}
