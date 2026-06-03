import * as React from "react"
import { cn } from "@/lib/utils"

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "peer h-[18px] w-[18px] shrink-0 appearance-none rounded-[2px] border-2 border-outline cursor-pointer",
          "checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          "after:absolute after:hidden after:checked:block after:left-[5px] after:top-[1px] after:w-[5px] after:h-[10px] after:border-r-2 after:border-b-2 after:border-on-primary after:rotate-45 relative",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
