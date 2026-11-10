import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-emerald-300 text-slate-950 hover:bg-emerald-200",
      secondary: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
      ghost: "text-slate-300 hover:bg-white/10 hover:text-white",
    },
    size: { default: "h-11 px-5", sm: "h-9 px-4 text-xs", lg: "h-12 px-7 text-base", icon: "h-10 w-10" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
});
Button.displayName = "Button";
export { Button, buttonVariants };
