import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  isDanger?: boolean;
}

interface MenuProps {
  anchor: HTMLElement;
  items: MenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 240;
const GAP = 6;

/** Small popover next to `anchor`, kept inside the viewport and closed on outside clicks. */
export function Menu({ anchor, items, onClose }: MenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? 0;
    const below = box.bottom + GAP;
    const top = below + height > window.innerHeight ? Math.max(GAP, box.top - height - GAP) : below;
    const left = Math.min(
      Math.max(GAP, box.right - MENU_WIDTH),
      window.innerWidth - MENU_WIDTH - GAP,
    );

    setPosition({ top, left });
  }, [anchor]);

  useEffect(() => {
    const close = (event: Event) => {
      if (!menu.current?.contains(event.target instanceof Node ? event.target : null)) {
        onClose();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);

    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menu}
      role="menu"
      style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
      className="fixed z-[55] overflow-hidden rounded-2xl border border-line bg-bg/95 py-1.5 shadow-2xl backdrop-blur-xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            item.onSelect();
          }}
          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-2 ${item.isDanger ? 'text-danger' : ''}`}
        >
          <span className="text-muted">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
