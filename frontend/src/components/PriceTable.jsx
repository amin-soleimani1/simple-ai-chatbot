import { formatToman } from "../utils/formatToman";
import { productDisplayName } from "../utils/productDisplayName";

export default function PriceTable({ presentation }) {
  const productName = productDisplayName(presentation.categoryId, presentation.title);
  return <section aria-label={`قیمت‌های ${presentation.title}`} className="overflow-x-auto"><table className="w-full min-w-[15rem] text-right text-sm"><thead className="border-b border-white/15 text-zinc-300"><tr><th className="px-2 py-2 font-medium">محصول</th><th className="px-2 py-2 font-medium">قیمت</th></tr></thead><tbody>{presentation.rows.map((row) => <tr key={row.watt} className="border-b border-white/10 last:border-0"><td className="px-2 py-2">{productName} {new Intl.NumberFormat("fa-IR").format(row.watt)} وات</td><td className="whitespace-nowrap px-2 py-2">{formatToman(row.priceToman)}</td></tr>)}</tbody></table></section>;
}
