import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";

export function cn(...values: Array<string | false | null | undefined>) {
  return clsx(values);
}

const buttonStyles = cva("ds-button", {
  variants: {
    variant: {
      primary: "ds-button-primary",
      secondary: "ds-button-secondary",
      ghost: "ds-button-ghost",
      danger: "ds-button-danger",
    },
    size: {
      sm: "ds-button-sm",
      md: "ds-button-md",
      lg: "ds-button-lg",
      icon: "ds-button-icon",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export interface DsButtonProps
  extends
    ButtonHTMLAttributes<globalThis.HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {}

export const DsButton = forwardRef<globalThis.HTMLButtonElement, DsButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...props}
    />
  ),
);
DsButton.displayName = "DsButton";

const badgeStyles = cva("ds-badge", {
  variants: {
    tone: {
      neutral: "ds-badge-neutral",
      info: "ds-badge-info",
      success: "ds-badge-success",
      warning: "ds-badge-warning",
      danger: "ds-badge-danger",
      violet: "ds-badge-violet",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

export interface DsBadgeProps
  extends
    HTMLAttributes<globalThis.HTMLSpanElement>,
    VariantProps<typeof badgeStyles> {}

export function DsBadge({ className, tone, ...props }: DsBadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}

export interface DsPanelProps extends Omit<
  HTMLAttributes<globalThis.HTMLElement>,
  "title"
> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  action?: ReactNode;
}

export function DsPanel({
  action,
  children,
  className,
  eyebrow,
  title,
  ...props
}: DsPanelProps) {
  return (
    <section className={cn("ds-panel", className)} {...props}>
      {(eyebrow || title || action) && (
        <header className="ds-panel-header">
          <div>
            {eyebrow && <span className="ds-eyebrow">{eyebrow}</span>}
            {title && <h2>{title}</h2>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export interface DsMetricCardProps extends HTMLAttributes<globalThis.HTMLElement> {
  icon?: ReactNode;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger" | "violet";
}

export function DsMetricCard({
  className,
  detail,
  icon,
  label,
  tone = "neutral",
  value,
  ...props
}: DsMetricCardProps) {
  return (
    <article
      className={cn("ds-metric-card", `is-${tone}`, className)}
      {...props}
    >
      {icon && <span className="ds-metric-icon">{icon}</span>}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}

const alertStyles = cva("ds-alert", {
  variants: {
    tone: {
      info: "ds-alert-info",
      success: "ds-alert-success",
      warning: "ds-alert-warning",
      danger: "ds-alert-danger",
    },
  },
  defaultVariants: {
    tone: "info",
  },
});

export interface DsAlertProps
  extends
    Omit<HTMLAttributes<globalThis.HTMLElement>, "title">,
    VariantProps<typeof alertStyles> {
  title: ReactNode;
}

export function DsAlert({
  children,
  className,
  title,
  tone,
  ...props
}: DsAlertProps) {
  return (
    <aside className={cn(alertStyles({ tone }), className)} {...props}>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </aside>
  );
}

export interface DsEmptyStateProps extends Omit<
  HTMLAttributes<globalThis.HTMLElement>,
  "title"
> {
  icon?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  action?: ReactNode;
}

export function DsEmptyState({
  action,
  className,
  detail,
  icon,
  title,
  ...props
}: DsEmptyStateProps) {
  return (
    <section className={cn("ds-empty-state", className)} {...props}>
      {icon && <span className="ds-empty-icon">{icon}</span>}
      <div>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </section>
  );
}

export interface DsFieldProps extends InputHTMLAttributes<globalThis.HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
}

export const DsField = forwardRef<globalThis.HTMLInputElement, DsFieldProps>(
  ({ className, hint, label, ...props }, ref) => (
    <label className="ds-field">
      <span>{label}</span>
      <input ref={ref} className={cn("ds-input", className)} {...props} />
      {hint && <small>{hint}</small>}
    </label>
  ),
);
DsField.displayName = "DsField";

export function DsToolbar({
  children,
  className,
  ...props
}: HTMLAttributes<globalThis.HTMLDivElement>) {
  return (
    <div className={cn("ds-toolbar", className)} {...props}>
      {children}
    </div>
  );
}

export function DsTableShell({
  children,
  className,
  ...props
}: HTMLAttributes<globalThis.HTMLDivElement>) {
  return (
    <div className={cn("ds-table-shell", className)} {...props}>
      {children}
    </div>
  );
}
