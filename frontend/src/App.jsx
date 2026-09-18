import { useState } from "react";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import Header from "./components/Header";
import WelcomeModal from "./components/WelcomeModal";

function App() {
  const [messages, setMessages] = useState([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  function handleSend(content) {
    const text = content.trim();
    if (text) setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);
  }
  return <main dir="rtl" className="flex min-h-dvh flex-col bg-[#171216] text-zinc-100"><Header /><ChatWindow messages={messages} onSuggestionClick={handleSend} /><ChatInput onSend={handleSend} />{showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}</main>;
}
export default App;
