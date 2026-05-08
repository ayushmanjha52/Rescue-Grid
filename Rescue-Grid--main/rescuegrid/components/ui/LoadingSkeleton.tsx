type SkeletonVariant = "card" | "list-item" | "text" | "avatar-text";

interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  className?: string;
  count?: number;
}

export function LoadingSkeleton({ variant = "text", className = "", count = 1 }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderSkeleton = (key: number) => {
    switch (variant) {
      case "card":
        return (
          <div key={key} className="bg-surface-2 rounded-sm overflow-hidden">
            <div className="h-20 bg-surface-3 animate-shimmer" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-3/4 bg-surface-3 animate-shimmer rounded-sm" />
              <div className="h-3 w-1/2 bg-surface-3 animate-shimmer rounded-sm" />
              <div className="h-3 w-2/3 bg-surface-3 animate-shimmer rounded-sm" />
            </div>
          </div>
        );
      case "list-item":
        return (
          <div key={key} className="flex items-center gap-3 p-3 bg-surface-2 border border-border-dim rounded-sm">
            <div className="w-10 h-10 bg-surface-3 animate-shimmer rounded-sm shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 bg-surface-3 animate-shimmer rounded-sm" />
              <div className="h-2 w-1/3 bg-surface-3 animate-shimmer rounded-sm" />
            </div>
          </div>
        );
      case "avatar-text":
        return (
          <div key={key} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-surface-3 animate-shimmer rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-surface-3 animate-shimmer rounded-sm" />
              <div className="h-3 w-48 bg-surface-3 animate-shimmer rounded-sm" />
            </div>
          </div>
        );
      case "text":
      default:
        return (
          <div key={key} className="space-y-2">
            <div className="h-4 w-full bg-surface-3 animate-shimmer rounded-sm" />
            <div className="h-4 w-5/6 bg-surface-3 animate-shimmer rounded-sm" />
            <div className="h-4 w-4/6 bg-surface-3 animate-shimmer rounded-sm" />
          </div>
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((i) => renderSkeleton(i))}
    </div>
  );
}

interface SkeletonLineProps {
  width?: string;
  height?: "sm" | "md" | "lg";
  className?: string;
}

export function SkeletonLine({ width = "100%", height = "md", className = "" }: SkeletonLineProps) {
  const heightMap = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <div
      className={`${heightMap[height]} animate-shimmer rounded-sm ${className}`}
      style={{ width }}
    />
  );
}

interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function SkeletonBox({ width = "100%", height = 40, className = "" }: SkeletonBoxProps) {
  return (
    <div
      className={`animate-shimmer rounded-sm ${className}`}
      style={{ width, height }}
    />
  );
}
