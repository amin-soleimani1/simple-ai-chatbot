const WORKER_URL = import.meta.env.VITE_WORKER_URL || "https://worker.mohammad-vr200.workers.dev";

async function adminRequest(path, options = {}) {
  return fetch(`${WORKER_URL}${path}`, {
    credentials: "include",
    ...options,
  });
}

export async function sendMessage(message, history, presentationRequest) {
  const response = await fetch(`${WORKER_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history, ...(presentationRequest ? { presentationRequest } : {}) }),
  });

  if (!response.ok) {
    throw new Error("Worker request failed");
  }

  const data = await response.json();

  if (typeof data.message !== "string") {
    throw new Error("Worker response is invalid");
  }

  if (data.presentation === undefined) return { message: data.message, presentation: null };
  if (
    data.presentation?.type !== "price_table"
    || typeof data.presentation.title !== "string"
    || !Array.isArray(data.presentation.rows)
    || data.presentation.rows.some((row) => !Number.isSafeInteger(row?.watt) || row.watt <= 0 || !Number.isSafeInteger(row?.priceToman) || row.priceToman <= 0)
  ) throw new Error("Worker presentation response is invalid");

  return { message: data.message, presentation: data.presentation };
}

export async function authenticateAdmin(pin) {
  const response = await adminRequest("/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  if (response.status === 401) return false;
  if (!response.ok) throw new Error("Admin authentication failed");
  const data = await response.json();
  return data.success === true;
}

export async function getAdminSession() {
  const response = await adminRequest("/admin/session");
  if (response.status === 401) return false;
  if (!response.ok) throw new Error("Admin session check failed");
  const data = await response.json();
  return data.authenticated === true;
}

export async function logoutAdmin() {
  await adminRequest("/admin/logout", { method: "POST" });
}

async function readAdminResponse(response, fallbackMessage) {
  let data = null;
  try { data = await response.json(); } catch { /* The UI only needs a safe generic error. */ }
  if (!response.ok) {
    const error = new Error(fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function getKnowledgeCategories() {
  const response = await adminRequest("/admin/knowledge");
  const data = await readAdminResponse(response, "Unable to load knowledge categories");
  if (!Array.isArray(data?.categories)) throw new Error("Knowledge categories response is invalid");
  return data.categories;
}

export async function getKnowledgeCategoryDetail(categoryId) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}`);
  const data = await readAdminResponse(response, "Unable to load knowledge category");
  if (!data?.category || typeof data.category.title !== "string") throw new Error("Knowledge category response is invalid");
  return data;
}

export async function previewKnowledgeCategory(categoryId, rawText) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });
  let data = null;
  try { data = await response.json(); } catch { /* A safe UI error is shown below. */ }
  if (response.status === 400 && data?.valid === false) return data;
  if (!response.ok) {
    const error = new Error("Unable to preview knowledge category");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function saveKnowledgeCategory(categoryId, rawText) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });
  let data = null;
  try { data = await response.json(); } catch { /* A safe UI error is shown below. */ }
  if (response.status === 400 && data?.valid === false) return data;
  if (!response.ok) {
    const error = new Error("Unable to save knowledge category");
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function createKnowledgeCategory({ title, type }) {
  const response = await adminRequest("/admin/knowledge/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, type }),
  });
  const data = await readAdminResponse(response, "Unable to create knowledge category");
  if (!data?.category || typeof data.category.id !== "string") throw new Error("Knowledge category response is invalid");
  return data.category;
}
