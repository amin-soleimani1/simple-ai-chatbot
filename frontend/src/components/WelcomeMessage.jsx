import { Sparkles } from "lucide-react";

export default function WelcomeMessage() {
  return <section className="text-center"><div className="mb-4 inline-flex rounded-xl bg-emerald-400/10 p-3 text-emerald-300 sm:mb-5 lg:p-4"><Sparkles size={26} className="lg:size-7" /></div><h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl lg:text-[34px] lg:leading-tight">سلام، چطور می‌تونم کمک کنم؟</h1><p className="mt-3 text-sm leading-7 text-zinc-400 sm:text-base lg:mt-4 lg:leading-8">سؤالت را بنویس یا یکی از پیشنهادها را انتخاب کن.</p></section>;
}
