import { cn } from "@/lib/utils";

export function ChatBubble({
  from,
  children,
}: {
  from: "user" | "bot";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex", from === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
          from === "user"
            ? "rounded-br-sm bg-emerald-600 text-white"
            : "rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-100",
        )}
      >
        {children}
      </div>
    </div>
  );
}
