import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('inline-flex items-center justify-center gap-2 rounded-md border text-[13px] font-medium tracking-[-0.13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-violet)] disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      primary: 'border-transparent bg-[var(--brand-indigo)] text-white shadow-[0_0_24px_rgba(94,106,210,0.28)] hover:bg-[var(--accent-hover)]',
      ghost: 'border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.06)]',
      subtle: 'border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
    },
    size: { sm: 'h-8 px-3', md: 'h-10 px-4', lg: 'h-11 px-5' },
  },
  defaultVariants: { variant: 'ghost', size: 'md' },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean; }
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />; }
