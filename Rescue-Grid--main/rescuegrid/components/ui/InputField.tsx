import { InputHTMLAttributes, forwardRef } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id || label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="font-mono text-xs text-muted uppercase tracking-[0.14em] font-medium"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-3
            bg-surface-2 border border-border-dim rounded-sm
            font-body text-base text-ink
            placeholder:text-dim
            focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange focus:bg-surface-1
            transition-colors duration-150
            ${className}
          `}
          {...props}
        />
      </div>
    );
  }
);

InputField.displayName = "InputField";

export default InputField;
