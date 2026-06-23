import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ref, ...props }: React.ComponentProps<"input">) {
  // Number inputs mutate their value when the wheel/trackpad scrolls over a
  // focused field — an easy way to silently change a number without intending
  // to. React's onWheel is passive (can't preventDefault), so attach a
  // non-passive native listener via a callback ref. We only block the default
  // while the input is focused (the only time the browser would change the
  // value), so scrolling the page over an unfocused number input still works.
  const attachWheelGuard = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node

      if (!node) return

      const blockWheelChange = (event: WheelEvent) => {
        if (node.type === "number" && document.activeElement === node) {
          event.preventDefault()
        }
      }
      node.addEventListener("wheel", blockWheelChange, { passive: false })
      return () => node.removeEventListener("wheel", blockWheelChange)
    },
    [ref]
  )

  return (
    <input
      type={type}
      data-slot="input"
      ref={attachWheelGuard}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        // Hide the native number spinner buttons. They are a tiny click target
        // that some setups (hover/dwell-to-click, a chattering mouse switch)
        // hammer just by resting the pointer over them, runaway-incrementing the
        // value. Removing the spinner removes the target; typing/wheel still work.
        "[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:[-webkit-appearance:none] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:[-webkit-appearance:none] [&[type=number]]:[-moz-appearance:textfield]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
