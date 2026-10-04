export function reverseOrdering(ordering: string) {
  return ordering
    .split(',')
    .map((field) => (field.startsWith('-') ? field.slice(1) : `-${field}`))
    .join(',');
}

export function orderingDirection(currentOrdering: string, columnOrdering: string) {
  if (currentOrdering === columnOrdering) {
    return 'ascending' as const;
  }
  if (currentOrdering === reverseOrdering(columnOrdering)) {
    return 'descending' as const;
  }
  return null;
}

export function SortableTableHeader({
  currentOrdering,
  label,
  onChange,
  ordering
}: {
  currentOrdering: string;
  label: string;
  onChange: (ordering: string) => void;
  ordering: string;
}) {
  const direction = orderingDirection(currentOrdering, ordering);

  return (
    <th aria-sort={direction ?? 'none'}>
      <button
        aria-label={`Sort by ${label}${direction ? `, currently ${direction}` : ''}`}
        className={`sortable-header${direction ? ` is-${direction}` : ''}`}
        type="button"
        onClick={() => onChange(ordering)}
      >
        {label}
      </button>
    </th>
  );
}
