'use client';

import { useState } from 'react';

type Tab = { label: string; content: React.ReactNode };

export function Tabs({ tabs, initial = 0 }: { tabs: Tab[]; initial?: number }) {
  const [index, setIndex] = useState(initial);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-zinc-800">
        {tabs.map((tab, idx) => (
          <button
            key={tab.label}
            onClick={() => setIndex(idx)}
            className={`px-3 py-2 text-sm rounded-t ${
              index === idx ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
            }`}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{tabs[index]?.content}</div>
    </div>
  );
}
