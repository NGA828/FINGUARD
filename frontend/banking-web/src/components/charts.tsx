'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { shortDate, formatXAF } from '@/lib/format';
import { RISK_COLORS, TX_STATUS_LABELS, TX_TYPE_LABELS } from '@/lib/labels';

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e2e8f0',
  boxShadow: '0 8px 24px -8px rgba(10,18,40,0.15)',
  fontSize: 12,
};

export function VolumeAreaChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="vol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b282" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b282" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="flag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(d) => shortDate(d + 'T00:00:00')} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [formatXAF(v), name === 'volume' ? 'Volume' : 'Signalées']} labelFormatter={(d) => shortDate(String(d) + 'T00:00:00')} />
        <Area type="monotone" dataKey="volume" stroke="#10b282" strokeWidth={2.5} fill="url(#vol)" animationDuration={900} />
        <Area type="monotone" dataKey="flagged" stroke="#f43f5e" strokeWidth={2} fill="url(#flag)" animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TypeBarChart({ data }: { data: any[] }) {
  const colors = ['#10b981', '#f43f5e', '#0ea5e9', '#8b5cf6'];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="type" tickFormatter={(t) => TX_TYPE_LABELS[t] || t} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: string) => [n === 'count' ? v : formatXAF(v), n === 'count' ? 'Transactions' : 'Volume']} />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} animationDuration={900}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusPieChart({ data }: { data: any[] }) {
  const colors: Record<string, string> = {
    COMPLETED: '#10b981',
    PENDING: '#f59e0b',
    PROCESSING: '#0ea5e9',
    UNDER_REVIEW: '#8b5cf6',
    REJECTED: '#f43f5e',
    FAILED: '#fb7185',
    CANCELLED: '#94a3b8',
  };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" innerRadius={62} outerRadius={92} paddingAngle={3} animationDuration={900}>
          {data.map((d, i) => (
            <Cell key={i} fill={colors[d.status] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [v, TX_STATUS_LABELS[name] || name]} />
        <Legend formatter={(v) => <span style={{ fontSize: 12, color: '#64748b' }}>{TX_STATUS_LABELS[v] || v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RiskDonut({ data }: { data: { LOW: number; MEDIUM: number; HIGH: number } }) {
  const rows = [
    { level: 'LOW', value: data.LOW },
    { level: 'MEDIUM', value: data.MEDIUM },
    { level: 'HIGH', value: data.HIGH },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="level" innerRadius={56} outerRadius={84} paddingAngle={4} animationDuration={900}>
          {rows.map((r, i) => (
            <Cell key={i} fill={RISK_COLORS[r.level]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [v, name === 'HIGH' ? 'Élevé' : name === 'MEDIUM' ? 'Moyen' : 'Faible']} />
      </PieChart>
    </ResponsiveContainer>
  );
}
