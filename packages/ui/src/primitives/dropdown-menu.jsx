import * as React from "react"
import { Menu } from "@base-ui/react/menu"
import { cn } from "../lib/utils"

function DropdownMenu({ ...props }) {
  return <Menu.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger({ ...props }) {
  return <Menu.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuPortal({ ...props }) {
  return <Menu.Portal data-slot="dropdown-menu-portal" {...props} />;
}

function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <Menu.Portal>
      <Menu.Positioner sideOffset={sideOffset} data-slot="dropdown-menu-positioner">
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, inset, ...props }) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({ className, inset, ...props }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }) {
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
}
