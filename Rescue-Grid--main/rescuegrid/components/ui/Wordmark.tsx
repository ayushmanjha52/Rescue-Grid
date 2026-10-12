const sizeStyles = {
  xs: "text-[16px]",
  sm: "text-[19px]",
  md: "text-[22px]",
  lg: "text-[34px]",
  xl: "text-[46px]",
};

/** The RescueGrid logotype: "Rescue" in the display face, "Grid" in serif italic. */
export default function Wordmark({ size = "md", className = "" }: { size?: keyof typeof sizeStyles; className?: string }) {
  return (
    <span className={`inline-flex items-baseline leading-none whitespace-nowrap ${sizeStyles[size]} ${className}`}>
      <span className="font-display font-bold tracking-[-0.03em] text-ink">Rescue</span>
      <span className="font-serif italic text-[1.12em] text-orange ml-[0.04em]">Grid</span>
    </span>
  );
}
