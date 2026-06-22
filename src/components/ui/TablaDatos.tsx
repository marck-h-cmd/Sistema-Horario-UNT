import * as React from 'react';
import { cn } from '@/lib/utilidades';

type TablaDatosProps = React.HTMLAttributes<HTMLTableElement>;
type TablaHeaderProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TablaBodyProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TablaFooterProps = React.HTMLAttributes<HTMLTableSectionElement>;
type TablaRowProps = React.HTMLAttributes<HTMLTableRowElement>;
type TablaHeadProps = React.ThHTMLAttributes<HTMLTableCellElement>;
type TablaCellProps = React.TdHTMLAttributes<HTMLTableCellElement>;
type TablaCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>;

const TablaDatos = React.forwardRef<HTMLTableElement, TablaDatosProps>(
  function TablaDatos(props, ref) {
    const { className, ...rest } = props;
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn('w-full caption-bottom text-sm', className)}
          {...rest}
        />
      </div>
    );
  }
);
TablaDatos.displayName = 'TablaDatos';

const TablaHeader = React.forwardRef<HTMLTableSectionElement, TablaHeaderProps>(
  function TablaHeader(props, ref) {
    const { className, ...rest } = props;
    return (
      <thead
        ref={ref}
        className={cn(
          'sticky top-0 z-10 border-b border-slate-200/50 dark:border-slate-800 bg-slate-50/95 dark:bg-[#111827]/95 backdrop-blur-sm',
          className
        )}
        {...rest}
      />
    );
  }
);
TablaHeader.displayName = 'TablaHeader';

const TablaBody = React.forwardRef<HTMLTableSectionElement, TablaBodyProps>(
  function TablaBody(props, ref) {
    const { className, ...rest } = props;
    return (
      <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...rest}
      />
    );
  }
);
TablaBody.displayName = 'TablaBody';

const TablaFooter = React.forwardRef<HTMLTableSectionElement, TablaFooterProps>(
  function TablaFooter(props, ref) {
    const { className, ...rest } = props;
    return (
      <tfoot
        ref={ref}
        className={cn('border-t bg-gray-50 font-medium', className)}
        {...rest}
      />
    );
  }
);
TablaFooter.displayName = 'TablaFooter';

const TablaRow = React.forwardRef<HTMLTableRowElement, TablaRowProps>(
  function TablaRow(props, ref) {
    const { className, ...rest } = props;
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-slate-200/50 dark:border-slate-800 transition-colors duration-150 even:bg-slate-50/20 dark:even:bg-[#111827]/30 hover:bg-primary/5 dark:hover:bg-primary/10 data-[state=selected]:bg-primary/10',
          className
        )}
        {...rest}
      />
    );
  }
);
TablaRow.displayName = 'TablaRow';

const TablaHead = React.forwardRef<HTMLTableCellElement, TablaHeadProps>(
  function TablaHead(props, ref) {
    const { className, ...rest } = props;
    return (
      <th
        ref={ref}
        className={cn(
          'h-11 px-4 text-left align-middle text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0',
          className
        )}
        {...rest}
      />
    );
  }
);
TablaHead.displayName = 'TablaHead';

const TablaCell = React.forwardRef<HTMLTableCellElement, TablaCellProps>(
  function TablaCell(props, ref) {
    const { className, ...rest } = props;
    return (
      <td
        ref={ref}
        className={cn('px-4 py-3 align-middle text-slate-800 dark:text-slate-200 [&:has([role=checkbox])]:pr-0', className)}
        {...rest}
      />
    );
  }
);
TablaCell.displayName = 'TablaCell';

const TablaCaption = React.forwardRef<HTMLTableCaptionElement, TablaCaptionProps>(
  function TablaCaption(props, ref) {
    const { className, ...rest } = props;
    return (
      <caption
        ref={ref}
        className={cn('mt-4 text-sm text-gray-500', className)}
        {...rest}
      />
    );
  }
);
TablaCaption.displayName = 'TablaCaption';

export {
  TablaDatos,
  TablaHeader,
  TablaBody,
  TablaFooter,
  TablaHead,
  TablaRow,
  TablaCell,
  TablaCaption,
};