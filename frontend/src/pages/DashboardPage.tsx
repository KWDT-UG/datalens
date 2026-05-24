import { Link } from 'react-router-dom';

import { useCommunitiesQuery } from '../api/queries';

export function DashboardPage() {
  const communities = useCommunitiesQuery({ page: 1, ordering: 'name' });
  const totalCommunities = communities.data?.count ?? 0;
  const visibleRows = communities.data?.results ?? [];

  const memberTotal = visibleRows.reduce((sum, community) => sum + (community.member_count ?? 0), 0);
  const resourceTotal = visibleRows.reduce((sum, community) => sum + (community.resource_count ?? 0), 0);
  const groupTotal = visibleRows.reduce((sum, community) => sum + (community.group_count ?? 0), 0);

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="page-header__description">
            A first pass at the operational summary, backed by the existing community API.
          </p>
        </div>
        <Link className="button button--primary" to="/communities">
          View communities
        </Link>
      </div>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Total communities</span>
          <strong>{totalCommunities}</strong>
        </article>
        <article className="metric-card">
          <span>Groups shown</span>
          <strong>{groupTotal}</strong>
        </article>
        <article className="metric-card">
          <span>Members shown</span>
          <strong>{memberTotal}</strong>
        </article>
        <article className="metric-card">
          <span>Resources shown</span>
          <strong>{resourceTotal}</strong>
        </article>
      </div>

      <div className="content-strip">
        <h2>Recent activity</h2>
        <p>
          Activity and approval feeds will attach here as the UI milestones expand beyond the
          foundation.
        </p>
      </div>
    </section>
  );
}
