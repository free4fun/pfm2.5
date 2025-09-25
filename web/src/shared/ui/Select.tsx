'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className = '', ...props }, ref) => (
  <select
    ref={ref}
    className={`px-3 py-2 rounded border border-zinc-700 bg-zinc-900 ${className}`.trim()}
    {...props}
  />
));

Select.displayName = 'Select';
