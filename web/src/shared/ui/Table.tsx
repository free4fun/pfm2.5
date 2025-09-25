'use client';

import type { HTMLAttributes } from 'react';

export const Table = ({ className = '', ...props }: HTMLAttributes<HTMLTableElement>) => (
  <table {...props} className={`w-full border-separate border-spacing-y-1 ${className}`.trim()} />
);

export const TableHead = ({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...props} className={`text-left text-zinc-400 ${className}`.trim()} />
);

export const TableBody = ({ className = '', ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...props} className={className} />
);
