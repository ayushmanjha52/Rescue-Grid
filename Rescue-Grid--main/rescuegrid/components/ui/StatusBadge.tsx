type StatusType = "critical" | "on-mission" | "ready" | "standby" | "completed" | "open" | "verified" | "assigned" | "en_route" | "arrived" | "resolved" | "failed" | "pending";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
  critical: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", pulse: true },
  "on-mission": { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500" },
  ready: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  standby: { bg: "bg-surface-2", text: "text-muted", dot: "bg-dim" },
  completed: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  open: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", pulse: true },
  verified: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  assigned: { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500" },
  en_route: { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500", pulse: true },
  on_my_way: { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-500", pulse: true },
  arrived: { bg: "bg-green-50", text: "text-green-600", dot: "bg-green-500" },
  resolved: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  failed: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
  pending: { bg: "bg-surface-2", text: "text-muted", dot: "bg-dim" },
};

const sizeStyles = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-3 py-1.5 gap-2",
};

export default function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.standby;
  const displayLabel = label || status.toUpperCase().replace("-", " ").replace("_", " ");

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
