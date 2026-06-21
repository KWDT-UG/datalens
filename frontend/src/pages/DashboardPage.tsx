import { Link } from 'react-router-dom';
import { useState } from 'react';

import { useCommunitiesQuery, useDashboardQuery } from '../api/queries';
import type { DashboardTrendPoint } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { canReviewApprovals } from '../auth/permissions';

const periods = [
  { value: 'all', label: 'All time' },
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '12M' }
] as const;

function formatCount(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(`${value}T00:00:00`));
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function ImpactTrend({ points }: { points: DashboardTrendPoint[] }) {
  if (points.length === 0) {
    return <p className="dashboard-chart__empty">No dated impact records match these filters yet.</p>;
  }

  const width = 640;
  const height = 250;
  const padding = { top: 20, right: 18, bottom: 34, left: 46 };
  const max = Math.max(...points.map((point) => point.beneficiary_count), 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const coordinates = points.map((point, index) => ({
    x: padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - (point.beneficiary_count / max) * plotHeight
  }));
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const gridValues = [0, 0.5, 1];

  return (
    <svg className="dashboard-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Beneficiaries reached over time">
      {gridValues.map((ratio) => {
        const y = padding.top + plotHeight - ratio * plotHeight;
        return <line className="dashboard-chart__grid" key={ratio} x1={padding.left} x2={width - padding.right} y1={y} y2={y} />;
      })}
      <text className="dashboard-chart__axis" x="4" y={padding.top + 4}>{formatCount(max)}</text>
      <text className="dashboard-chart__axis" x="4" y={padding.top + plotHeight + 4}>0</text>
      <polyline className="dashboard-chart__line" points={polyline} />
      {coordinates.map((point, index) => (
        <g key={points[index].as_of_date}>
          <circle className="dashboard-chart__point" cx={point.x} cy={point.y} r="4" />
          <text className="dashboard-chart__axis" textAnchor="middle" x={point.x} y={height - 8}>
            {formatMonth(points[index].as_of_date)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [community, setCommunity] = useState('');
  const [period, setPeriod] = useState<(typeof periods)[number]['value']>('all');
  const [thematicArea, setThematicArea] = useState('');
  const dashboard = useDashboardQuery({
    community: community || undefined,
    period,
    thematic_area: thematicArea || undefined
  });
  const communities = useCommunitiesQuery({ page: 1, page_size: 100, ordering: 'name' });
  const data = dashboard.data?.data;
  const metrics = data?.metrics;
  const selectedProgramme = data?.programme_lenses.find((item) => item.code === thematicArea);
  const resourceTotal = data?.resource_status.reduce((total, row) => total + row.count, 0) ?? 0;

  return (
    <section className="page-panel dashboard-panel">
      <div className="page-header dashboard-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="page-header__description">
            Community impact, operational readiness, and the work that needs attention.
          </p>
        </div>
        <Link className="button button--primary" to="/reports">
          Open reports
        </Link>
      </div>

      <div className="dashboard-filters" aria-label="Dashboard filters">
        <label className="compact-filter">
          <span>Scope</span>
          <select value={community} onChange={(event) => setCommunity(event.target.value)}>
            <option value="">All communities</option>
            {(communities.data?.results ?? []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <div className="dashboard-periods" aria-label="Reporting period">
          {periods.map((option) => (
            <button
              className={period === option.value ? 'is-active' : ''}
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {dashboard.isLoading ? <div className="state-box">Loading dashboard...</div> : null}
      {dashboard.isError ? <div className="state-box state-box--error">Unable to load dashboard metrics.</div> : null}

      {data ? (
        <>
          <div className="metric-grid dashboard-metric-grid">
            <article className="metric-card"><span>Communities</span><strong>{formatCount(metrics?.community_count)}</strong></article>
            <article className="metric-card"><span>Groups</span><strong>{formatCount(metrics?.group_count)}</strong></article>
            <article className="metric-card"><span>Active members</span><strong>{formatCount(metrics?.active_member_count)}</strong></article>
            <article className="metric-card"><span>People reached</span><strong>{formatCount(metrics?.beneficiary_count)}</strong></article>
          </div>

          <div className="programme-lens" aria-label="Programme lens">
            <button
              className={thematicArea === '' ? 'is-active' : ''}
              type="button"
              aria-pressed={thematicArea === ''}
              onClick={() => setThematicArea('')}
            >
              All programmes
            </button>
            {data.programme_lenses.map((programme) => (
              <button
                className={thematicArea === programme.code ? 'is-active' : ''}
                key={programme.code}
                type="button"
                aria-pressed={thematicArea === programme.code}
                onClick={() => setThematicArea(programme.code)}
              >
                {programme.name}
              </button>
            ))}
          </div>

          <div className="dashboard-pulse-grid">
            <section className="dashboard-chart-card">
              <div className="dashboard-card-heading">
                <div>
                  <h2>{selectedProgramme ? `${selectedProgramme.name} impact` : 'Impact pulse'}</h2>
                  <p>People reached across recorded impact periods.</p>
                </div>
                {selectedProgramme ? <span>{formatCount(selectedProgramme.resource_count)} resources</span> : null}
              </div>
              <ImpactTrend points={data.impact_trend} />
            </section>

            <div className="dashboard-side-stack">
              <section className="dashboard-attention-card">
                <div className="dashboard-card-heading">
                  <h2>Needs attention</h2>
                  {canReviewApprovals(user) && metrics?.pending_approval_count ? <Link to="/approvals">Review queue</Link> : null}
                </div>
                {data.attention.length === 0 ? <p className="dashboard-card-empty">Nothing needs immediate follow-up.</p> : null}
                {data.attention.map((item) => (
                  <Link className="dashboard-attention-item" key={`${item.type}-${item.label}`} to={item.path}>
                    <span className={`dashboard-attention-item__marker dashboard-attention-item__marker--${item.type}`} aria-hidden="true" />
                    <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  </Link>
                ))}
              </section>

              <section className="dashboard-activity-card">
                <div className="dashboard-card-heading"><h2>What changed</h2><Link to="/reports">View all</Link></div>
                {data.recent_activity.length === 0 ? <p className="dashboard-card-empty">No recent activity.</p> : null}
                {data.recent_activity.slice(0, 3).map((activity) => (
                  <Link className="dashboard-activity-item" key={`${activity.type}-${activity.id}`} to={activity.path}>
                    <span><strong>{activity.label}</strong><small>{activity.community_name}</small></span>
                    <time dateTime={activity.updated_at}>{formatDate(activity.updated_at)}</time>
                  </Link>
                ))}
              </section>
            </div>
          </div>

          <section className="dashboard-readiness-card">
            <div className="dashboard-card-heading"><div><h2>Resource readiness</h2><p>Current status of resources in this scope.</p></div></div>
            {resourceTotal === 0 ? <p className="dashboard-card-empty">No resources match these filters.</p> : null}
            {resourceTotal > 0 ? <div className="dashboard-readiness-bar" aria-label="Resource readiness by status">
              {data.resource_status.map((row) => (
                <span
                  className={`dashboard-readiness-bar__segment dashboard-readiness-bar__segment--${row.status}`}
                  key={row.status}
                  style={{ width: `${(row.count / resourceTotal) * 100}%` }}
                  title={`${formatLabel(row.status)}: ${row.count}`}
                >
                  {Math.round((row.count / resourceTotal) * 100) >= 13 ? `${Math.round((row.count / resourceTotal) * 100)}%` : null}
                </span>
              ))}
            </div> : null}
            <div className="dashboard-readiness-legend">
              {data.resource_status.map((row) => <span key={row.status}><i className={`dashboard-readiness-dot dashboard-readiness-dot--${row.status}`} />{formatLabel(row.status)} <strong>{formatCount(row.count)}</strong></span>)}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
