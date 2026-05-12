import React, { useEffect, useState } from 'react';
import {
  fetchAdminAiDiagnosticsStats,
  type AdminAiStatsResponse,
} from '@services/aiDiagnosticsApi';
import { getErrorMessage } from '@services/apiClient';

function maxBarValue(items: { count: number }[]): number {
  return Math.max(1, ...items.map((i) => i.count));
}

const BarChart: React.FC<{
  title: string;
  rows: { label: string; count: number }[];
}> = ({ title, rows }) => {
  const mx = maxBarValue(rows.map((r) => ({ count: r.count })));
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div>
        {rows.map((r) => (
          <div
            key={r.label}
            style={{
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ width: 140, fontSize: 13 }}>{r.label}</div>
            <div
              style={{
                flex: 1,
                height: 10,
                background: '#e2e8f0',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  width: `${(r.count / mx) * 100}%`,
                  height: '100%',
                  background: '#3b82f6',
                  borderRadius: 6,
                }}
              />
            </div>
            <div style={{ width: 56, fontSize: 13, textAlign: 'right' }}>
              {r.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PieLegend: React.FC<{
  title: string;
  segments: { label: string; value: number; color: string }[];
}> = ({ title, segments }) => {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let acc = 0;
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <svg width="220" height="220" viewBox="0 0 100 100">
        {segments.map((s, i) => {
          const start = (acc / sum) * 2 * Math.PI;
          acc += s.value;
          const end = (acc / sum) * 2 * Math.PI;
          const x1 = 50 + 40 * Math.sin(start);
          const y1 = 50 - 40 * Math.cos(start);
          const x2 = 50 + 40 * Math.sin(end);
          const y2 = 50 - 40 * Math.cos(end);
          const large = end - start > Math.PI ? 1 : 0;
          const d =
            sum === 0
              ? ''
              : `M 50 50 L ${x1} ${y1} A 40 40 0 ${large} 1 ${x2} ${y2} Z`;
          return d ? (
            <path key={i} d={d} fill={s.color} stroke="#fff" strokeWidth="0.5" />
          ) : null;
        })}
      </svg>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {segments.map((s) => (
          <li key={s.label} style={{ fontSize: 13, marginBottom: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                background: s.color,
                marginRight: 6,
                verticalAlign: 'middle',
              }}
            />{' '}
            {s.label} : <strong>{s.value}</strong> (
            {Math.round((s.value / sum) * 100)}%)
          </li>
        ))}
      </ul>
    </div>
  );
};

const COLORS = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#eab308'];

const AdminIaStatsPage: React.FC = () => {
  const [data, setData] = useState<AdminAiStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminAiDiagnosticsStats()
      .then(setData)
      .catch((e) =>
        setError(getErrorMessage(e, 'Impossible de charger les statistiques')),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="container">Chargement des métriques IA…</div>;
  if (error) return <div className="container">{error}</div>;
  if (!data) return null;

  const localeRows = Object.entries(data.byLocale).map(([label, count]) => ({
    label,
    count,
  }));
  const categoryRows = Object.entries(data.byCategory).map(([label, count]) => ({
    label,
    count,
  }));
  const hourRows = data.charts.byHourUtc.map((h) => ({
    label: `${h.hour}h`,
    count: h.count,
  }));

  const pieSegs = [
    { label: 'Acceptées', value: data.totals.accepted, color: COLORS[0]! },
    { label: 'Refusées', value: data.totals.refused, color: COLORS[2]! },
  ];

  return (
    <div className="container">
      <h1>Statistiques IA</h1>
      <p style={{ color: '#64748b' }}>
        Fenêtre glissante : {data.windowDays} jours (UTC). Basé sur la table
        anonymisée <code>ai_diagnostics</code>.
      </p>

      <div
        className="card"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Requêtes totales</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{data.totals.all}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Valides</div>
          <div style={{ fontSize: 28 }}>{data.totals.accepted}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Refusées</div>
          <div style={{ fontSize: 28 }}>{data.totals.refused}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Orientation artisan</div>
          <div style={{ fontSize: 28 }}>{data.totals.artisanOriented}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Orientation bailleur</div>
          <div style={{ fontSize: 28 }}>{data.totals.bailleurOriented}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Orientation admin</div>
          <div style={{ fontSize: 28 }}>{data.totals.adminOriented}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <PieLegend title="Validées vs refusées" segments={pieSegs} />
        <BarChart
          title="Par langue (locale)"
          rows={localeRows.sort((a, b) => b.count - a.count)}
        />
        <BarChart
          title="Par type de problème (catégorie)"
          rows={categoryRows.sort((a, b) => b.count - a.count)}
        />
        <BarChart
          title="Volume par heure (UTC)"
          rows={hourRows}
        />
        <BarChart
          title="Par jour de la semaine (0=dim. UTC)"
          rows={data.charts.byDayOfWeekUtc.map((d) => ({
            label: `J${d.day}`,
            count: d.count,
          }))}
        />
      </div>

      <div className="card" style={{ marginTop: 8 }}>
        <h3 style={{ marginTop: 0 }}>Courbe par jour</h3>
        <svg width="100%" height="120" viewBox={`0 0 ${data.charts.byDate.length || 1} 100`} preserveAspectRatio="none">
          {(() => {
            const pts = data.charts.byDate;
            const maxC = maxBarValue(pts.map((p) => ({ count: p.count })));
            if (!pts.length) return null;
            const d = pts
              .map((p, i) => {
                const x = i;
                const y = 100 - (p.count / maxC) * 90 - 5;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              })
              .join(' ');
            return (
              <path d={d} fill="none" stroke="#3b82f6" strokeWidth="0.8" />
            );
          })()}
        </svg>
        <div style={{ fontSize: 12, color: '#64748b' }}>
          Axe horizontal : jours avec au moins un enregistrement.
        </div>
      </div>
    </div>
  );
};

export default AdminIaStatsPage;
