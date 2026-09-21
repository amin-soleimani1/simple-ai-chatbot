import { useEffect, useState } from "react";
import { storeHighlights } from "../data/storeDetails";

export default function StoreInfo() {
  const [index, setIndex] = useState(0);
  useEffect(() => { const intervalId = window.setInterval(() => setIndex((current) => (current + 1) % storeHighlights.length), 3000); return () => window.clearInterval(intervalId); }, []);
  return <p className="h-5 text-center text-xs text-zinc-400 transition-opacity">{storeHighlights[index]}</p>;
}
