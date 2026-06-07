import { Link } from 'react-router-dom';

import { useDashboardQuery } from '../api/queries';
import { useAuth } from '../auth/AuthContext';
import { canReviewApprovals } from '../auth/permissions';

function formatCount(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboardQuery();
  const data = dashboard.data?.data;
  const metrics = data?.metrics;

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="page-header__description">
            Current operational totals, impact, approvals, and recent record activity.
          </p>
        </div>
        <Link className="button button--primary" to="/reports">
          Open reports
        </Link>
      </div>

      {dashboard.isLoading ? <div className="state-box">Loading dashboard...</div> : null}
      {dashboard.isError ? (
        <div className="state-box state-box--error">Unable to load dashboard metrics.</div>
      ) : null}

      {data ? (
        <>
          <div className="metric-grid">
            <article className="metric-card">
              <span>Communities</span>
              <strong>{formatCount(metrics?.community_count)}</strong>
            </article>
            <article className="metric-card">
              <span>Groups</span>
              <strong>{formatCount(metrics?.group_count)}</strong>
            </article>
            <article className="metric-card">
              <span>Active members</span>
              <strong>{formatCount(metrics?.active_member_count)}</strong>
            </article>
            <article className="metric-card">
              <span>Resources</span>
              <strong>{formatCount(metrics?.resource_count)}</strong>
            </article>
            <article className="metric-card">
              <span>Beneficiaries recorded</span>
              <strong>{formatCount(metrics?.beneficiary_count)}</strong>
            </article>
            <article className="metric-card">
              <span>Pending approvals</span>
              <strong>{formatCount(metrics?.pending_approval_count)}</strong>
              {canReviewApprovals(user) ? <Link to="/approvals">Review queue</Link> : null}
            </article>
          </div>

          <div className="report-grid">
            <section className="content-strip">
              <h2>Resource status</h2>
              {data.resource_status.length === 0 ? <p>No resources recorded yet.</p> : null}
              {data.resource_status.map((row) => (
                <div className="report-row" key={row.status}>
                  <span>{formatLabel(row.status)}</span>
                  <strong>{formatCount(row.count)}</strong>
                </div>
              ))}
            </section>

            <section className="content-strip">
              <h2>Recent activity</h2>
              {data.recent_activity.length === 0 ? <p>No recent activity.</p> : null}
              {data.recent_activity.map((activity) => (
                <Link
                  className="activity-row"
                  key={`${activity.type}-${activity.id}`}
                  to={activity.path}
                >
                  <span>
                    <strong>{activity.label}</strong>
                    <small>{activity.community_name}</small>
                  </span>
                  <time dateTime={activity.updated_at}>{formatDate(activity.updated_at)}</time>
                </Link>
              ))}
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}
