"use client"

import { GripVertical } from "lucide-react"
import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "@/lib/utils"

const ResizablePanelGroup = ({
  className,
  direction,
  ...props
}: React.ComponentProps<typeof Group> & { direction?: "horizontal" | "vertical" }) => (
  <Group
    orientation={direction === "vertical" ? "vertical" : "horizontal"}
    className={cn(
      "flex h-full w-full",
      direction === "vertical" ? "flex-col" : "flex-row",
      className
    )}
    {...props}
  />
)

const ResizablePanel = Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean
}) => (
  <Separator
    className={cn(
      "relative flex w-px bg-border cursor-col-resize hover:bg-primary/50 transition-colors shrink-0 items-center justify-center",
      "data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:cursor-row-resize",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
