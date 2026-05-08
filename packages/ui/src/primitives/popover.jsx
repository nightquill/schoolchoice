import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { cn } from "@/lib/utils"

function PopoverRoot({ ...props }) {
  return <Popover.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }) {
  return <Popover.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({ className, align = "center", sideOffset = 4, ...props }) {
  return (
    <Popover.Portal>
      <Popover.Positioner sideOffset={sideOffset} data-slot="popover-positioner">
        <Popover.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 rounded-lg border border-border bg-popover p-4 text-sm text-popover-foreground shadow-md outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </Popover.Positioner>
    </Popover.Portal>
  );
}

function PopoverArrow({ className, ...props }) {
  return (
    <Popover.Arrow
      data-slot="popover-arrow"
      className={cn("fill-popover", className)}
      {...props}
    />
  );
}

export { PopoverRoot as Popover, PopoverArrow, PopoverContent, PopoverTrigger }
