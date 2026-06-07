import { Link, useSearchParams } from 'react-router-dom';

import {
  useCommitteesQuery,
  useCommunitiesQuery,
  useCooperativesQuery,
  useGroupsQuery,
  useInstitutionsQuery,
  useMembersQuery,
  useResourcesQuery
} from '../api/queries';
import { useAuth } from '../auth/AuthContext';

const resultLimit = 6;

function formatMemberName(firstName: string, lastName: string, preferredName?: string) {
  return [preferredName || firstName, lastName].filter(Boolean).join(' ');
}

export function SearchPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') ?? '').trim();
  const enabled = query.length >= 2;
  const includeSensitive = !user?.roles.includes('communications_viewer');
  const params = { page: 1, page_size: resultLimit, search: query };
  const communities = useCommunitiesQuery({ ...params, ordering: 'name' }, enabled);
  const groups = useGroupsQuery({ ...params, ordering: 'name' }, enabled);
  const members = useMembersQuery({ ...params, ordering: 'last_name' }, enabled && includeSensitive);
  const institutions = useInstitutionsQuery(
    { ...params, ordering: 'name' },
    enabled && includeSensitive
  );
  const committees = useCommitteesQuery({ ...params, ordering: 'name' }, enabled);
  const cooperatives = useCooperativesQuery({ ...params, ordering: 'name' }, enabled);
  const resources = useResourcesQuery({ ...params, ordering: 'name' }, enabled);
  const isLoading = [
    communities,
    groups,
    members,
    institutions,
    committees,
    cooperatives,
    resources
  ].some((item) => item.isLoading && item.fetchStatus !== 'idle');
  const hasError = [
    communities,
    groups,
    members,
    institutions,
    committees,
    cooperatives,
    resources
  ].some((item) => item.isError);
  const total =
    (communities.data?.count ?? 0) +
    (groups.data?.count ?? 0) +
    (members.data?.count ?? 0) +
    (institutions.data?.count ?? 0) +
    (committees.data?.count ?? 0) +
    (cooperatives.data?.count ?? 0) +
    (resources.data?.count ?? 0);

  const sections = [
    {
      label: 'Communities',
      count: communities.data?.count ?? 0,
      results: (communities.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: [item.district_name, item.region_name].filter(Boolean).join(', '),
        to: `/communities/${item.id}/groups`
      }))
    },
    {
      label: 'Groups',
      count: groups.data?.count ?? 0,
      results: (groups.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.community_name ?? 'Community',
        to: `/communities/${item.community}/groups`
      }))
    },
    {
      label: 'Members',
      count: members.data?.count ?? 0,
      results: (members.data?.results ?? []).map((item) => ({
        id: item.id,
        label: formatMemberName(item.first_name, item.last_name, item.preferred_name),
        detail: [item.group_name, item.community_name].filter(Boolean).join(' · '),
        to: `/communities/${item.community}/members`
      }))
    },
    {
      label: 'Institutions',
      count: institutions.data?.count ?? 0,
      results: (institutions.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.community_name ?? 'Community',
        to: `/communities/${item.community}/institutions`
      }))
    },
    {
      label: 'Committees',
      count: committees.data?.count ?? 0,
      results: (committees.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.community_name ?? 'Community',
        to: `/communities/${item.community}/committees`
      }))
    },
    {
      label: 'Cooperatives',
      count: cooperatives.data?.count ?? 0,
      results: (cooperatives.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.community_name ?? 'Community',
        to: `/communities/${item.community}/cooperatives`
      }))
    },
    {
      label: 'Resources',
      count: resources.data?.count ?? 0,
      results: (resources.data?.results ?? []).map((item) => ({
        id: item.id,
        label: item.name,
        detail: item.community_name ?? 'Community',
        to: `/communities/${item.community}/resources`
      }))
    }
  ].filter((section) => section.count > 0);

  return (
    <section className="page-panel">
      <div className="page-header">
        <div>
          <p className="eyebrow">Global search</p>
          <h1>{query ? `Results for “${query}”` : 'Search Data Lens'}</h1>
          <p className="page-header__description">
            Search across communities, operational records, and resources.
          </p>
        </div>
      </div>

      {!enabled ? <div className="state-box">Enter at least two characters in the search bar.</div> : null}
      {enabled && isLoading ? <div className="state-box">Searching...</div> : null}
      {enabled && hasError ? (
        <div className="state-box state-box--error">Some search results could not be loaded.</div>
      ) : null}
      {enabled && !isLoading && total === 0 ? (
        <div className="state-box">No records match this search.</div>
      ) : null}

      {enabled && total > 0 ? (
        <>
          <p className="search-summary">{new Intl.NumberFormat().format(total)} matching records</p>
          <div className="search-results-grid">
            {sections.map((section) => (
              <section className="content-strip" key={section.label}>
                <h2>
                  {section.label} <span>{section.count}</span>
                </h2>
                {section.results.map((result) => (
                  <Link className="search-result" key={result.id} to={result.to}>
                    <strong>{result.label}</strong>
                    <span>{result.detail || 'No additional details'}</span>
                  </Link>
                ))}
              </section>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
