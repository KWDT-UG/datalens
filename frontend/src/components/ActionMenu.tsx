import { AngleDownIcon } from '@patternfly/react-icons';
import { useEffect, useRef, useState } from 'react';

export type ActionMenuItem = {
  disabled?: boolean;
  label: string;
  onSelect: () => void;
  tone?: 'danger';
};

type ActionMenuProps = {
  items: ActionMenuItem[];
  label?: string;
  variant?: 'muted' | 'secondary';
};

export function ActionMenu({ items, label = 'Actions', variant = 'muted' }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="action-menu" ref={menuRef}>
      <button
        className={`button button--${variant}`}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <AngleDownIcon aria-hidden="true" />
      </button>
      {open ? (
        <div className="action-menu__panel" role="menu">
          {items.map((item) => (
            <button
              className={item.tone === 'danger' ? 'action-menu__danger' : ''}
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
