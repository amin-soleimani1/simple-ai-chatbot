import { useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { previewKnowledgeCategory, saveKnowledgeCategory } from "../services/api";
import KnowledgePreviewResult from "./KnowledgePreviewResult";

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
  const [rawText, setRawText] = useState(detail.knowledge?.rawText ?? "");
  const [previewState, setPreviewState] = useState("idle");
  const [preview, setPreview] = useState(null);
  const [previewInvalidated, setPreviewInvalidated] = useState(false);
  const [previewedRawText, setPreviewedRawText] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const canSave = previewState === "valid" && preview?.valid && !previewInvalidated && previewedRawText === rawText && saveState !== "loading";

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
      <div className="knowledge-editor">
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
      </div>
    </section>
  );
}
