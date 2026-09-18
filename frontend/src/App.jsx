import { useRef, useState } from "react";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import Header from "./components/Header";
import WelcomeModal from "./components/WelcomeModal";
import { sendMessage } from "./services/api";

function App() {
  const [messages, setMessages] = useState([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

  async function handleSend(content) {
    const text = content.trim();

    if (!text || isSendingRef.current) return;

    isSendingRef.current = true;
    setIsSending(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);

    try {
      const message = await sendMessage();
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: message }]);
    } catch {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: "خطایی در ارتباط با سرور رخ داد." }]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }
  return <main dir="rtl" className="flex min-h-dvh flex-col bg-[#171216] text-zinc-100"><Header /><ChatWindow messages={messages} onSuggestionClick={handleSend} /><ChatInput onSend={handleSend} isSending={isSending} />{showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}</main>;
}
export default App;
