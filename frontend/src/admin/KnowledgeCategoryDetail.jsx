import { useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { addKnowledgePriceItem, deleteKnowledgePriceItem, previewKnowledgeCategory, saveKnowledgeCategory, updateKnowledgeCategoryStatus, updateKnowledgePrice, updateKnowledgePricesByPercentage } from "../services/api";
import KnowledgePreviewResult from "./KnowledgePreviewResult";

function validPriceItems(knowledge) {
  const items = knowledge?.parsedData?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const watts = new Set();
  for (const item of items) {
    if (!item || !Number.isSafeInteger(item.watt) || item.watt <= 0 || !Number.isSafeInteger(item.price) || item.price <= 0 || watts.has(item.watt)) return null;
    watts.add(item.watt);
  }
  return items;
}

function formatAdminToman(value) {
  return `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;
}

function formattedUpdatedAt(updatedAt) {
  const date = new Date(updatedAt);
  if (!updatedAt || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function parseManualPrice(value) {
  const digits = value.replace(/[٬,]/g, "").replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit));
  const price = Number(digits);
  return /^\d+$/.test(digits) && Number.isSafeInteger(price) && price > 0 ? price : null;
}

function parsePercentage(value) {
  const normalized = value.trim().replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)).replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit)).replace(/[٫،]/g, ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const percentage = Number(normalized);
  return Number.isFinite(percentage) && percentage > 0 ? percentage : null;
}

function percentagePrice(oldPrice, percentage, direction) {
  if (percentage === null) return { price: null, error: "درصد معتبر وارد کنید." };
  if (direction === "decrease" && percentage >= 100) return { price: null, error: "کاهش باید کمتر از ۱۰۰٪ باشد." };
  if (direction === "increase" && percentage > 1000) return { price: null, error: "افزایش نمی‌تواند بیشتر از ۱۰۰۰٪ باشد." };
  const price = Math.round(oldPrice * (1 + (direction === "increase" ? percentage : -percentage) / 100));
  if (!Number.isSafeInteger(price) || price <= 0) return { price: null, error: "قیمت نهایی معتبر نیست." };
  return { price, error: "" };
}

function StructuredPriceTable({ category, knowledge, items, onReplace, onPriceSaved }) {
  const updatedAt = formattedUpdatedAt(knowledge?.updatedAt);
  const [editingWatt, setEditingWatt] = useState(null);
  const [editMethod, setEditMethod] = useState("manual");
  const [value, setValue] = useState("");
  const [percentageValue, setPercentageValue] = useState("");
  const [percentageDirection, setPercentageDirection] = useState("increase");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  const [batchPercentageValue, setBatchPercentageValue] = useState("");
  const [batchDirection, setBatchDirection] = useState("increase");
  const [batchError, setBatchError] = useState("");
  const [batchSaving, setBatchSaving] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [addWattValue, setAddWattValue] = useState("");
  const [addPriceValue, setAddPriceValue] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [deletingWatt, setDeletingWatt] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const editingItem = items.find((item) => item.watt === editingWatt);
  const manualPrice = parseManualPrice(value);
  const percentage = parsePercentage(percentageValue);
  const percentageResult = editingItem ? percentagePrice(editingItem.price, percentage, percentageDirection) : { price: null, error: "" };
  const nextPrice = editMethod === "manual" ? manualPrice : percentageResult.price;
  const validationError = editMethod === "manual" ? (manualPrice === null ? "مبلغ معتبر وارد کنید." : "") : percentageResult.error;
  const batchPercentage = parsePercentage(batchPercentageValue);
  const batchPreview = items.map((item) => ({ item, ...percentagePrice(item.price, batchPercentage, batchDirection) }));
  const batchValidationError = batchPreview.find((entry) => entry.error)?.error || "";
  const addWatt = parseManualPrice(addWattValue);
  const addPrice = parseManualPrice(addPriceValue);
  const addValidationError = addWatt === null || addPrice === null ? "توان و مبلغ نهایی معتبر وارد کنید." : "";
  const deletingItem = items.find((item) => item.watt === deletingWatt);
  function closeEditor() {
    setEditingWatt(null); setValue(""); setPercentageValue(""); setError("");
  }
  function cancel() {
    if (!saving) closeEditor();
  }
  async function save() {
    if (!editingItem || nextPrice === null || saving) { setError(validationError || "قیمت معتبر وارد کنید."); return; }
    setSaving(true); setError("");
    try { onPriceSaved(await updateKnowledgePrice(category.id, editingItem.watt, nextPrice)); closeEditor(); }
    catch { setError("ذخیره قیمت انجام نشد. دوباره تلاش کنید."); }
    finally { setSaving(false); }
  }
  function cancelBatch() {
    if (batchSaving) return;
    setBatchMode(false); setBatchPercentageValue(""); setBatchDirection("increase"); setBatchError("");
  }
  async function saveBatch() {
    if (batchSaving || batchValidationError) { setBatchError(batchValidationError || "درصد معتبر وارد کنید."); return; }
    setBatchSaving(true); setBatchError("");
    try {
      onPriceSaved(await updateKnowledgePricesByPercentage(category.id, batchPercentage, batchDirection));
      setBatchMode(false); setBatchPercentageValue(""); setBatchDirection("increase");
    } catch { setBatchError("ذخیره تغییرات انجام نشد. دوباره تلاش کنید."); }
    finally { setBatchSaving(false); }
  }
  function cancelAdd() {
    if (addSaving) return;
    setAddMode(false); setAddWattValue(""); setAddPriceValue(""); setAddError("");
  }
  async function saveAdd() {
    if (addSaving || addValidationError) { setAddError(addValidationError); return; }
    setAddSaving(true); setAddError("");
    try {
      onPriceSaved(await addKnowledgePriceItem(category.id, addWatt, addPrice));
      setAddMode(false); setAddWattValue(""); setAddPriceValue("");
    } catch { setAddError("افزودن محصول انجام نشد. توان تکراری یا خطای سرویس را بررسی کنید."); }
    finally { setAddSaving(false); }
  }
  function cancelDelete() {
    if (!deleting) { setDeletingWatt(null); setDeleteError(""); }
  }
  async function confirmDelete() {
    if (!deletingItem || deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      onPriceSaved(await deleteKnowledgePriceItem(category.id, deletingItem.watt));
      setDeletingWatt(null);
    } catch { setDeleteError("حذف محصول انجام نشد. دوباره تلاش کنید."); }
    finally { setDeleting(false); }
  }
  return <section className="knowledge-price-table" aria-labelledby="knowledge-price-table-title">
    <div className="knowledge-price-table__header">
      <div><h3 id="knowledge-price-table-title">{category.title}</h3>{updatedAt && <p>آخرین به‌روزرسانی: {updatedAt}</p>}</div>
      <div className="knowledge-price-table__actions"><button className="knowledge-secondary-button" type="button" onClick={() => { setAddMode(true); setAddError(""); }} disabled={addSaving}>افزودن محصول</button><button className="knowledge-secondary-button" type="button" onClick={() => { setBatchMode(true); setBatchError(""); }} disabled={batchSaving}>تغییر درصدی همه قیمت‌ها</button><button className="knowledge-secondary-button" type="button" onClick={onReplace}>جایگزینی کل لیست</button></div>
    </div>
    {addMode && <div className="knowledge-batch-edit"><h4>افزودن محصول</h4><label className="knowledge-price-edit__input"><span>توان (وات)</span><input value={addWattValue} onChange={(event) => { setAddWattValue(event.target.value); setAddError(""); }} inputMode="numeric" aria-label="توان محصول جدید" /></label><label className="knowledge-price-edit__input"><span>مبلغ نهایی (تومان)</span><input value={addPriceValue} onChange={(event) => { setAddPriceValue(event.target.value); setAddError(""); }} inputMode="numeric" aria-label="قیمت محصول جدید" /></label><div className="knowledge-batch-edit__preview" aria-live="polite"><h5>پیش‌نمایش</h5>{!addValidationError ? <p>{new Intl.NumberFormat("fa-IR").format(addWatt)} وات<br />{formatAdminToman(addPrice)}</p> : <p>{addWattValue || addPriceValue ? addValidationError : "توان و مبلغ نهایی را وارد کنید."}</p>}</div>{addError && <p className="knowledge-form-error" role="alert">{addError}</p>}<div className="knowledge-modal__actions"><button type="button" className="knowledge-primary-button" disabled={addSaving} onClick={saveAdd}>{addSaving ? "در حال ذخیره..." : "تأیید و افزودن"}</button><button type="button" className="knowledge-secondary-button" disabled={addSaving} onClick={cancelAdd}>انصراف</button></div></div>}
    {deletingItem && <div className="knowledge-batch-edit knowledge-delete-confirm" role="alertdialog" aria-labelledby="delete-price-item-title"><h4 id="delete-price-item-title">حذف محصول</h4><div className="knowledge-batch-edit__preview"><p><strong>{new Intl.NumberFormat("fa-IR").format(deletingItem.watt)} وات</strong><br />{formatAdminToman(deletingItem.price)}<br />این محصول از لیست قیمت حذف خواهد شد.</p></div>{deleteError && <p className="knowledge-form-error" role="alert">{deleteError}</p>}<div className="knowledge-modal__actions"><button type="button" className="knowledge-primary-button" disabled={deleting} onClick={confirmDelete}>{deleting ? "در حال حذف..." : "تأیید حذف"}</button><button type="button" className="knowledge-secondary-button" disabled={deleting} onClick={cancelDelete}>انصراف</button></div></div>}
    {batchMode && <div className="knowledge-batch-edit"><h4>تغییر درصدی همه قیمت‌ها</h4><label className="knowledge-price-edit__input"><span>درصد</span><input value={batchPercentageValue} onChange={(event) => { setBatchPercentageValue(event.target.value); setBatchError(""); }} inputMode="decimal" aria-label="درصد تغییر همه قیمت‌ها" /></label><div role="group" aria-label="جهت تغییر همه قیمت‌ها"><label><input type="radio" name="batch-price-direction" checked={batchDirection === "increase"} onChange={() => { setBatchDirection("increase"); setBatchError(""); }} /> افزایش</label><label><input type="radio" name="batch-price-direction" checked={batchDirection === "decrease"} onChange={() => { setBatchDirection("decrease"); setBatchError(""); }} /> کاهش</label></div><div className="knowledge-batch-edit__preview" aria-live="polite"><h5>پیش‌نمایش</h5>{batchPercentage !== null && !batchValidationError ? <ul>{batchPreview.map(({ item, price }) => <li key={item.watt}><strong>{new Intl.NumberFormat("fa-IR").format(item.watt)} وات</strong><span>{formatAdminToman(item.price)} ← {formatAdminToman(price)}</span></li>)}</ul> : <p>{batchPercentageValue ? batchValidationError : "درصد و جهت تغییر را وارد کنید."}</p>}</div>{batchError && <p className="knowledge-form-error" role="alert">{batchError}</p>}<div className="knowledge-modal__actions"><button type="button" className="knowledge-primary-button" disabled={batchSaving} onClick={saveBatch}>{batchSaving ? "در حال ذخیره..." : "تأیید و ذخیره همه"}</button><button type="button" className="knowledge-secondary-button" disabled={batchSaving} onClick={cancelBatch}>انصراف</button></div></div>}
    <div className="knowledge-price-table__scroll"><table><thead><tr><th>محصول</th><th>قیمت</th><th>عملیات</th></tr></thead><tbody>{items.map((item) => <tr key={item.watt}><td>{new Intl.NumberFormat("fa-IR").format(item.watt)} وات</td><td>{formatAdminToman(item.price)}</td><td>{editingWatt === item.watt ? <div className="knowledge-price-edit">
      <fieldset className="knowledge-price-edit__methods"><legend>روش ویرایش</legend><label><input type="radio" name={`price-edit-method-${item.watt}`} checked={editMethod === "manual"} onChange={() => { setEditMethod("manual"); setError(""); }} /> مبلغ نهایی تومان</label><label><input type="radio" name={`price-edit-method-${item.watt}`} checked={editMethod === "percentage"} onChange={() => { setEditMethod("percentage"); setError(""); }} /> تغییر درصدی</label></fieldset>
      {editMethod === "manual" ? <label className="knowledge-price-edit__input"><span>مبلغ نهایی (تومان)</span><input value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} inputMode="numeric" aria-label={`قیمت جدید ${item.watt} وات`} /></label> : <div className="knowledge-price-edit__percentage"><label className="knowledge-price-edit__input"><span>درصد</span><input value={percentageValue} onChange={(event) => { setPercentageValue(event.target.value); setError(""); }} inputMode="decimal" aria-label={`درصد تغییر قیمت ${item.watt} وات`} /></label><div role="group" aria-label="جهت تغییر"><label><input type="radio" name={`price-edit-direction-${item.watt}`} checked={percentageDirection === "increase"} onChange={() => { setPercentageDirection("increase"); setError(""); }} /> افزایش</label><label><input type="radio" name={`price-edit-direction-${item.watt}`} checked={percentageDirection === "decrease"} onChange={() => { setPercentageDirection("decrease"); setError(""); }} /> کاهش</label></div></div>}
      <p className="knowledge-price-edit__preview">{editMethod === "percentage" && percentage !== null ? `${percentageDirection === "increase" ? "افزایش" : "کاهش"} ${new Intl.NumberFormat("fa-IR").format(percentage)}٪: ` : ""}{formatAdminToman(item.price)} ← {nextPrice ? formatAdminToman(nextPrice) : "—"}</p>{(error || (editMethod === "percentage" && percentageValue && validationError)) && <span role="alert">{error || validationError}</span>}<button type="button" className="knowledge-primary-button" disabled={saving} onClick={save}>{saving ? "در حال ذخیره..." : "تأیید و ذخیره"}</button><button type="button" className="knowledge-secondary-button" disabled={saving} onClick={cancel}>انصراف</button></div> : <div className="knowledge-price-row-actions"><button type="button" className="knowledge-secondary-button" onClick={() => { setEditingWatt(item.watt); setEditMethod("manual"); setValue(String(item.price)); setPercentageValue(""); setPercentageDirection("increase"); setError(""); }}>ویرایش</button><button type="button" className="knowledge-secondary-button knowledge-delete-button" onClick={() => { setDeletingWatt(item.watt); setDeleteError(""); }}>حذف</button></div>}</td></tr>)}</tbody></table></div>
  </section>;
}

export default function KnowledgeCategoryDetail({ detail, onKnowledgeSaved }) {
  if (detail.state === "loading") {
    return <section className="admin-page knowledge-detail-status"><div className="knowledge-status"><LoaderCircle className="knowledge-spinner" size={22} aria-hidden="true" /><span>در حال دریافت اطلاعات دسته...</span></div></section>;
  }

  if (detail.state === "not-found") {
    return <section className="admin-page knowledge-detail-status"><div className="knowledge-status knowledge-status--error"><CircleAlert size={22} aria-hidden="true" /><div><strong>دستهٔ موردنظر پیدا نشد.</strong><span>ممکن است این دسته دیگر در دسترس نباشد.</span></div></div></section>;
  }

  if (detail.state === "error") {
    return <section className="admin-page knowledge-detail-status"><div className="knowledge-status knowledge-status--error"><CircleAlert size={22} aria-hidden="true" /><div><strong>دریافت اطلاعات دسته انجام نشد.</strong><span>دوباره تلاش کنید.</span></div></div></section>;
  }

  return <KnowledgeCategoryEditor detail={detail} onKnowledgeSaved={onKnowledgeSaved} />;
}

function KnowledgeCategoryEditor({ detail, onKnowledgeSaved }) {

  const statusLabels = { available: "موجود / قابل فروش", out_of_stock: "ناموجود", not_sold: "عرضه نمی‌شود" };
  const [statusValue, setStatusValue] = useState(detail.category.status ?? "available");
  const [savedStatus, setSavedStatus] = useState(detail.category.status ?? "available");
  const [statusConfirming, setStatusConfirming] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [rawText, setRawText] = useState(detail.knowledge?.rawText ?? "");
  const [previewState, setPreviewState] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [previewInvalidated, setPreviewInvalidated] = useState(false);
  const [previewedRawText, setPreviewedRawText] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [replaceMode, setReplaceMode] = useState(false);
  const priceItems = detail.category.type === "price_list" ? validPriceItems(detail.knowledge) : null;
  const showStructuredPriceTable = Boolean(priceItems) && !replaceMode;
  const canSave = previewState === "valid" && preview?.valid && !previewInvalidated && previewedRawText === rawText && saveState !== "loading";

  async function saveStatus() {
    if (statusSaving || statusValue === savedStatus) return;
    setStatusSaving(true); setStatusError("");
    try { const category = await updateKnowledgeCategoryStatus(detail.category.id, statusValue); setSavedStatus(category.status); setStatusConfirming(false); }
    catch { setStatusError("ذخیره وضعیت انجام نشد. دوباره تلاش کنید."); }
    finally { setStatusSaving(false); }
  }

  function handleTextChange(event) {
    setRawText(event.target.value);
    if (preview || previewState === "valid" || previewState === "saved") {
      setPreview(null);
      setPreviewInvalidated(true);
    }
    if (previewState !== "idle") setPreviewState("idle");
    if (saveState !== "idle") setSaveState("idle");
  }

  async function handlePreview() {
    if (previewState === "loading") return;
    setPreviewState("loading");
    setPreviewInvalidated(false);
    setSaveState("idle");
    try {
      const result = await previewKnowledgeCategory(detail.category.id, rawText);
      setPreview(result);
      setPreviewState(result.valid ? "valid" : "invalid");
      setPreviewedRawText(result.valid ? rawText : null);
    } catch {
      setPreview(null);
      setPreviewState("error");
      setPreviewedRawText(null);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveState("loading");
    try {
      const result = await saveKnowledgeCategory(detail.category.id, rawText);
      if (!result.valid) {
        setPreview(result);
        setPreviewState("invalid");
        setPreviewedRawText(null);
        setSaveState("validation-error");
        return;
      }
      setPreviewInvalidated(false);
      setPreviewedRawText(rawText);
      if (result.saved && result.record) {
        onKnowledgeSaved(result.record);
        setRawText(result.record.rawText);
        setPreview(null);
        setPreviewState("saved");
        setSaveState("success");
        setReplaceMode(false);
        return;
      }
      setPreview(result);
      setPreviewState("saved");
      setSaveState("unchanged");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <section className="admin-page admin-section-page" aria-labelledby="knowledge-category-title">
      <div className="admin-page__intro">
        <p className="admin-eyebrow">دانش پایه</p>
        <h2 id="knowledge-category-title">{detail.category.title}</h2>
        <p>اطلاعات این دسته را وارد کنید و پیش از ذخیره، نتیجه را بررسی کنید.</p>
      </div>
      <section className="knowledge-batch-edit"><h4>وضعیت تجاری دسته</h4><select value={statusValue} onChange={(event) => { setStatusValue(event.target.value); setStatusConfirming(false); setStatusError(""); }} disabled={statusSaving}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{statusValue !== savedStatus && !statusConfirming && <button type="button" className="knowledge-secondary-button" onClick={() => setStatusConfirming(true)}>بررسی تغییر وضعیت</button>}{statusConfirming && <div className="knowledge-batch-edit__preview"><p>{detail.category.title}<br />{statusLabels[savedStatus]} ← {statusLabels[statusValue]}</p><button type="button" className="knowledge-primary-button" disabled={statusSaving} onClick={saveStatus}>{statusSaving ? "در حال ذخیره..." : "تأیید و ذخیره"}</button><button type="button" className="knowledge-secondary-button" disabled={statusSaving} onClick={() => { setStatusValue(savedStatus); setStatusConfirming(false); }}>انصراف</button></div>}{statusError && <p className="knowledge-form-error" role="alert">{statusError}</p>}</section>
      {showStructuredPriceTable ? <StructuredPriceTable category={detail.category} knowledge={detail.knowledge} items={priceItems} onReplace={() => setReplaceMode(true)} onPriceSaved={onKnowledgeSaved} /> : <div className="knowledge-editor">
        {detail.category.type === "price_list" && replaceMode && <button className="knowledge-secondary-button" type="button" onClick={() => setReplaceMode(false)}>بازگشت به جدول قیمت‌ها</button>}
        {detail.category.type === "price_list" && !priceItems && detail.knowledge && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />دادهٔ جدول قیمت معتبر نیست؛ لیست را با ورود متن جایگزین کنید.</p>}
        <label className="knowledge-field knowledge-editor__field"><span>اطلاعات این دسته</span><textarea dir="rtl" value={rawText} onChange={handleTextChange} disabled={previewState === "loading" || saveState === "loading"} /></label>
        <button className="knowledge-primary-button" type="button" onClick={handlePreview} disabled={previewState === "loading" || saveState === "loading"}>
          {previewState === "loading" && <LoaderCircle className="knowledge-spinner" size={18} aria-hidden="true" />}
          {previewState === "loading" ? "در حال بررسی..." : "بررسی اطلاعات"}
        </button>
        {previewState === "error" && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />بررسی اطلاعات انجام نشد. دوباره تلاش کنید.</p>}
        <KnowledgePreviewResult category={detail.category} preview={preview} rawText={rawText} invalidated={previewInvalidated} />
        {canSave && <button className="knowledge-primary-button knowledge-save-button" type="button" onClick={handleSave}>تأیید و ذخیره</button>}
        {saveState === "loading" && <button className="knowledge-primary-button knowledge-save-button" type="button" disabled><LoaderCircle className="knowledge-spinner" size={18} aria-hidden="true" />در حال ذخیره...</button>}
        {saveState === "success" && <p className="knowledge-save-message" role="status">اطلاعات با موفقیت ذخیره شد.</p>}
        {saveState === "unchanged" && <p className="knowledge-save-message" role="status">تغییری در اطلاعات ایجاد نشده است.</p>}
        {saveState === "validation-error" && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />اطلاعات ذخیره نشد. متن را اصلاح و دوباره بررسی کنید.</p>}
        {saveState === "error" && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />ذخیره اطلاعات انجام نشد. دوباره تلاش کنید.</p>}
      </div>}
    </section>
  );
}
