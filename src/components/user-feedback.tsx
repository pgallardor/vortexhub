"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const feedbackStorageKey = "vortexhub:queued-feedback";
const feedbackEventName = "vortexhub:user-feedback";

type FeedbackTone = "success" | "error" | "info" | "warning";

type FeedbackAction = {
  label: string;
  href: string;
};

export type UserFeedback = {
  id?: string;
  tone: FeedbackTone;
  title: string;
  description?: string;
  action?: FeedbackAction;
};

type StoredFeedback = UserFeedback & {
  id: string;
  createdAt: number;
};

function feedbackId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeFeedback(feedback: UserFeedback): StoredFeedback {
  return {
    ...feedback,
    id: feedback.id ?? feedbackId(),
    createdAt: Date.now(),
  };
}

function readQueuedFeedback() {
  try {
    const raw = window.sessionStorage.getItem(feedbackStorageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as StoredFeedback[] : [];
  } catch {
    return [];
  }
}

function writeQueuedFeedback(messages: StoredFeedback[]) {
  window.sessionStorage.setItem(feedbackStorageKey, JSON.stringify(messages.slice(-6)));
}

export function queueUserFeedback(feedback: UserFeedback, options?: { deliverNow?: boolean }) {
  if (typeof window === "undefined") return;

  const nextFeedback = normalizeFeedback(feedback);
  if (options?.deliverNow) {
    window.dispatchEvent(new CustomEvent<StoredFeedback>(feedbackEventName, { detail: nextFeedback }));
    return;
  }

  writeQueuedFeedback([...readQueuedFeedback(), nextFeedback]);
}

function toneLabel(tone: FeedbackTone) {
  if (tone === "success") return "Listo";
  if (tone === "error") return "Revisar";
  if (tone === "warning") return "Atención";
  return "Info";
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [toasts, setToasts] = useState<StoredFeedback[]>([]);

  useEffect(() => {
    function showFeedback(event: Event) {
      const message = (event as CustomEvent<StoredFeedback>).detail;
      if (!message) return;

      setToasts((current) => [...current, message].slice(-4));
    }

    window.addEventListener(feedbackEventName, showFeedback);
    return () => window.removeEventListener(feedbackEventName, showFeedback);
  }, []);

  useEffect(() => {
    const messages = readQueuedFeedback();
    window.sessionStorage.removeItem(feedbackStorageKey);

    if (messages.length) {
      setToasts((current) => [...current, ...messages].slice(-4));
    }
  }, [pathname]);

  useEffect(() => {
    if (!toasts.length) return;

    const timers = toasts.map((toast) => window.setTimeout(() => {
      setToasts((current) => current.filter((message) => message.id !== toast.id));
    }, 6200));

    return () => timers.forEach(window.clearTimeout);
  }, [toasts]);

  return (
    <>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions text">
        {toasts.map((toast) => (
          <section className={`toast-message feedback-${toast.tone}`} key={toast.id}>
            <div>
              <span>{toneLabel(toast.tone)}</span>
              <h2>{toast.title}</h2>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            {toast.action ? (
              <Link className="toast-action" href={toast.action.href}>{toast.action.label}</Link>
            ) : null}
            <button
              aria-label="Cerrar aviso"
              className="toast-close"
              onClick={() => setToasts((current) => current.filter((message) => message.id !== toast.id))}
              type="button"
            >
              ×
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
