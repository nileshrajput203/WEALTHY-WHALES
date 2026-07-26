import React from 'react';
import { motion } from 'framer-motion';
import { COLORS, SHADOWS, BORDER_RADIUS, MOTION_VARIANTS } from './DesignTokens';

interface PremiumCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'glass' | 'gradient' | 'elevated';
  hover?: boolean;
  animated?: boolean;
  onClick?: () => void;
}

export const PremiumCard: React.FC<PremiumCardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = true,
  animated = true,
  onClick,
}) => {
  const baseStyles = `
    rounded-xl p-4 sm:p-6 transition-all duration-300
    ${onClick ? 'cursor-pointer' : ''}
  `;

  const variantStyles = {
    default: `
      bg-neutral-900/50 border border-neutral-800
      ${hover ? 'hover:border-primary-500/50 hover:shadow-lg' : ''}
    `,
    glass: `
      bg-neutral-900/30 backdrop-blur-md border border-neutral-700/30
      ${hover ? 'hover:border-primary-500/50 hover:bg-neutral-900/50' : ''}
    `,
    gradient: `
      bg-gradient-to-br from-primary-900/20 to-accent-900/20
      border border-primary-500/20
      ${hover ? 'hover:border-primary-500/50' : ''}
    `,
    elevated: `
      bg-neutral-800 border border-neutral-700 shadow-lg
      ${hover ? 'hover:shadow-xl hover:border-primary-500/50' : ''}
    `,
  };

  const hoverTransform = hover ? 'hover:scale-105 hover:-translate-y-1' : '';

  const content = (
    <div className={`${baseStyles} ${variantStyles[variant]} ${hoverTransform} ${className}`}>
      {children}
    </div>
  );

  if (animated) {
    return (
      <motion.div
        variants={MOTION_VARIANTS.slideInUp}
        initial="initial"
        animate="animate"
        exit="exit"
        onClick={onClick}
      >
        {content}
      </motion.div>
    );
  }

  return <div onClick={onClick}>{content}</div>;
};

interface PremiumGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PremiumGrid: React.FC<PremiumGridProps> = ({
  children,
  cols = 3,
  gap = 'md',
  className = '',
}) => {
  const colsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  const gapClass = {
    sm: 'gap-3',
    md: 'gap-4 sm:gap-6',
    lg: 'gap-6 sm:gap-8',
  };

  return (
    <div className={`grid ${colsClass[cols]} ${gapClass[gap]} ${className}`}>
      {children}
    </div>
  );
};

interface PremiumBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  label,
  variant = 'primary',
  size = 'md',
  icon,
}) => {
  const variantStyles = {
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    danger: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    primary: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]}`}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="font-medium">{label}</span>
    </div>
  );
};

interface PremiumStatProps {
  label: string;
  value: string | number;
  change?: number;
  unit?: string;
  icon?: React.ReactNode;
}

export const PremiumStat: React.FC<PremiumStatProps> = ({
  label,
  value,
  change,
  unit = '',
  icon,
}) => {
  const isPositive = change && change > 0;

  return (
    <motion.div
      variants={MOTION_VARIANTS.slideInUp}
      initial="initial"
      animate="animate"
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-sm font-medium">{label}</span>
        {icon && <span className="text-primary-400">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-bold text-white">
          {value}
          {unit && <span className="text-lg text-neutral-400 ml-1">{unit}</span>}
        </span>
        {change !== undefined && (
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
    </motion.div>
  );
};
