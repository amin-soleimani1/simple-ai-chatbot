import { useState } from "react";

function App() {
  const [message, setMessage] = useState("");

  async function testWorker() {
    try {
      const response = await fetch(
        "https://worker.mohammad-vr200.workers.dev"
      );

      const data = await response.json();

      setMessage(data.message);

    } catch (error) {
      setMessage("Error connecting to Worker");
      console.error(error);
    }
  }

  return (
    <div>
      <h1>Simple Chatbot Test</h1>

      <button onClick={testWorker}>
        Test Backend
      </button>

      <p>{message}</p>
    </div>
  );
}

export default App;