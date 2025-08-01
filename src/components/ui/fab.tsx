
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

const fabVariants = cva(
  "inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-lg",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-14 w-14",
        sm: "h-10 w-10",
        lg: "h-16 w-16",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface FabProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof fabVariants> {
  asChild?: boolean;
}

const Fab = React.forwardRef<HTMLButtonElement, FabProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(fabVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Fab.displayName = "Fab";

interface FabMenuAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}

interface FabMenuProps {
  actions: FabMenuAction[];
}

const FabMenu: React.FC<FabMenuProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <TooltipProvider>
      <div className="fixed bottom-4 right-4 z-30 flex flex-col items-center gap-3 md:hidden">
        {isOpen && (
          <div className="flex flex-col items-center gap-3 transition-all duration-300">
            {actions.map((action, index) => {
              const ActionButton = (
                <Fab
                  key={index}
                  size="sm"
                  variant="secondary"
                  aria-label={action.label}
                  onClick={action.onClick ? () => { action.onClick?.(); setIsOpen(false); } : undefined}
                  asChild={!!action.href}
                >
                  {action.href ? <Link href={action.href}>{action.icon}</Link> : action.icon}
                </Fab>
              );

              return (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>{ActionButton}</TooltipTrigger>
                  <TooltipContent side="left" align="center">
                    <p>{action.label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
        <Fab
          onClick={toggleMenu}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          className="transition-transform duration-300 ease-in-out"
          style={{ transform: isOpen ? 'rotate(45deg)' : 'none' }}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Fab>
      </div>
    </TooltipProvider>
  );
};

export { Fab, fabVariants, FabMenu };
