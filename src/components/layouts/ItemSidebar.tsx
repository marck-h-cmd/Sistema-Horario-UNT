'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utilidades';

export interface ItemSidebarProps {
  icono: LucideIcon;
  label: string;
  href?: string;
  badge?: string | number;
  children?: ItemSidebarProps[];
  collapsed?: boolean;
}

export function ItemSidebar({
  icono: Icono,
  label,
  href,
  badge,
  children,
  collapsed = false,
}: ItemSidebarProps) {
  const pathname = usePathname();
  const hasChildren = children && children.length > 0;
  const childIsActive = React.useMemo(() => {
    return hasChildren && children.some(child => child.href === pathname);
  }, [pathname, children, hasChildren]);

  const [isOpen, setIsOpen] = React.useState(childIsActive);

  React.useEffect(() => {
    if (childIsActive) {
      setIsOpen(true);
    }
  }, [childIsActive]);

  const isActive = href ? pathname === href || pathname.startsWith(`${href}/`) : false;

  const handleClick = () => {
    if (hasChildren) {
      setIsOpen(!isOpen);
    }
  };

  const itemContent = (
    <>
      <div className="flex items-center gap-3 flex-1">
        <Icono className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="font-medium">{label}</span>}
      </div>

      {!collapsed && badge && (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600">
          {badge}
        </span>
      )}

      {!collapsed && hasChildren && (
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      )}
    </>
  );

  const itemClasses = cn(
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
    'hover:bg-gray-100',
    isActive && 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    !isActive && 'text-gray-700',
    collapsed && 'justify-center'
  );

  return (
    <div>
      {href && !hasChildren ? (
        <Link href={href} className={itemClasses}>
          {itemContent}
        </Link>
      ) : (
        <button
          onClick={handleClick}
          className={cn(itemClasses, 'w-full')}
        >
          {itemContent}
        </button>
      )}

      {/* Submenú */}
      {!collapsed && hasChildren && isOpen && (
        <div className="ml-8 mt-1 space-y-1">
          {children.map((child, index) => (
            <Link
              key={index}
              href={child.href || '#'}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === child.href
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}