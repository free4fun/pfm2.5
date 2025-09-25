'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-zinc-700 text-white hover:bg-zinc-800',
  ghost: 'bg-transparent hover:bg-zinc-800',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(({ className = '', variant = 'primary', ...props }, ref) => (
  <button
    ref={ref}
    className={`px-3 py-2 rounded ${BUTTON_VARIANTS[variant]} ${className}`.trim()}
    {...props}
  />
));

Button.displayName = 'Button';
