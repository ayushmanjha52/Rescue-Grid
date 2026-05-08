"use client";

import Button from "@/components/ui/Button";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  recipientCount: number;
  message: string;
  isSending: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  recipientCount,
  message,
  isSending,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const truncatedMessage = message.length > 100 
    ? message.substring(0, 100) + "..." 
    : message;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-2 w-full max-w-md clip-path-tactical border-t-2 border-alert">
        <div className="px-4 py-3 border-b border-border-dim">
          <h2 className="font-display font-semibold text-lg text-alert uppercase tracking-wider">
            CONFIRM EMERGENCY BROADCAST
          </h2>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-alert/10 border border-alert/30 p-3">
            <p className="font-mono text-[10px] text-alert uppercase tracking-wider mb-2">
              Recipients
            </p>
            <p className="font-mono text-2xl text-ink">
              {recipientCount} volunteer{recipientCount !== 1 ? "s" : ""}
            </p>
          </div>

          <div>
            <p className="font-mono text-[10px] text-orange uppercase tracking-wider mb-2">
              Message Preview
            </p>
            <div className="bg-surface-3 p-3 border-l-3 border-l-orange">
              <p className="font-body text-sm text-ink whitespace-pre-wrap">
                {truncatedMessage}
              </p>
            </div>
          </div>

          <p className="font-mono text-[10px] text-dim">
            This will send a push notification to all {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}.
          </p>
        </div>

        <div className="flex justify-end gap-3 px-4 pb-4">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isSending}
          >
            CANCEL
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isSending}
          >
            {isSending ? "SENDING..." : "CONFIRM BROADCAST"}
          </Button>
        </div>
      </div>
    </div>
  );
}
