const WORKER_URL = "https://worker.mohammad-vr200.workers.dev";

export async function sendMessage() {
  const response = await fetch(WORKER_URL);

  if (!response.ok) {
    throw new Error("Worker request failed");
  }

  const data = await response.json();

  if (typeof data.message !== "string") {
    throw new Error("Worker response is invalid");
  }

  return data.message;
}
