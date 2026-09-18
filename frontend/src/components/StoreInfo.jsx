import { useEffect, useState } from "react";

const storeDetails = ["کالای روشنایی کیان", "فروش لامپ، پروژکتور و پنل سقفی", "خدمات تعمیرات تخصصی روشنایی"];

export default function StoreInfo() {
  const [index, setIndex] = useState(0);
  useEffect(() => { const intervalId = window.setInterval(() => setIndex((current) => (current + 1) % storeDetails.length), 3000); return () => window.clearInterval(intervalId); }, []);
  return <p className="h-5 text-center text-xs text-zinc-400 transition-opacity">{storeDetails[index]}</p>;
}
