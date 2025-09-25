'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

import { Card, Tabs } from '@shared/ui';

type RpcBlock = {
  number: string;
  timestamp: string;
  gasUsed: string;
  gasLimit: string;
  size?: string;
  transactions: any[];
};

const hex = (h?: string) => (h ? parseInt(h, 16) : 0);

export default function BlocksMetricsPanel({ blocks }: { blocks: RpcBlock[] }) {
  const arr = useMemo(() => [...blocks].slice(0, 100).reverse(), [blocks]);

  const series = useMemo(() => {
    const data: Array<{
      h: number;
      t: number;
      tx: number;
      tps: number;
      gasP: number;
      bsize: number;
    }> = [];

    for (let i = 0; i < arr.length; i++) {
      const block = arr[i];
      const previous = arr[i - 1];
      const delta = i > 0 ? Math.max(1, hex(block.timestamp) - hex(previous.timestamp)) : 0;
      const transactions = block.transactions?.length ?? 0;
      data.push({
        h: hex(block.number),
        t: hex(block.timestamp) * 1000,
        tx: transactions,
        tps: i > 0 ? transactions / delta : 0,
        gasP: (hex(block.gasUsed) / Math.max(1, hex(block.gasLimit))) * 100,
        bsize: hex(block.size ?? '0x0'),
      });
    }

    return data;
  }, [arr]);

  const kpi = useMemo(() => {
    let ema = 0;
    const alpha = 2 / (Math.min(30, series.length) + 1);
    series.forEach((point) => {
      ema = ema ? alpha * point.tps + (1 - alpha) * ema : point.tps;
    });

    const last = series[series.length - 1];
    return {
      h: last?.h ?? 0,
      tps: last?.tps ?? 0,
      ema,
      gasP: last?.gasP ?? 0,
      tx: last?.tx ?? 0,
      bsize: last?.bsize ?? 0,
    };
  }, [series]);

  return (
    <Card>
      <div className="flex flex-wrap gap-4 mb-3 text-sm">
        <div className="opacity-70">h={kpi.h}</div>
        <div>TPS: <span className="font-semibold">{kpi.tps.toFixed(2)}</span></div>
        <div>EMA60: <span className="font-semibold">{kpi.ema.toFixed(2)}</span></div>
        <div>tx/block: <span className="font-semibold">{kpi.tx}</span></div>
        <div>gas: <span className="font-semibold">{kpi.gasP.toFixed(1)}%</span></div>
        <div>size: <span className="font-semibold">{kpi.bsize}</span></div>
      </div>

      <Tabs
        tabs={[
          {
            label: 'TPS',
            content: (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <XAxis dataKey="h" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals />
                    <Tooltip />
                    <Line type="monotone" dataKey="tps" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ),
          },
          {
            label: 'Gas Utilization (%)',
            content: (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <XAxis dataKey="h" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="gasP" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ),
          },
          {
            label: 'Block Size (hist)',
            content: (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series}>
                    <XAxis dataKey="h" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="bsize" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
