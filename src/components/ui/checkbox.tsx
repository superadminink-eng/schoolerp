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
          "checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
          "after:absolute after:hidden checked:after:block indeterminate:after:block relative",
          "checked:after:left-[5px] checked:after:top-[1px] checked:after:w-[5px] checked:after:h-[10px] checked:after:border-r-2 checked:after:border-b-2 checked:after:border-on-primary checked:after:rotate-45",
          "indeterminate:after:left-[4px] indeterminate:after:top-[6px] indeterminate:after:w-[6px] indeterminate:after:h-[2px] indeterminate:after:bg-on-primary indeterminate:after:border-0 indeterminate:after:rotate-0",
          className
        )}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
