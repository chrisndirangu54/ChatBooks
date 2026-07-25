"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useDashboard } from "@/lib/dashboard-context";
import { transactionAI } from "@/lib/ai";
import { receiptOCR } from "@/lib/ocr/receiptParser";
import { addTransaction, updateTransaction } from "@/lib/data/transactions";
import { formatCurrency, startOfCurrentWeek, summarizeTotals } from "@/lib/utils";
import { ChatBubble } from "@/components/chat/ChatBubble";
import { ConfirmCard } from "@/components/chat/ConfirmCard";
import type { ParsedTransaction } from "@/types";

interface ChatMessage {
  id: string;
  from: "user" | "bot";
  text?: string;
  pendingConfirm?: { parsed: ParsedTransaction; editId?: string; receiptUrl?: string };
  imageUrl?: string;
}

let messageCounter = 0;
function nextId() {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

async function uploadReceipt(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `receipts/${uid}/${Date.now()}-${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

const WELCOME: ChatMessage = {
  id: "welcome",
  from: "bot",
  text:
    "Hi! Tell me about a sale or expense — e.g. \"Sold rice 1500\" or \"Bought milk 200\". You can also attach a receipt photo, or type \"edit last transaction\" to fix your most recent entry.",
};

export default function ChatPage() {
  const { user } = useAuth();
  const { profile, transactions } = useDashboard();
  const currency = profile?.currency || "USD";
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const pushBot = (text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), from: "bot", text }]);
  };

  const pushConfirm = (parsed: ParsedTransaction, editId?: string, receiptUrl?: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nextId(), from: "bot", pendingConfirm: { parsed, editId, receiptUrl } },
    ]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput("");
    setMessages((prev) => [...prev, { id: nextId(), from: "user", text }]);
    setSending(true);

    try {
      const lower = text.toLowerCase();

      if (lower.includes("edit last")) {
        const last = transactions[0];
        if (!last) {
          pushBot("You don't have any transactions yet to edit.");
        } else {
          pushBot("Here's your most recent entry — edit and save:");
          pushConfirm(
            {
              type: last.type,
              amount: last.amount,
              category: last.category,
              note: last.note,
              confidence: 1,
            },
            last.id,
          );
        }
        return;
      }

      if (lower.includes("report") || lower.includes("summary") || lower.includes("this week")) {
        const weekStart = startOfCurrentWeek();
        const weekTx = transactions.filter((t) => t.createdAt >= weekStart);
        const { sales, expenses, profit } = summarizeTotals(weekTx);
        pushBot(
          `This week — Sales: ${formatCurrency(sales, currency)}. Expenses: ${formatCurrency(expenses, currency)}. Profit: ${formatCurrency(profit, currency)}.\n\nWant the full PDF? Head to the Reports tab.`,
        );
        return;
      }

      const parsed = await transactionAI.parseMessage(text, profile?.categories || []);
      if (!parsed) {
        pushBot('I couldn\'t find an amount in that. Try something like "Sold rice 1500".');
        return;
      }

      if (parsed.confidence >= 0.75) {
        await addTransaction(user.uid, {
          type: parsed.type,
          amount: parsed.amount,
          category: parsed.category,
          note: parsed.note,
          source: "chat",
          confidence: parsed.confidence,
          createdAt: Date.now(),
        });
        pushBot(
          `Saved — ${parsed.type === "sale" ? "Sale" : "Expense"}: ${formatCurrency(parsed.amount, currency)}${
            parsed.note ? ` (${parsed.note})` : ""
          }.`,
        );
      } else {
        pushConfirm(parsed);
      }
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async (parsed: ParsedTransaction, editId?: string, receiptUrl?: string) => {
    if (!user) return;
    const savedAt = Date.now();
    if (editId) {
      await updateTransaction(user.uid, editId, {
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        note: parsed.note,
        confidence: 1,
      });
      pushBot("Updated ✅");
    } else {
      await addTransaction(user.uid, {
        type: parsed.type,
        amount: parsed.amount,
        category: parsed.category,
        note: parsed.note,
        source: receiptUrl ? "receipt" : "chat",
        confidence: 1,
        createdAt: savedAt,
        ...(receiptUrl ? { receiptUrl } : {}),
      });
      pushBot("Saved ✅");
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;

    const imageUrl = URL.createObjectURL(file);
    setMessages((prev) => [...prev, { id: nextId(), from: "user", imageUrl }]);
    setSending(true);
    try {
      const [parsed, receiptUrl] = await Promise.all([
        receiptOCR.parseReceipt(file),
        uploadReceipt(user.uid, file),
      ]);
      pushBot(
        `I see ${formatCurrency(parsed.amount, currency)} from ${parsed.note.replace("Receipt from ", "")}. Save as expense?`,
      );
      pushConfirm(parsed, undefined, receiptUrl);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatBubble key={message.id} from={message.from}>
            {message.imageUrl && (
              <img src={message.imageUrl} alt="Receipt" className="mb-1 max-w-[200px] rounded-lg" />
            )}
            {message.text && <span className="whitespace-pre-line">{message.text}</span>}
            {message.pendingConfirm && (
              <ConfirmCard
                parsed={message.pendingConfirm.parsed}
                currency={currency}
                onConfirm={(edited) =>
                  handleConfirm(edited, message.pendingConfirm?.editId, message.pendingConfirm?.receiptUrl)
                }
                onDismiss={() => pushBot("Okay, discarded.")}
              />
            )}
          </ChatBubble>
        ))}
        {sending && (
          <ChatBubble from="bot">
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </span>
          </ChatBubble>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200 bg-white p-3">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          title="Attach a receipt"
        >
          <Paperclip size={20} />
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder='Try "Sold rice 1500"'
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
