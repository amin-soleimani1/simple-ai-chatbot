function formatToman(value) {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}

function PreviewData({ category, parsedData }) {
  if (category.type === "price_list") {
    const items = parsedData?.items ?? [];
    return <><h3>اطلاعات شناسایی‌شده</h3><ul className="knowledge-preview-list">{items.map((item) => <li key={item.watt}><strong>{new Intl.NumberFormat("fa-IR").format(item.watt)} وات</strong><span>{formatToman(item.price)}</span></li>)}</ul><p className="knowledge-preview-summary">{new Intl.NumberFormat("fa-IR").format(items.length)} مورد با موفقیت شناسایی شد.</p></>;
  }
  if (category.type === "per_watt_price") return <><h3>اطلاعات شناسایی‌شده</h3><p className="knowledge-preview-value">قیمت هر وات: <strong>{formatToman(parsedData?.pricePerWatt)}</strong></p></>;
  return <><h3>اطلاعات شناسایی‌شده</h3><p className="knowledge-preview-text">{parsedData?.text}</p></>;
}

function ChangeList({ changes, changed }) {
  if (!changed) return <p className="knowledge-preview-no-change">تغییری در اطلاعات ایجاد نشده است.</p>;
  if (!changes?.length) return null;
  return <div className="knowledge-changes"><h3>تغییرات</h3><ul>{changes.map((change, index) => {
    if (change.type === "added") return <li key={`${change.type}-${change.watt}-${index}`}><strong>{new Intl.NumberFormat("fa-IR").format(change.watt)} وات</strong><span>با قیمت {formatToman(change.price)} اضافه می‌شود.</span></li>;
    if (change.type === "removed") return <li key={`${change.type}-${change.watt}-${index}`}><strong>{new Intl.NumberFormat("fa-IR").format(change.watt)} وات</strong><span>با قیمت {formatToman(change.price)} حذف می‌شود.</span></li>;
    if (change.type === "updated" && change.watt) return <li key={`${change.type}-${change.watt}-${index}`}><strong>{new Intl.NumberFormat("fa-IR").format(change.watt)} وات</strong><span>{formatToman(change.oldPrice)} ← {formatToman(change.newPrice)}</span></li>;
    if (change.type === "updated" && change.newPricePerWatt) return <li key={`${change.type}-${index}`}><span>قیمت هر وات از {formatToman(change.oldPricePerWatt)} به {formatToman(change.newPricePerWatt)} تغییر می‌کند.</span></li>;
    if (change.type === "created") return <li key={`${change.type}-${index}`}><span>این دسته برای نخستین‌بار آمادهٔ ذخیره است.</span></li>;
    return <li key={`${change.type}-${index}`}><span>محتوای متنی تغییر کرده است.</span></li>;
  })}</ul></div>;
}

function ParserErrors({ errors, rawText }) {
  const lines = rawText.split(/\r?\n/);
  return <div className="knowledge-preview-errors" role="alert"><h3>اطلاعات نیاز به اصلاح دارد</h3><ul>{errors.map((error, index) => <li key={`${error.line}-${index}`}>
    {error.line && <><strong>خط {new Intl.NumberFormat("fa-IR").format(error.line)}</strong><code>{lines[error.line - 1]}</code></>}
    <span>{error.message}</span>
  </li>)}</ul></div>;
}

export default function KnowledgePreviewResult({ category, preview, rawText, invalidated }) {
  if (invalidated) return <p className="knowledge-preview-invalidated">متن تغییر کرده است؛ برای بررسی اطلاعات جدید دوباره «بررسی اطلاعات» را انتخاب کنید.</p>;
  if (!preview) return null;
  if (!preview.valid) return <ParserErrors errors={preview.errors ?? []} rawText={rawText} />;
  return <section className="knowledge-preview-result" aria-live="polite"><PreviewData category={category} parsedData={preview.parsedData} /><ChangeList changes={preview.changes} changed={preview.changed} /></section>;
}
