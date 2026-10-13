import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'fresh' | 'success' | 'warning' | 'discount' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'fresh',
  className = '',
  ...props
}) => {
  const variantStyles = {
    fresh: 'bg-brand-50 text-brand-800 border-brand-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-warning-50 text-warning-700 border-warning-200',
    discount: 'bg-amber-50 text-amber-800 border-amber-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }[variant];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${variantStyles} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
};
