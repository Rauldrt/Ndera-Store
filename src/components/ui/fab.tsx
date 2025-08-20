
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
  "relative inline-flex items-center justify-center rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 shadow-lg overflow-hidden",
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
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const [rippleStyle, setRippleStyle] = React.useState({});
    const [isRippling, setIsRippling] = React.useState(false);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      const fab = event.currentTarget;
      const size = fab.offsetWidth;
      const pos = fab.getBoundingClientRect();
      const x = event.clientX - pos.left;
      const y = event.clientY - pos.top;

      setRippleStyle({
        top: `${y}px`,
        left: `${x}px`,
        height: `${size}px`,
        width: `${size}px`,
      });

      setIsRippling(true);

      // Propagate the click event if it exists
      props.onClick?.(event);
    };

    React.useEffect(() => {
      if (isRippling) {
        const timer = setTimeout(() => setIsRippling(false), 500); // Duration of the ripple animation
        return () => clearTimeout(timer);
      }
    }, [isRippling]);

    return (
      <Comp
        className={cn(fabVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
        {isRippling && <span className="ripple" style={rippleStyle} />}
      </Comp>
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

const ActionButton: React.FC<{ action: FabMenuAction; onActionClick: () => void; index: number }> = ({ action, onActionClick, index }) => {
    const handleClick = () => {
        if (action.onClick) {
            action.onClick();
        }
        onActionClick();
    };

    const fabContent = action.href ? (
        <Link href={action.href} passHref legacyBehavior>
            <Fab asChild size="sm" variant="secondary" aria-label={action.label}>
                <a>{action.icon}</a>
            </Fab>
        </Link>
    ) : (
        <Fab size="sm" variant="secondary" aria-label={action.label} onClick={handleClick}>
            {action.icon}
        </Fab>
    );

    return (
        <div 
          className="flex items-center gap-4"
          style={{ 
            transition: 'all 300ms cubic-bezier(0.34, 1.56, 0.64, 1)', 
            opacity: 0, 
            transform: 'translateY(20px) scale(0.8)', 
            animation: `fab-action-enter 300ms ${index * 40}ms forwards cubic-bezier(0.34, 1.56, 0.64, 1)` 
          }}
        >
            <div className="bg-background text-foreground rounded-md px-3 py-1.5 shadow-md text-sm">
                {action.label}
            </div>
            {fabContent}
        </div>
    );
};


const FabMenu: React.FC<FabMenuProps> = ({ actions }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <>
      <style jsx global>{`
        .ripple {
          position: absolute;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.6);
          transform: scale(0);
          animation: ripple-animation 0.5s linear;
          pointer-events: none;
        }

        @keyframes ripple-animation {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        
        @keyframes fab-action-enter {
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
      `}</style>
      <TooltipProvider>
        <div className="fixed bottom-4 right-4 z-30 flex flex-col items-center gap-4 md:hidden">
          {isOpen && (
              <div className="flex flex-col-reverse items-end gap-4">
                {actions.map((action, index) => (
                    <ActionButton 
                        key={index}
                        index={index}
                        action={action} 
                        onActionClick={() => setIsOpen(false)} 
                    />
                ))}
              </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
                <Fab
                onClick={toggleMenu}
                aria-expanded={isOpen}
                aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
                className="transition-transform duration-300 ease-in-out hover:scale-105 active:scale-95"
                >
                    <div className="relative h-8 w-8 flex items-center justify-center">
                       <Plus className={cn("absolute transition-all duration-300 ease-in-out", isOpen ? "transform rotate-45 scale-0 opacity-0" : "transform rotate-0 scale-100 opacity-100")} />
                       <X className={cn("absolute transition-all duration-300 ease-in-out", isOpen ? "transform rotate-0 scale-100 opacity-100" : "transform -rotate-45 scale-0 opacity-0")} />
                    </div>
                    <div className="sr-only">{isOpen ? "Cerrar" : "Abrir"}</div>
                </Fab>
            </TooltipTrigger>
             <TooltipContent side="left" align="center">
                <p>{isOpen ? "Cerrar" : "Opciones"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </>
  );
};


export { Fab, fabVariants, FabMenu };
