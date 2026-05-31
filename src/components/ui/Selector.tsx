'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utilidades';

const Selector = SelectPrimitive.Root;
const SelectorGroup = SelectPrimitive.Group;
const SelectorValue = SelectPrimitive.Value;

// Tipos manuales
type SelectorTriggerProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>;
type SelectorContentProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
  position?: 'item-aligned' | 'popper';
};
type SelectorLabelProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>;
type SelectorItemProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>;
type SelectorSeparatorProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>;
type SelectorScrollUpButtonProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>;
type SelectorScrollDownButtonProps = React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>;

const SelectorTrigger = React.forwardRef<HTMLButtonElement, SelectorTriggerProps>(
  (props, ref) => {
    const { className, children, ...rest } = props;
    return (
      <SelectPrimitive.Trigger
        ref={ref}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 ring-offset-background placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-unt-gold/40',
          className
        )}
        {...rest}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  }
);
SelectorTrigger.displayName = 'SelectorTrigger';

const SelectorScrollUpButton = React.forwardRef<HTMLDivElement, SelectorScrollUpButtonProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <SelectPrimitive.ScrollUpButton
        ref={ref}
        className={cn('flex cursor-default items-center justify-center py-1', className)}
        {...rest}
      >
        <ChevronUp className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
    );
  }
);
SelectorScrollUpButton.displayName = 'SelectorScrollUpButton';

const SelectorScrollDownButton = React.forwardRef<HTMLDivElement, SelectorScrollDownButtonProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <SelectPrimitive.ScrollDownButton
        ref={ref}
        className={cn('flex cursor-default items-center justify-center py-1', className)}
        {...rest}
      >
        <ChevronDown className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    );
  }
);
SelectorScrollDownButton.displayName = 'SelectorScrollDownButton';

const SelectorContent = React.forwardRef<HTMLDivElement, SelectorContentProps>(
  (props, ref) => {
    const { className, children, position = 'popper', ...rest } = props;
    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          className={cn(
            'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-md dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            position === 'popper' &&
              'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
            className
          )}
          position={position}
          {...rest}
        >
          <SelectorScrollUpButton />
          <SelectPrimitive.Viewport
            className={cn(
              'p-1',
              position === 'popper' &&
                'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
            )}
          >
            {children}
          </SelectPrimitive.Viewport>
          <SelectorScrollDownButton />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  }
);
SelectorContent.displayName = 'SelectorContent';

const SelectorLabel = React.forwardRef<HTMLDivElement, SelectorLabelProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <SelectPrimitive.Label
        ref={ref}
        className={cn('py-1.5 pl-8 pr-2 text-sm font-semibold', className)}
        {...rest}
      />
    );
  }
);
SelectorLabel.displayName = 'SelectorLabel';

const SelectorItem = React.forwardRef<HTMLDivElement, SelectorItemProps>(
  (props, ref) => {
    const { className, children, ...rest } = props;
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cn(
          'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-slate-800 dark:focus:text-slate-100',
          className
        )}
        {...rest}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }
);
SelectorItem.displayName = 'SelectorItem';

const SelectorSeparator = React.forwardRef<HTMLDivElement, SelectorSeparatorProps>(
  (props, ref) => {
    const { className, ...rest } = props;
    return (
      <SelectPrimitive.Separator
        ref={ref}
        className={cn('-mx-1 my-1 h-px bg-gray-200 dark:bg-slate-700', className)}
        {...rest}
      />
    );
  }
);
SelectorSeparator.displayName = 'SelectorSeparator';

export {
  Selector,
  SelectorGroup,
  SelectorValue,
  SelectorTrigger,
  SelectorContent,
  SelectorLabel,
  SelectorItem,
  SelectorSeparator,
  SelectorScrollUpButton,
  SelectorScrollDownButton,
};