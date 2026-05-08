type LoadingSpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize;
  text?: string;
  className?: string;
}

const sizeMap: Record<LoadingSpinnerSize, { spinner: number; text: string }> = {
  xs: { spinner: 16, text: "xs" },
  sm: { spinner: 24, text: "xs" },
  md: { spinner: 32, text: "sm" },
  lg: { spinner: 48, text: "base" },
  xl: { spinner: 64, text: "lg" },
};

export default function LoadingSpinner({
  size = "md",
  text,
  className = ""
}: LoadingSpinnerProps) {
  const { spinner: spinnerSize, text: textSize } = sizeMap[size];
  const showPulseRing = size === "lg" || size === "xl";

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        {showPulseRing && (
          <div
            className="absolute inset-0 rounded-full border-2 border-orange/20 animate-ping"
            style={{ width: spinnerSize, height: spinnerSize }}
          />
        )}
        <div
          className="w-8 h-8 border-[2px] border-orange border-t-transparent rounded-full animate-spin"
          style={{
            width: spinnerSize,
            height: spinnerSize,
            borderWidth: size === "xs" ? 2 : size === "xl" ? 3 : 2,
            borderColor: "#FF6B2B",
            borderTopColor: "transparent"
          }}
        />
      </div>
      {text && (
        <span
          className={`font-mono uppercase tracking-[0.15em] text-dim text-${textSize}`}
          style={{ fontSize: `var(--text-${textSize})` }}
        >
          {text}
        </span>
      )}
    </div>
  );
}
