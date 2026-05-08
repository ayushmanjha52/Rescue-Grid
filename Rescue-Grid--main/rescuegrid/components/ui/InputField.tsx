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
          className="font-mono text-xs text-orange uppercase tracking-[0.2em] font-medium"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-3
            bg-gray-50 border border-gray-200 rounded-sm
            font-body text-base text-gray-900
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-orange/20 focus:border-orange focus:bg-white
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
