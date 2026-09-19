import { useEffect, useRef, useState } from "react";
import AdminAccessModal from "./components/AdminAccessModal";
import ChatInput from "./components/ChatInput";
import ChatWindow from "./components/ChatWindow";
import Header from "./components/Header";
import WelcomeModal from "./components/WelcomeModal";
import { authenticateAdmin, getAdminSession, sendMessage } from "./services/api";
import AdminPanel from "./admin/AdminPanel";
import { getAdminPath, navigateTo, replaceTo, restoreAdminRoute } from "./admin/adminRoutes";

restoreAdminRoute();

function ChatbotApp() {
  const [messages, setMessages] = useState([]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const [adminAccessOpen, setAdminAccessOpen] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  useEffect(() => {
    if (!showAccessDenied) return undefined;
    const timeoutId = window.setTimeout(() => setShowAccessDenied(false), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [showAccessDenied]);

  async function handleSend(content) {
    const text = content.trim();

    if (!text || isSendingRef.current) return;

    const history = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-6)
      .map(({ role, content: previousContent }) => ({ role, content: previousContent }));

    isSendingRef.current = true;
    setIsSending(true);
    setMessages((items) => [...items, { id: crypto.randomUUID(), role: "user", content: text }]);

    try {
      const message = await sendMessage(text, history);
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: message }]);
    } catch {
      setMessages((items) => [...items, { id: crypto.randomUUID(), role: "assistant", content: "خطایی در ارتباط با سرور رخ داد." }]);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }
  function closeAdminAccess() { setAdminAccessOpen(false); }
  function denyAdminAccess() { setAdminAccessOpen(false); setShowAccessDenied(true); }
  async function grantAdminAccess(pin) {
    const authenticated = await authenticateAdmin(pin);
    if (authenticated) {
      setAdminAccessOpen(false);
      navigateTo("/admin");
    }
    return authenticated;
  }

  return <main dir="rtl" className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#171216] text-zinc-100"><Header onAdminClick={() => setAdminAccessOpen(true)} /><ChatWindow messages={messages} onSuggestionClick={handleSend} /><ChatInput onSend={handleSend} isSending={isSending} />{showWelcomeModal && <WelcomeModal onClose={() => setShowWelcomeModal(false)} />}{showAccessDenied && <div className="fixed inset-x-4 top-4 z-[70] mx-auto w-fit max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#3a1722] px-4 py-3 text-center text-sm text-zinc-100 shadow-xl shadow-black/40" role="status">متأسفم، دسترسی برای شما امکان‌پذیر نیست</div>}{adminAccessOpen && <AdminAccessModal onClose={closeAdminAccess} onDenied={denyAdminAccess} onGranted={grantAdminAccess} />}</main>;
}

function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(() => getAdminPath(window.location.pathname).startsWith("/admin"));
  const [adminSessionState, setAdminSessionState] = useState(() => (
    getAdminPath(window.location.pathname).startsWith("/admin") ? "checking" : "idle"
  ));
  const isAdminRouteRef = useRef(isAdminRoute);

  useEffect(() => {
    const updateRoute = () => {
      const nextIsAdminRoute = getAdminPath(window.location.pathname).startsWith("/admin");
      if (nextIsAdminRoute && !isAdminRouteRef.current) setAdminSessionState("checking");
      isAdminRouteRef.current = nextIsAdminRoute;
      setIsAdminRoute(nextIsAdminRoute);
    };
    window.addEventListener("popstate", updateRoute);
    return () => window.removeEventListener("popstate", updateRoute);
  }, []);

  useEffect(() => {
    if (!isAdminRoute) return undefined;
    let active = true;
    getAdminSession().then((authenticated) => {
      if (!active) return;
      if (authenticated) setAdminSessionState("authenticated");
      else replaceTo("/");
    }).catch(() => { if (active) replaceTo("/"); });
    return () => { active = false; };
  }, [isAdminRoute]);

  if (isAdminRoute && adminSessionState !== "authenticated") return <main className="grid min-h-dvh place-items-center bg-[#210c14] text-sm text-zinc-300" dir="rtl">در حال بررسی دسترسی...</main>;
  return isAdminRoute ? <AdminPanel onLogout={() => replaceTo("/")} /> : <ChatbotApp />;
}

export default App;
