"use client";

import { useState } from "react";

export default function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // noop
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 active:scale-95 ${className}`}
      aria-label="Copiar"
    >
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}



