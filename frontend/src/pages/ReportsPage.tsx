import { useState } from 'react';
import { Link } from 'react-router-dom';

import { apiGetAllPages } from '../api/client';
import {
  useDashboardQuery,
  useImpactByCommunityQuery,
  useImpactByResourceQuery,
  useImpactSummaryQuery
} from '../api/queries';
import type { Community, ImpactRecord, Resource } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { capabilities, hasCapability } from '../auth/permissions';
import { downloadCsv } from '../utils/listActions';

function formatCount(value?: number) {
  return new Intl.NumberFormat().format(value ?? 0);
}

export function ReportsPage() {
  const { user } = useAuth();
  const canExport = hasCapability(user, capabilities.export);
  const dashboard = useDashboardQuery();
  const impact = useImpactSummaryQuery();
  const byCommunity = useImpactByCommunityQuery();
  const byResource = useImpactByResourceQuery();
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');
  const metrics = dashboard.data?.data.metrics;
  const impactMetrics = impact.data?.data;

  async function exportReport(report: 'communities' | 'resources' | 'impact') {
    setExporting(report);
    setExportError('');
    try {
      if (report === 'communities') {
        const rows = await apiGetAllPages<Community>('/api/v1/communities/', {
          ordering: 'name'
        });
        downloadCsv(
          'community-summary.csv',
          rows.map((community) => ({
            name: community.name,
            area: community.area_name,
            district: community.district_name,
            region: community.region_name,
            country: community.country,
            status: community.status,
            members: community.member_count,
            groups: community.group_count,
            institutions: community.institution_count,
            committees: community.committee_count,
            cooperatives: community.cooperative_count,
            resources: community.resource_count,
            updated_at: community.updated_at
          }))
        );
      } else if (report === 'resources') {
        const rows = await apiGetAllPages<Resource>('/api/v1/resources/', {
          ordering: 'name'
        });
        downloadCsv(
          'resource-delivery.csv',
          rows.map((resource) => ({
            name: resource.name,
            community: resource.community_name,
            type: resource.resource_type,
            owner_type: resource.owner_type,
            status: resource.status,
            quantity: resource.quantity,
            unit: resource.unit,
            value_amount: resource.value_amount,
            value_currency: resource.value_currency,
            acquired_on: resource.acquired_on,
            thematic_areas: resource.thematic_areas?.map((area) => area.name).join('; '),
            updated_at: resource.updated_at
          }))
        );
      } else {
        const rows = await apiGetAllPages<ImpactRecord>('/api/v1/impact-records/', {
          ordering: '-as_of_date'
        });
        downloadCsv(
          'impact-records.csv',
          rows.map((record) => ({
            resource: record.resource_name,
            community: record.community_name,
            period_type: record.period_type,
            period_start: record.period_start,
            period_end: record.period_end,
            as_of_date: record.as_of_date,
            beneficiary_count: record.beneficiary_count,
            household_count: record.household_count,
            member_count: record.member_count,
            institution_count: record.institution_count,
            method: record.method,
            notes: record.notes,
            updated_at: record.updated_at
          }))
        );
      }
    } catch {
      setExportError('The report export could not be generated. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1>Reports</h1>
          <p className="page-header__description">
            Operational, resource delivery, and impact reporting from the full dataset.
          </p>
        </div>
        <Link className="button button--secondary" to="/impact">
          Open impact analysis
        </Link>
      </div>

      {dashboard.isLoading || impact.isLoading ? <div className="state-box">Loading reports...</div> : null}
      {dashboard.isError || impact.isError ? (
        <div className="state-box state-box--error">Unable to load report summaries.</div>
      ) : null}
      {exportError ? <div className="state-box state-box--error">{exportError}</div> : null}

      <div className="metric-grid">
        <article className="metric-card">
          <span>Communities</span>
          <strong>{formatCount(metrics?.community_count)}</strong>
        </article>
        <article className="metric-card">
          <span>Resources delivered</span>
          <strong>{formatCount(metrics?.resource_count)}</strong>
        </article>
        <article className="metric-card">
          <span>Impact records</span>
          <strong>{formatCount(impactMetrics?.record_count)}</strong>
        </article>
        <article className="metric-card">
          <span>Beneficiaries recorded</span>
          <strong>{formatCount(impactMetrics?.beneficiary_count)}</strong>
        </article>
      </div>

      <div className="report-card-grid">
        <article className="report-card">
          <h2>Community summary</h2>
          <p>Community location, status, and complete operational record counts.</p>
          {canExport ? (
            <button
              className="button button--primary"
              type="button"
              disabled={exporting !== null}
              onClick={() => void exportReport('communities')}
            >
              {exporting === 'communities' ? 'Preparing...' : 'Export all communities'}
            </button>
          ) : null}
        </article>
        <article className="report-card">
          <h2>Resource delivery</h2>
          <p>Full resource inventory with community, lifecycle, value, and thematic data.</p>
          {canExport ? (
            <button
              className="button button--primary"
              type="button"
              disabled={exporting !== null}
              onClick={() => void exportReport('resources')}
            >
              {exporting === 'resources' ? 'Preparing...' : 'Export all resources'}
            </button>
          ) : null}
        </article>
        <article className="report-card">
          <h2>Impact records</h2>
          <p>Full time-based impact dataset with beneficiary and household measures.</p>
          {canExport ? (
            <button
              className="button button--primary"
              type="button"
              disabled={exporting !== null}
              onClick={() => void exportReport('impact')}
            >
              {exporting === 'impact' ? 'Preparing...' : 'Export all impact records'}
            </button>
          ) : null}
        </article>
      </div>

      <div className="report-grid">
        <section className="content-strip">
          <h2>Impact by community</h2>
          {(byCommunity.data?.data ?? []).slice(0, 8).map((row) => (
            <div className="report-row" key={row.community}>
              <span>{row.community_name}</span>
              <strong>{formatCount(row.beneficiary_count)} beneficiaries</strong>
            </div>
          ))}
        </section>
        <section className="content-strip">
          <h2>Impact by resource</h2>
          {(byResource.data?.data ?? []).slice(0, 8).map((row) => (
            <div className="report-row" key={row.resource}>
              <span>{row.resource_name}</span>
              <strong>{formatCount(row.beneficiary_count)} beneficiaries</strong>
            </div>
          ))}
        </section>
      </div>
    </section>
  );
}
