import { useEffect, useState } from "react";
import {
  Bot, BrainCircuit, ChevronLeft, LogOut, Menu, Palette, PanelTop,
  Store, X,
} from "lucide-react";
import { adminSections, getAdminPath, navigateTo } from "./adminRoutes";
import { logoutAdmin } from "../services/api";
import "./admin.css";

const icons = [PanelTop, BrainCircuit, Store, Bot, Palette, Menu];

function AdminNav({ activePath, onNavigate }) {
  return (
    <nav className="admin-nav" aria-label="ناوبری پنل مدیریت">
      {adminSections.map((section, index) => {
        const Icon = icons[index];
        return (
          <button
            className={`admin-nav__link ${activePath === section.path ? "is-active" : ""}`}
            key={section.path}
            onClick={() => onNavigate(section.path)}
            type="button"
          >
            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function AdminHeader({ title, onLogout, onMenu }) {
  return (
    <header className="admin-header">
      <button className="admin-icon-button admin-header__menu" type="button" onClick={onMenu} aria-label="باز کردن منو">
        <Menu size={23} aria-hidden="true" />
      </button>
      <h1>{title}</h1>
      <button className="admin-logout" type="button" onClick={onLogout} aria-label="خروج از پنل">
        <LogOut size={18} aria-hidden="true" />
        <span>خروج</span>
      </button>
    </header>
  );
}

function Dashboard({ onNavigate }) {
  return (
    <section className="admin-page" aria-labelledby="admin-dashboard-title">
      <div className="admin-page__intro">
        <p className="admin-eyebrow">مدیریت دستیار</p>
        <h2 id="admin-dashboard-title">خوش آمدید</h2>
        <p>بخش موردنظر خود را برای مدیریت تنظیمات انتخاب کنید.</p>
      </div>
      <div className="admin-card-grid">
        {adminSections.slice(1).map((section, index) => {
          const Icon = icons[index + 1];
          return (
            <button className="admin-dashboard-card" key={section.path} type="button" onClick={() => onNavigate(section.path)}>
              <span className="admin-card-icon"><Icon aria-hidden="true" size={24} strokeWidth={1.7} /></span>
              <span className="admin-card-content"><strong>{section.label}</strong><small>{section.description}</small></span>
              <ChevronLeft className="admin-card-arrow" aria-hidden="true" size={21} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SectionPlaceholder({ section }) {
  return (
    <section className="admin-page admin-section-page" aria-labelledby="admin-section-title">
      <div className="admin-page__intro">
        <p className="admin-eyebrow">تنظیمات</p>
        <h2 id="admin-section-title">{section.title}</h2>
        <p>{section.description}</p>
      </div>
      <div className="admin-placeholder">
        <span className="admin-placeholder__mark" aria-hidden="true" />
        <h3>این بخش به‌زودی آماده می‌شود</h3>
        <p>فضای این صفحه برای ابزارها و تنظیمات مربوط به {section.title} در نظر گرفته شده است.</p>
      </div>
    </section>
  );
}

export default function AdminPanel({ onLogout }) {
  const [path, setPath] = useState(() => getAdminPath(window.location.pathname));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const section = adminSections.find((item) => item.path === path) || adminSections[0];

  useEffect(() => {
    const handlePopState = () => setPath(getAdminPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleNavigate(nextPath) {
    navigateTo(nextPath);
    setPath(nextPath);
    setDrawerOpen(false);
  }

  async function handleLogout() {
    try { await logoutAdmin(); } finally { onLogout(); }
  }

  return (
    <main className="admin-shell" dir="rtl">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="admin-brand__symbol">ک</span><span>پنل مدیریت</span></div>
        <AdminNav activePath={section.path} onNavigate={handleNavigate} />
      </aside>
      <div className="admin-main">
        <AdminHeader
          title={section.path === "/admin" ? "پنل مدیریت" : section.title}
          onLogout={handleLogout}
          onMenu={() => setDrawerOpen(true)}
        />
        <div className="admin-content">{section.path === "/admin" ? <Dashboard onNavigate={handleNavigate} /> : <SectionPlaceholder section={section} />}</div>
      </div>
      {drawerOpen && <div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}
      <aside className={`admin-drawer ${drawerOpen ? "is-open" : ""}`} aria-hidden={!drawerOpen}>
        <div className="admin-drawer__header"><div className="admin-brand"><span className="admin-brand__symbol">ک</span><span>پنل مدیریت</span></div><button className="admin-icon-button" type="button" onClick={() => setDrawerOpen(false)} aria-label="بستن منو"><X size={22} /></button></div>
        <AdminNav activePath={section.path} onNavigate={handleNavigate} />
      </aside>
    </main>
  );
}
