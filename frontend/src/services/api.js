const WORKER_URL = "https://worker.mohammad-vr200.workers.dev";

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
