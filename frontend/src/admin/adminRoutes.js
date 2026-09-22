export const adminSections = [
  { path: "/admin", label: "داشبورد", title: "پنل مدیریت" },
  { path: "/admin/knowledge", label: "دانش پایه", title: "دانش پایه", description: "مدیریت اطلاعات دستیار" },
  { path: "/admin/market-reference", label: "قیمت مرجع بازار", title: "قیمت مرجع بازار", description: "ثبت و بررسی قیمت‌های مرجع بازار" },
  { path: "/admin/store", label: "اطلاعات فروشگاه", title: "اطلاعات فروشگاه", description: "تماس، آدرس و ساعات کاری" },
  { path: "/admin/ai", label: "رفتار AI", title: "رفتار AI", description: "نحوه پاسخ‌گویی دستیار" },
  { path: "/admin/appearance", label: "ظاهر برنامه", title: "ظاهر برنامه", description: "حالت روشن و تیره" },
  { path: "/admin/suggestions", label: "دکمه‌های پیشنهادی", title: "دکمه‌های پیشنهادی", description: "مدیریت پیشنهادها" },
];

export function getAdminPath(pathname) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const path = base && pathname.startsWith(base) ? pathname.slice(base.length) || "/" : pathname;
  return path.replace(/\/$/, "") || "/";
}

export function navigateTo(path) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.history.pushState({}, "", `${base}${path}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function replaceTo(path) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  window.history.replaceState({}, "", `${base}${path}`);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function restoreAdminRoute() {
  const savedPath = window.sessionStorage.getItem("admin-route");
  if (!savedPath) return;

  window.sessionStorage.removeItem("admin-route");
  window.history.replaceState({}, "", savedPath);
}
