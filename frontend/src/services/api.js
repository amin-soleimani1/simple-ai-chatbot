const WORKER_URL = "https://worker.mohammad-vr200.workers.dev";

async function adminRequest(path, options = {}) {
  return fetch(`${WORKER_URL}${path}`, {
    credentials: "include",
    ...options,
  });
}

export async function sendMessage(message, history) {
  const response = await fetch(`${WORKER_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error("Worker request failed");
  }

  const data = await response.json();

  if (typeof data.message !== "string") {
    throw new Error("Worker response is invalid");
  }

  return data.message;
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
