"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import TargetSelector from "@/components/dma/broadcast/TargetSelector";
import ConfirmModal from "@/components/dma/broadcast/ConfirmModal";

interface TaskForce {
  id: string;
  name: string;
  member_count?: number;
}

export default function BroadcastPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<"all_volunteers" | "specific_task_force" | "everyone">("all_volunteers");
  const [selectedTaskForceId, setSelectedTaskForceId] = useState("");
  const [taskForces, setTaskForces] = useState<TaskForce[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTaskForces();
  }, []);

  useEffect(() => {
    loadRecipientCount();
  }, [target, selectedTaskForceId]);

  const loadTaskForces = async () => {
    try {
      const res = await fetch("/api/dma/taskforce/list");
      const data = await res.json();
      setTaskForces(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load task forces:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipientCount = async () => {
    if (target !== "specific_task_force" || selectedTaskForceId) {
      try {
        const params = new URLSearchParams({ target });
        if (target === "specific_task_force" && selectedTaskForceId) {
          params.append("taskForceId", selectedTaskForceId);
        }
        const res = await fetch(`/api/dma/broadcast/preview?${params}`);
        const data = await res.json();
        setRecipientCount(data.count || 0);
      } catch (err) {
        console.error("Failed to load recipient count:", err);
        setRecipientCount(0);
      }
    } else {
      setRecipientCount(0);
    }
  };

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
      const body: Record<string, string> = { message: message.trim(), target };
      if (target === "specific_task_force") {
        body.taskForceId = selectedTaskForceId;
      }

      const res = await fetch("/api/dma/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send broadcast");
      }

      setSuccess(true);
      setShowConfirmModal(false);
      setMessage("");
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send broadcast");
      setShowConfirmModal(false);
    } finally {
      setIsSending(false);
    }
  };

  const isValid = message.trim().length > 0 && recipientCount > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pt-[52px] flex flex-col items-center justify-start px-4 py-8">
        <div className="w-full max-w-xl">
          <h1 className="font-inter font-bold text-2xl text-red-500 uppercase tracking-wider text-center mb-8">
            EMERGENCY BROADCAST
          </h1>

          {success && (
            <div className="bg-green-50 border border-green-200 p-4 mb-6 rounded-sm">
              <p className="font-inter text-green-600 text-sm text-center uppercase tracking-wider">
                Broadcast sent successfully
              </p>
            </div>
          )}

          <div className="bg-white p-6 border border-gray-200 rounded-sm shadow-sm">
            <div className="mb-6">
              <label className="font-inter text-xs text-orange uppercase tracking-[0.2em] block mb-2">
                MESSAGE
              </label>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setError("");
                }}
                placeholder="Enter emergency broadcast message..."
                rows={6}
                maxLength={500}
                className="w-full px-3 py-3 bg-gray-50 border border-gray-200 rounded-sm font-inter text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
              <div className="flex justify-between mt-2">
                {error ? (
                  <p className="font-ibm-mono text-xs text-red-500">{error}</p>
                ) : (
                  <span />
                )}
                <span className={`font-ibm-mono text-xs ${message.length > 450 ? "text-red-500" : "text-gray-400"}`}>
                  {message.length}/500
                </span>
              </div>
            </div>

            <div className="mb-6">
              {loading ? (
                <div className="font-inter text-gray-400 text-xs">Loading task forces...</div>
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

            <div className="bg-gray-50 p-3 mb-6 rounded-sm border border-gray-100">
              <p className="font-inter text-xs text-gray-400 uppercase tracking-wider">
                Recipients:
              </p>
              <p className="font-ibm-mono text-xl text-gray-900 mt-1">
                {recipientCount} volunteer{recipientCount !== 1 ? "s" : ""}
              </p>
            </div>

            <Button
              variant="critical"
              onClick={handleBroadcast}
              disabled={!isValid || isSending}
              className="w-full"
            >
              BROADCAST NOW
            </Button>

            {!isValid && message.trim().length > 0 && recipientCount === 0 && (
              <p className="font-inter text-xs text-amber-500 text-center mt-2">
                {target === "specific_task_force" && !selectedTaskForceId
                  ? "Please select a task force"
                  : "No recipients match this target"}
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        recipientCount={recipientCount}
        message={message}
        isSending={isSending}
      />
    </div>
  );
}
