import { formatToman } from "../utils/formatToman";
import { productDisplayName } from "../utils/productDisplayName";

export default function PriceTable({ presentation }) {
  const productName = productDisplayName(presentation.categoryId, presentation.title);
  const status = presentation.status ?? "available";
  if (status === "not_sold") return <section aria-label={`قیمت‌های ${presentation.title}`} className="text-sm text-zinc-300">این محصول در فروشگاه عرضه نمی‌شود.</section>;
  return <section aria-label={`قیمت‌های ${presentation.title}`} className="overflow-x-auto">{status === "out_of_stock" && <p className="mb-2 text-sm text-amber-200">این محصول فعلاً موجود نیست؛ قیمت‌ها آخرین قیمت ثبت‌شده هستند.</p>}<table className="w-full min-w-[15rem] text-right text-sm"><thead className="border-b border-white/15 text-zinc-300"><tr><th className="px-2 py-2 font-medium">محصول</th><th className="px-2 py-2 font-medium">{status === "out_of_stock" ? "آخرین قیمت ثبت‌شده" : "قیمت"}</th></tr></thead><tbody>{presentation.rows.map((row) => {
    const unavailableItem = status === "available" && row.available === false;
    return <tr key={row.watt} className="border-b border-white/10 last:border-0"><td className="px-2 py-2">{productName} {new Intl.NumberFormat("fa-IR").format(row.watt)} وات{unavailableItem && <span className="mr-2 text-xs text-amber-200">ناموجود</span>}</td><td className="whitespace-nowrap px-2 py-2">{formatToman(row.priceToman)}{unavailableItem && <span className="mt-1 block text-xs text-zinc-400">آخرین قیمت ثبت‌شده</span>}</td></tr>;
  })}</tbody></table></section>;
}
