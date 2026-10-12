type StatusType = "critical" | "on-mission" | "ready" | "standby" | "completed" | "open" | "verified" | "assigned" | "en_route" | "arrived" | "resolved" | "failed" | "pending";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  critical: { bg: "bg-alert/10", text: "text-alert", dot: "bg-alert", pulse: true },
  "on-mission": { bg: "bg-orange/10", text: "text-orange", dot: "bg-orange" },
  ready: { bg: "bg-ops/10", text: "text-ops", dot: "bg-ops" },
  standby: { bg: "bg-surface-2", text: "text-muted", dot: "bg-dim" },
  completed: { bg: "bg-intel/10", text: "text-intel", dot: "bg-intel" },
  open: { bg: "bg-alert/10", text: "text-alert", dot: "bg-alert", pulse: true },
  verified: { bg: "bg-ops/10", text: "text-ops", dot: "bg-ops" },
  assigned: { bg: "bg-orange/10", text: "text-orange", dot: "bg-orange" },
  en_route: { bg: "bg-orange/10", text: "text-orange", dot: "bg-orange", pulse: true },
  on_my_way: { bg: "bg-orange/10", text: "text-orange", dot: "bg-orange", pulse: true },
  arrived: { bg: "bg-ops/10", text: "text-ops", dot: "bg-ops" },
  resolved: { bg: "bg-intel/10", text: "text-intel", dot: "bg-intel" },
  failed: { bg: "bg-alert/10", text: "text-alert", dot: "bg-alert" },
  pending: { bg: "bg-surface-2", text: "text-muted", dot: "bg-dim" },
  active: { bg: "bg-intel/10", text: "text-intel", dot: "bg-intel" },
  duplicate: { bg: "bg-caution/10", text: "text-caution", dot: "bg-caution" },
  offline: { bg: "bg-surface-2", text: "text-dim", dot: "bg-dim" },
};

const sizeStyles = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

export default function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.standby;
  const displayLabel = label || status.toUpperCase().replace(/[-_]/g, " ");

  return (
    <span
      className={`
        inline-flex items-center
        font-mono uppercase tracking-[0.1em]
        rounded-sm
        ${config.bg} ${config.text}
        ${sizeStyles[size]}
      `}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.dot} ${config.pulse ? "animate-pulse" : ""}`}
      />
      {displayLabel}
    </span>
  );
}
