'use client';

import type { HTMLAttributes } from 'react';

export const Card = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className={`rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 ${className}`.trim()}
  />
);

export const CardHeader = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={`mb-2 ${className}`.trim()} />
);

export const CardTitle = ({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 {...props} className={`text-lg font-semibold ${className}`.trim()} />
);

export const CardContent = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div {...props} className={className} />
);
