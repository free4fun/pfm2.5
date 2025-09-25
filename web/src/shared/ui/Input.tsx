'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`px-3 py-2 rounded border border-zinc-700 bg-zinc-900 ${className}`.trim()}
    {...props}
  />
));

Input.displayName = 'Input';
