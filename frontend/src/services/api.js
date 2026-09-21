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
    || typeof data.presentation.categoryId !== "string"
    || typeof data.presentation.title !== "string"
	|| (data.presentation.status !== undefined && !["available", "out_of_stock", "not_sold"].includes(data.presentation.status))
    || !Array.isArray(data.presentation.rows)
    || data.presentation.rows.some((row) => !Number.isSafeInteger(row?.watt) || row.watt <= 0 || !Number.isSafeInteger(row?.priceToman) || row.priceToman <= 0 || (row.available !== undefined && typeof row.available !== "boolean"))
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

export async function updateKnowledgePrice(categoryId, watt, price) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/items/${encodeURIComponent(watt)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ price }),
  });
  const data = await readAdminResponse(response, "Unable to update price");
  if (!data?.record?.parsedData?.items) throw new Error("Updated price record is invalid");
  return data.record;
}

export async function updateKnowledgePriceAvailability(categoryId, watt, available) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/items/${encodeURIComponent(watt)}/availability`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ available }),
  });
  const data = await readAdminResponse(response, "Unable to update item availability");
  if (!data?.record?.parsedData?.items) throw new Error("Updated item availability record is invalid");
  return data.record;
}

export async function updateKnowledgePricesByPercentage(categoryId, percentage, direction) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/items`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ percentage, direction }),
  });
  const data = await readAdminResponse(response, "Unable to update prices");
  if (!data?.record?.parsedData?.items) throw new Error("Updated price record is invalid");
  return data.record;
}

export async function addKnowledgePriceItem(categoryId, watt, price) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watt, price }),
  });
  const data = await readAdminResponse(response, "Unable to add price item");
  if (!data?.record?.parsedData?.items) throw new Error("Added price item record is invalid");
  return data.record;
}

export async function deleteKnowledgePriceItem(categoryId, watt) {
  const response = await adminRequest(`/admin/knowledge/${encodeURIComponent(categoryId)}/items/${encodeURIComponent(watt)}`, {
    method: "DELETE",
  });
  const data = await readAdminResponse(response, "Unable to delete price item");
  if (!data?.record?.parsedData?.items) throw new Error("Deleted price item record is invalid");
  return data.record;
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

export async function updateKnowledgeCategoryStatus(categoryId, status) {
	return updateKnowledgeCategoryMetadata(categoryId, { status });
}

export async function updateKnowledgeCategoryMetadata(categoryId, patch) {
	const response = await adminRequest(`/admin/knowledge/categories/${encodeURIComponent(categoryId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
	const data = await readAdminResponse(response, "Unable to update knowledge category");
	if (!data?.category?.id || typeof data.category.status !== "string" || typeof data.category.showInSuggestions !== "boolean" || !Number.isSafeInteger(data.category.sortOrder)) throw new Error("Updated knowledge category is invalid");
	return data.category;
}
