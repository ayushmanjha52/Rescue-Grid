"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import TargetSelector, { type BroadcastTargetValue } from "@/components/dma/broadcast/TargetSelector";
import ConfirmModal from "@/components/dma/broadcast/ConfirmModal";

interface TaskForce {
  id: string;
  name: string;
  status: string;
  member_count?: number;
}

const MAX_LENGTH = 500;

const TEMPLATES = [
  "Flash flood warning: move to higher ground immediately and report your status.",
  "All units: report current location and availability to Command within 15 minutes.",
  "Road closure update: avoid the affected route, use alternate routes.",
  "Shift change at 18:00. Off-duty volunteers please check in before leaving.",
];

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<BroadcastTargetValue>("all_volunteers");
  const [selectedTaskForceId, setSelectedTaskForceId] = useState("");
  const [taskForces, setTaskForces] = useState<TaskForce[]>([]);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dma/taskforce/list")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setTaskForces(Array.isArray(data) ? data.filter((tf: TaskForce) => tf.status === "active") : []))
      .catch(() => setTaskForces([]))
      .finally(() => setLoading(false));
  }, []);

  const needsTaskForce = target === "specific_task_force" && !selectedTaskForceId;

  // Recipient preview — ignores responses that arrive after the target changed.
  useEffect(() => {
    if (needsTaskForce) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ target });
    if (target === "specific_task_force") params.append("taskForceId", selectedTaskForceId);

    fetch(`/api/dma/broadcast/preview?${params}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setRecipientCount(typeof data.count === "number" ? data.count : 0))
      .catch(() => {
        if (!controller.signal.aborted) setRecipientCount(0);
      });

    return () => controller.abort();
  }, [target, selectedTaskForceId, needsTaskForce]);

  const shownCount = needsTaskForce ? 0 : recipientCount;

  const handleBroadcast = () => {
    if (!message.trim()) {
      setError("Message is required");
      return;
    }
    setError("");
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    setIsSending(true);
    setError("");

    try {
      const res = await fetch("/api/dma/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          target,
          ...(target === "specific_task_force" ? { taskForceId: selectedTaskForceId } : {}),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send broadcast");

      setSuccessMessage(data.message || "Broadcast sent");
      setShowConfirmModal(false);
      setMessage("");
      setTimeout(() => setSuccessMessage(""), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send broadcast");
      setShowConfirmModal(false);
    } finally {
      setIsSending(false);
    }
  };

  const isValid = message.trim().length > 0 && (shownCount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-surface-2">
      <div className="pt-[52px] flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-xl mt-6">
          <h1 className="font-inter font-bold text-2xl text-alert uppercase tracking-wider text-center mb-2">EMERGENCY BROADCAST</h1>
          <p className="font-ibm-mono text-[11px] text-dim text-center mb-8">
            Delivered to each volunteer&apos;s inbox and as a push notification.
          </p>

          {successMessage && (
            <div className="bg-ops/10 border border-ops/35 p-4 mb-6 rounded-sm" role="status">
              <p className="font-inter text-ops text-sm text-center uppercase tracking-wider">✓ {successMessage}</p>
            </div>
          )}

          <div className="bg-surface-1 p-6 border border-border-dim rounded-sm shadow-sm">
            <div className="mb-6">
              <label htmlFor="broadcast-message" className="font-inter text-xs text-muted uppercase tracking-[0.14em] block mb-2">MESSAGE</label>
              <textarea
                id="broadcast-message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setError("");
                }}
                placeholder="Enter emergency broadcast message..."
                rows={6}
                maxLength={MAX_LENGTH}
                className="w-full px-3 py-3 bg-surface-2 border border-border-dim rounded-sm font-inter text-base text-ink placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-alert/20 focus:border-alert resize-none"
              />
              <div className="flex justify-between mt-2">
                {error ? <p className="font-ibm-mono text-xs text-alert" role="alert">{error}</p> : <span />}
                <span className={`font-ibm-mono text-xs ${message.length > MAX_LENGTH - 50 ? "text-alert" : "text-dim"}`}>
                  {message.length}/{MAX_LENGTH}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template}
                    type="button"
                    onClick={() => setMessage(template)}
                    className="px-2 py-1 bg-surface-3 hover:bg-orange/10 font-ibm-mono text-[10px] text-muted rounded-sm text-left"
                    title={template}
                  >
                    {template.slice(0, 28)}…
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              {loading ? (
                <div className="font-inter text-dim text-xs">Loading task forces...</div>
              ) : (
                <TargetSelector
                  target={target}
                  onTargetChange={setTarget}
                  taskForces={taskForces}
                  selectedTaskForceId={selectedTaskForceId}
                  onTaskForceChange={setSelectedTaskForceId}
                />
              )}
            </div>

            <div className="bg-surface-2 p-3 mb-6 rounded-sm border border-border-dim">
              <p className="font-inter text-xs text-dim uppercase tracking-wider">Recipients:</p>
              <p className="font-ibm-mono text-xl text-ink mt-1">
                {shownCount === null ? "…" : `${shownCount} volunteer${shownCount !== 1 ? "s" : ""}`}
              </p>
            </div>

            <Button variant="critical" onClick={handleBroadcast} disabled={!isValid || isSending} className="w-full">
              BROADCAST NOW
            </Button>

            {!isValid && message.trim().length > 0 && shownCount === 0 && (
              <p className="font-inter text-xs text-caution text-center mt-2">
                {needsTaskForce ? "Please select a task force" : "No recipients match this target"}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        recipientCount={shownCount ?? 0}
        message={message}
        isSending={isSending}
      />
    </div>
  );
}
