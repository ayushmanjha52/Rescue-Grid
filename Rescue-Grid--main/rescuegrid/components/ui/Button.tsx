import { ButtonHTMLAttributes, forwardRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "critical" | "outline";
type ButtonSize = "default" | "small" | "large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  animate?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-orange text-white border-none hover:bg-orange/90 active:scale-[0.98]",
  secondary: "bg-transparent text-orange border-2 border-orange hover:bg-orange/5 active:scale-[0.98]",
  ghost: "bg-surface-2 text-ink border border-border-dim hover:bg-surface-3 hover:border-border active:scale-[0.98]",
  danger: "bg-transparent text-alert border-2 border-alert hover:bg-alert/5 active:scale-[0.98]",
  critical: "bg-alert text-white border-none hover:bg-alert/90 active:scale-[0.98] animate-critical-pulse shadow-lg shadow-alert/30",
  outline: "bg-transparent text-orange border border-orange hover:bg-orange/5 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "px-6 py-2.5 text-base",
  small: "px-4 py-1.5 text-sm",
  large: "px-8 py-4 text-lg",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "default", animate = false, className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          font-display font-semibold uppercase tracking-[0.15em]
          clip-path-tactical
          transition-all duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${animate ? "animate-attention-bounce" : ""}
          ${className}
        `}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
