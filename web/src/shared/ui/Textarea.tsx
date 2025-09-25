'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className = '', ...props }, ref) => (
  <textarea
    ref={ref}
    className={`px-3 py-2 rounded border border-zinc-700 bg-zinc-900 ${className}`.trim()}
    {...props}
  />
));

Textarea.displayName = 'Textarea';
