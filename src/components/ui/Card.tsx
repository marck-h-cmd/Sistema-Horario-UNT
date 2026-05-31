import * as React from 'react';
import { cn } from '@/lib/utilidades';

type CardElement = HTMLDivElement;
type CardProps = React.HTMLAttributes<HTMLDivElement>;

const CardRoot = React.forwardRef<CardElement, CardProps>(
  function Card(props, ref) {
    const { className, ...rest } = props;
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-card',
          className
        )}
        {...rest}
      />
    );
  }
);
CardRoot.displayName = 'Card';

const CardHeader = React.forwardRef<CardElement, CardProps>(
  function CardHeader(props, ref) {
    const { className, ...rest } = props;
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-6', className)}
        {...rest}
      />
    );
  }
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle(props, ref) {
    const { className, ...rest } = props;
    return (
      <h3
        ref={ref}
        className={cn(
          'font-display text-xl font-semibold leading-none tracking-tight text-unt-blue dark:text-unt-gold-light',
          className
        )}
        {...rest}
      />
    );
  }
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  function CardDescription(props, ref) {
    const { className, ...rest } = props;
    return (
      <p
        ref={ref}
        className={cn('text-sm text-gray-500 dark:text-slate-400', className)}
        {...rest}
      />
    );
  }
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<CardElement, CardProps>(
  function CardContent(props, ref) {
    const { className, ...rest } = props;
    return <div ref={ref} className={cn('p-6 pt-0', className)} {...rest} />;
  }
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<CardElement, CardProps>(
  function CardFooter(props, ref) {
    const { className, ...rest } = props;
    return (
      <div
        ref={ref}
        className={cn('flex items-center p-6 pt-0', className)}
        {...rest}
      />
    );
  }
);
CardFooter.displayName = 'CardFooter';

// Crear Card con tipado explícito
interface CardComponent extends React.ForwardRefExoticComponent<CardProps & React.RefAttributes<CardElement>> {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Description: typeof CardDescription;
  Content: typeof CardContent;
  Footer: typeof CardFooter;
}

const Card = CardRoot as CardComponent;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };