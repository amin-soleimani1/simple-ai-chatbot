import { useEffect, useMemo, useState } from "react";
import { CircleAlert, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { getKnowledgeCategories, getMarketReference, saveMarketReference } from "../services/api";
import { formatToman } from "../utils/formatToman";

const emptyItem = () => ({ watt: "", minPrice: "", referencePrice: "", maxPrice: "" });

function toDateTimeLocal(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function nowDateTimeLocal() { return toDateTimeLocal(new Date().toISOString()); }

function createDraft(category, reference = null) {
  return {
    title: reference?.title ?? category.title,
    updatedAt: toDateTimeLocal(reference?.updatedAt) || nowDateTimeLocal(),
    sampleCount: reference?.research?.sampleCount?.toString() ?? "",
    items: reference?.items.map((item) => ({
      watt: item.watt.toString(), minPrice: item.minPrice.toString(), referencePrice: item.referencePrice.toString(), maxPrice: item.maxPrice.toString(),
    })) ?? [emptyItem()],
  };
}

function parsePositiveInteger(value) {
  const normalized = String(value).trim().replace(/[٬,]/g, "").replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const number = Number(normalized);
  return /^\d+$/.test(normalized) && Number.isSafeInteger(number) && number > 0 ? number : null;
}

function validateDraft(draft, categoryId) {
  const title = draft.title.trim();
  if (!title) return { error: "عنوان دسته را وارد کنید." };
  if (!draft.updatedAt || Number.isNaN(new Date(draft.updatedAt).getTime())) return { error: "تاریخ بررسی بازار معتبر نیست." };
  const sampleCount = parsePositiveInteger(draft.sampleCount);
  if (sampleCount === null) return { error: "تعداد نمونه باید یک عدد صحیح بزرگ‌تر از صفر باشد." };
  if (!draft.items.length) return { error: "حداقل یک ردیف قیمت وارد کنید." };
  const watts = new Set();
  const items = [];
  for (const row of draft.items) {
    const watt = parsePositiveInteger(row.watt);
    const minPrice = parsePositiveInteger(row.minPrice);
    const referencePrice = parsePositiveInteger(row.referencePrice);
    const maxPrice = parsePositiveInteger(row.maxPrice);
    if ([watt, minPrice, referencePrice, maxPrice].includes(null)) return { error: "توان و همهٔ قیمت‌ها باید عدد صحیح بزرگ‌تر از صفر باشند." };
    if (watts.has(watt)) return { error: "توان هر ردیف باید یکتا باشد." };
    if (minPrice > referencePrice || referencePrice > maxPrice) return { error: "ترتیب قیمت‌ها باید حداقل، مرجع، حداکثر باشد." };
    watts.add(watt);
    items.push({ watt, minPrice, referencePrice, maxPrice });
  }
  return {
    value: {
      schemaVersion: 1,
      categoryId,
      title,
      updatedAt: new Date(draft.updatedAt).toISOString(),
      research: { sampleCount, method: "manual_market_research" },
      items,
    },
  };
}

function freshnessLabel(freshness) {
  return ({ current: "به‌روز", stale: "نیازمند بررسی", outdated: "قدیمی" })[freshness] ?? "نامشخص";
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MarketReferenceTable({ reference }) {
  return <div className="market-reference-table__scroll"><table>
    <thead><tr><th>وات</th><th>حداقل قیمت</th><th>قیمت مرجع</th><th>حداکثر قیمت</th></tr></thead>
    <tbody>{reference.items.map((item) => <tr key={item.watt}><td>{new Intl.NumberFormat("fa-IR").format(item.watt)}</td><td>{formatToman(item.minPrice)}</td><td>{formatToman(item.referencePrice)}</td><td>{formatToman(item.maxPrice)}</td></tr>)}</tbody>
  </table></div>;
}

export default function MarketReferencePage() {
  const [categories, setCategories] = useState([]);
  const [categoriesState, setCategoriesState] = useState("loading");
  const [categoryId, setCategoryId] = useState("");
  const [referenceState, setReferenceState] = useState("idle");
  const [loadedCategoryId, setLoadedCategoryId] = useState(null);
  const [reference, setReference] = useState(null);
  const [draft, setDraft] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId) ?? null, [categories, categoryId]);
  const activeReferenceState = selectedCategory && loadedCategoryId === selectedCategory.id ? referenceState : "loading";

  useEffect(() => {
    let active = true;
    getKnowledgeCategories().then((items) => {
      if (!active) return;
      const priceCategories = items.filter((category) => category.type === "price_list");
      setCategories(priceCategories); setCategoryId(priceCategories[0]?.id ?? ""); setCategoriesState("ready");
    }).catch(() => { if (active) setCategoriesState("error"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedCategory) return undefined;
    let active = true;
    getMarketReference(selectedCategory.id).then((data) => {
      if (!active) return;
      setReference(data); setDraft(createDraft(selectedCategory, data)); setReferenceState("ready"); setLoadedCategoryId(selectedCategory.id); setEditing(false); setError(""); setSuccess("");
    }).catch((requestError) => {
      if (!active) return;
      if (requestError.status === 404) { setReference(null); setDraft(createDraft(selectedCategory)); setReferenceState("not-found"); setLoadedCategoryId(selectedCategory.id); setEditing(false); setError(""); setSuccess(""); }
      else { setReferenceState("error"); setLoadedCategoryId(selectedCategory.id); }
    });
    return () => { active = false; };
  }, [selectedCategory]);

  function updateDraft(field, value) { setDraft((current) => ({ ...current, [field]: value })); setError(""); setSuccess(""); }
  function updateItem(index, field, value) {
    setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) }));
    setError(""); setSuccess("");
  }
  function beginEditing() { setDraft(createDraft(selectedCategory, reference)); setEditing(true); setError(""); setSuccess(""); }
  async function handleSave() {
    const validated = validateDraft(draft, selectedCategory.id);
    if (validated.error) { setError(validated.error); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const saved = await saveMarketReference(selectedCategory.id, validated.value);
      setReference(saved); setDraft(createDraft(selectedCategory, saved)); setReferenceState("ready"); setEditing(false); setSuccess("قیمت مرجع بازار با موفقیت ذخیره شد.");
    } catch (requestError) { setError(requestError.message || "ذخیره‌سازی انجام نشد. دوباره تلاش کنید."); }
    finally { setSaving(false); }
  }

  return <section className="admin-page market-reference-page" aria-labelledby="market-reference-title">
    <div className="admin-page__intro"><p className="admin-eyebrow">اطلاعات مستقل از قیمت فروشگاه</p><h2 id="market-reference-title">قیمت مرجع بازار</h2><p>قیمت‌های تقریبی بازار را برای دستهٔ انتخاب‌شده ثبت و بررسی کنید.</p></div>
    {categoriesState === "loading" && <div className="knowledge-status"><LoaderCircle className="knowledge-spinner" size={22} aria-hidden="true" /><span>در حال دریافت دسته‌ها...</span></div>}
    {categoriesState === "error" && <div className="knowledge-status knowledge-status--error"><CircleAlert size={22} aria-hidden="true" /><span>دریافت دسته‌ها انجام نشد. دوباره تلاش کنید.</span></div>}
    {categoriesState === "ready" && !categories.length && <div className="knowledge-status"><span>دستهٔ قیمت‌گذاری‌شده‌ای برای ثبت قیمت مرجع بازار وجود ندارد.</span></div>}
    {categoriesState === "ready" && categories.length > 0 && <>
      <label className="market-reference-category"><span>دستهٔ دانش پایه</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.title}</option>)}</select></label>
      {activeReferenceState === "loading" && <div className="knowledge-status"><LoaderCircle className="knowledge-spinner" size={22} aria-hidden="true" /><span>در حال دریافت قیمت مرجع بازار...</span></div>}
      {activeReferenceState === "error" && <div className="knowledge-status knowledge-status--error"><CircleAlert size={22} aria-hidden="true" /><span>دریافت قیمت مرجع بازار انجام نشد. دوباره تلاش کنید.</span></div>}
      {activeReferenceState === "not-found" && <div className="market-reference-card"><div className="market-reference-card__header"><div><h3>هنوز قیمت مرجع بازار برای این دسته ثبت نشده است.</h3><p>می‌توانید نخستین دادهٔ مرجع بازار را ثبت کنید.</p></div></div><MarketReferenceEditor draft={draft} updateDraft={updateDraft} updateItem={updateItem} onAdd={() => setDraft((current) => ({ ...current, items: [...current.items, emptyItem()] }))} onRemove={(index) => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} onSave={handleSave} saving={saving} error={error} /></div>}
      {activeReferenceState === "ready" && reference && !editing && <div className="market-reference-card"><div className="market-reference-card__header"><div><h3>{reference.title}</h3><p>قیمت مرجع بازار است و قیمت رسمی فروشگاه نیست.</p></div><button className="knowledge-secondary-button" type="button" onClick={beginEditing}>ویرایش</button></div><div className="market-reference-meta"><span>آخرین بررسی: <strong>{displayDate(reference.updatedAt)}</strong></span><span className={`market-reference-freshness is-${reference.freshness}`}>{freshnessLabel(reference.freshness)}</span><span>تعداد نمونه: <strong>{new Intl.NumberFormat("fa-IR").format(reference.research.sampleCount)}</strong></span><span>روش: بررسی دستی بازار</span></div><MarketReferenceTable reference={reference} />{success && <p className="knowledge-save-message" role="status">{success}</p>}</div>}
      {activeReferenceState === "ready" && reference && editing && <div className="market-reference-card"><div className="market-reference-card__header"><div><h3>ویرایش قیمت مرجع بازار</h3><p>تغییرات تا زمان ذخیره فقط محلی هستند.</p></div><button className="knowledge-secondary-button" type="button" onClick={() => { setEditing(false); setDraft(createDraft(selectedCategory, reference)); setError(""); }}>انصراف</button></div><MarketReferenceEditor draft={draft} updateDraft={updateDraft} updateItem={updateItem} onAdd={() => setDraft((current) => ({ ...current, items: [...current.items, emptyItem()] }))} onRemove={(index) => setDraft((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} onSave={handleSave} saving={saving} error={error} /></div>}
    </>}
  </section>;
}

function MarketReferenceEditor({ draft, updateDraft, updateItem, onAdd, onRemove, onSave, saving, error }) {
  if (!draft) return null;
  return <div className="market-reference-editor">
    <div className="market-reference-fields"><label className="knowledge-field"><span>عنوان دسته</span><input value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} disabled={saving} /></label><label className="knowledge-field"><span>آخرین تاریخ بررسی بازار</span><input type="datetime-local" value={draft.updatedAt} onChange={(event) => updateDraft("updatedAt", event.target.value)} disabled={saving} /></label><label className="knowledge-field"><span>تعداد نمونه</span><input inputMode="numeric" value={draft.sampleCount} onChange={(event) => updateDraft("sampleCount", event.target.value)} disabled={saving} /></label></div>
    <div className="market-reference-editor__table"><div className="market-reference-editor__heading"><h4>آیتم‌های قیمت مرجع</h4><button className="knowledge-secondary-button" type="button" onClick={onAdd} disabled={saving}><Plus size={17} aria-hidden="true" />افزودن ردیف</button></div><div className="market-reference-table__scroll"><table><thead><tr><th>وات</th><th>حداقل قیمت</th><th>قیمت مرجع</th><th>حداکثر قیمت</th><th><span className="sr-only">عملیات</span></th></tr></thead><tbody>{draft.items.map((item, index) => <tr key={index}>{[["watt", "وات"], ["minPrice", "حداقل قیمت"], ["referencePrice", "قیمت مرجع"], ["maxPrice", "حداکثر قیمت"]].map(([field, label]) => <td key={field}><label className="sr-only" htmlFor={`market-${field}-${index}`}>{label}</label><input id={`market-${field}-${index}`} inputMode="numeric" value={item[field]} onChange={(event) => updateItem(index, field, event.target.value)} disabled={saving} /></td>)}<td><button className="admin-icon-button market-reference-remove" type="button" onClick={() => onRemove(index)} disabled={saving} aria-label="حذف ردیف"><Trash2 size={18} aria-hidden="true" /></button></td></tr>)}</tbody></table></div></div>
    {error && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}<button className="knowledge-primary-button market-reference-save" type="button" onClick={onSave} disabled={saving}>{saving ? <LoaderCircle className="knowledge-spinner" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}{saving ? "در حال ذخیره..." : "ذخیرهٔ قیمت مرجع بازار"}</button>
  </div>;
}
