import * as React from "react"
import { cn } from "@/lib/utils"

function Avatar({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-700",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function AvatarFallback({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-slate-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Avatar, AvatarFallback }


