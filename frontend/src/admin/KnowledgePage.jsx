import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, CircleAlert, LoaderCircle, Plus, X } from "lucide-react";
import { createKnowledgeCategory, getKnowledgeCategories } from "../services/api";

const categoryTypes = [
  {
    value: "price_list",
    label: "لیست محصولات و قیمت‌ها",
    description: "مناسب برای لامپ، پروژکتور، تعمیرات و موارد مشابه",
  },
  {
    value: "per_watt_price",
    label: "قیمت بر اساس وات",
    description: "مناسب برای مواردی که قیمت از روی تعداد وات محاسبه می‌شود",
  },
  {
    value: "text",
    label: "اطلاعات متنی",
    description: "مناسب برای توضیحات یا اطلاعات بدون ساختار قیمت",
  },
];

function CreateCategoryModal({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canSubmit = title.trim().length > 0 && Boolean(type) && !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const category = await createKnowledgeCategory({ title: title.trim(), type });
      onCreated(category);
    } catch (requestError) {
      setError(requestError.status === 409
        ? "دسته‌ای با این نام از قبل وجود دارد."
        : "ایجاد دسته انجام نشد. دوباره تلاش کنید.");
      setSubmitting(false);
    }
  }

  return (
    <div className="knowledge-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="knowledge-modal" role="dialog" aria-modal="true" aria-labelledby="create-category-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="knowledge-modal__header">
          <div><p className="admin-eyebrow">دانش پایه</p><h2 id="create-category-title">افزودن دسته جدید</h2></div>
          <button className="admin-icon-button" type="button" onClick={onClose} disabled={submitting} aria-label="بستن پنجره"><X size={22} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <label className="knowledge-field">
            <span>نام دسته</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={submitting} maxLength={120} autoFocus />
          </label>
          <fieldset className="knowledge-type-fieldset" disabled={submitting}>
            <legend>نوع اطلاعات</legend>
            <div className="knowledge-type-options">
              {categoryTypes.map((option) => (
                <label className={`knowledge-type-option ${type === option.value ? "is-selected" : ""}`} key={option.value}>
                  <input type="radio" name="knowledge-type" value={option.value} checked={type === option.value} onChange={(event) => setType(event.target.value)} />
                  <span><strong>{option.label}</strong><small>{option.description}</small></span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && <p className="knowledge-form-error" role="alert"><CircleAlert size={17} aria-hidden="true" />{error}</p>}
          <div className="knowledge-modal__actions">
            <button className="knowledge-secondary-button" type="button" onClick={onClose} disabled={submitting}>انصراف</button>
            <button className="knowledge-primary-button" type="submit" disabled={!canSubmit}>
              {submitting && <LoaderCircle className="knowledge-spinner" size={18} aria-hidden="true" />}
              {submitting ? "در حال ایجاد..." : "ایجاد دسته"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function KnowledgePage({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [state, setState] = useState("loading");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    getKnowledgeCategories()
      .then((items) => { if (active) { setCategories(items); setState("ready"); } })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  function handleCreated(category) {
    setCategories((items) => [...items, category]);
    setModalOpen(false);
    onNavigate(`/admin/knowledge/${category.id}`);
  }

  return (
    <section className="admin-page knowledge-page" aria-labelledby="knowledge-page-title">
      <div className="knowledge-page__heading">
        <div className="admin-page__intro"><p className="admin-eyebrow">مدیریت اطلاعات دستیار</p><h2 id="knowledge-page-title">دانش پایه</h2><p>دسته‌های اطلاعاتی دستیار را مدیریت کنید.</p></div>
        <button className="knowledge-primary-button knowledge-add-button" type="button" onClick={() => setModalOpen(true)}><Plus size={19} aria-hidden="true" />افزودن دسته جدید</button>
      </div>

      {state === "loading" && <div className="knowledge-status"><LoaderCircle className="knowledge-spinner" size={22} aria-hidden="true" /><span>در حال دریافت دسته‌ها...</span></div>}
      {state === "error" && <div className="knowledge-status knowledge-status--error"><CircleAlert size={22} aria-hidden="true" /><div><strong>دریافت دسته‌ها انجام نشد.</strong><span>دوباره تلاش کنید.</span></div></div>}
      {state === "ready" && categories.length === 0 && <div className="knowledge-status"><BookOpen size={24} aria-hidden="true" /><span>هنوز دسته‌ای برای نمایش وجود ندارد.</span></div>}
      {state === "ready" && categories.length > 0 && <div className="knowledge-category-grid">
        {categories.map((category) => <button className="knowledge-category-card" type="button" key={category.id} onClick={() => onNavigate(`/admin/knowledge/${category.id}`)}>
          <span className="knowledge-category-card__icon"><BookOpen size={22} aria-hidden="true" /></span>
          <strong>{category.title}</strong>
          <ChevronLeft className="knowledge-category-card__arrow" size={20} aria-hidden="true" />
        </button>)}
      </div>}
      {modalOpen && <CreateCategoryModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />}
    </section>
  );
}
