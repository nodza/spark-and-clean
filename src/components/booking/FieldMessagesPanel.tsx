"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_FIELD_MESSAGE_LEN,
  type FieldMessage,
} from "@/lib/fieldMessages";

function formatMessageTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : format(parsed, "PPp");
}

type FieldMessagesPanelProps = {
  bookingId: string;
  /** Visual tone for tech van vs admin ops */
  variant?: "tech" | "admin";
  emptyLabel?: string;
  placeholder?: string;
  onThreadLoaded?: () => void;
};

export function FieldMessagesPanel({
  bookingId,
  variant = "admin",
  emptyLabel = "No field messages yet.",
  placeholder = "Message about this stop…",
  onThreadLoaded,
}: FieldMessagesPanelProps) {
  const [messages, setMessages] = useState<FieldMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Could not load messages");
        return;
      }
      const data = await res.json();
      const list: FieldMessage[] = Array.isArray(data.messages)
        ? data.messages
        : [];
      setMessages(list);
      if (variant === "tech") {
        window.dispatchEvent(new Event("tech-field-messages-read"));
      }
      onThreadLoaded?.();
    } catch {
      setError("Could not load messages");
    } finally {
      setLoading(false);
    }
  }, [bookingId, onThreadLoaded, variant]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const body = draft.trim();
    setSendError(null);
    if (!body) return;
    if (body.length > MAX_FIELD_MESSAGE_LEN) {
      setSendError(
        `Message must be at most ${MAX_FIELD_MESSAGE_LEN} characters`
      );
      return;
    }

    setSending(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(
          typeof data.error === "string" ? data.error : "Failed to send"
        );
        return;
      }
      const created = data.message as FieldMessage | undefined;
      if (created) {
        setMessages((prev) => [created, ...prev]);
      } else {
        await load();
      }
      setDraft("");
    } catch {
      setSendError("Failed to send");
    } finally {
      setSending(false);
    }
  };

  const isTech = variant === "tech";

  return (
    <div className={isTech ? "space-y-3" : "space-y-2"}>
      <div className={isTech ? "space-y-2" : "space-y-2"}>
        <Label
          htmlFor={`field-message-${bookingId}`}
          className={isTech ? "sr-only" : undefined}
        >
          Field message
        </Label>
        <Textarea
          id={`field-message-${bookingId}`}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (sendError) setSendError(null);
          }}
          placeholder={placeholder}
          maxLength={MAX_FIELD_MESSAGE_LEN}
          rows={isTech ? 3 : 3}
          className={
            isTech
              ? "rounded-[10px] border-[#e3e7ed] bg-white placeholder:text-xs"
              : "placeholder:text-xs"
          }
          aria-invalid={sendError ? true : undefined}
        />
        <div className="flex items-center justify-between gap-3">
          <p
            className={
              isTech ? "text-[11px] text-[#9aa0a6]" : "text-meta"
            }
            style={isTech ? undefined : { color: "#9aa0a6" }}
          >
            {draft.trim().length}/{MAX_FIELD_MESSAGE_LEN}
          </p>
          <Button
            type="button"
            size="sm"
            disabled={sending || !draft.trim()}
            onClick={() => void send()}
            className={isTech ? "rounded-full" : undefined}
          >
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
        {sendError ? (
          <p
            role="alert"
            className="text-sm"
            style={{ color: "#b3261e" }}
          >
            {sendError}
          </p>
        ) : null}
      </div>

      <div className={isTech ? "pt-1" : "mt-[16px]"}>
        {loading ? (
          <p
            className={isTech ? "text-sm text-[#9aa0a6]" : "text-meta"}
            style={isTech ? undefined : { color: "#9aa0a6" }}
          >
            Loading messages…
          </p>
        ) : error ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm" style={{ color: "#b3261e" }} role="alert">
              {error}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p
            className={
              isTech
                ? "text-sm italic text-[#9aa0a6]"
                : "text-meta italic"
            }
            style={isTech ? undefined : { color: "#9aa0a6" }}
          >
            {emptyLabel}
          </p>
        ) : (
          <ul className={isTech ? "space-y-2.5" : "space-y-3"}>
            {messages.map((message) => {
              const fromOps = message.authorRole === "admin";
              return (
                <li
                  key={message.id}
                  className={
                    isTech
                      ? fromOps
                        ? "rounded-[10px] border border-[#d8eee8] bg-[#eafaf5] px-3 py-3"
                        : "rounded-[10px] border border-[#e3e7ed] bg-white px-3 py-3"
                      : "rounded-[10px] border border-[#f0f2f6] bg-[#f7f9fb] px-3 py-3"
                  }
                >
                  <p
                    className={
                      isTech
                        ? "text-sm whitespace-pre-wrap text-[#32373c]"
                        : "text-body whitespace-pre-wrap"
                    }
                    style={isTech ? undefined : { color: "#32373c" }}
                  >
                    {message.body}
                  </p>
                  <p
                    className={
                      isTech ? "mt-2 text-[11px] text-[#9aa0a6]" : "text-meta mt-2"
                    }
                    style={isTech ? undefined : { color: "#9aa0a6" }}
                  >
                    {fromOps ? "Ops" : "Driver"} · {message.authorName} ·{" "}
                    {formatMessageTime(message.createdAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
