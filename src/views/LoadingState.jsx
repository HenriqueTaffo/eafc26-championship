function LoadingSkeletonRows({ count = 2 }) {
  const total = Math.max(1, Math.min(Number(count || 2), 6));

  return (
    <div className="app-loading-skeleton" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span className="app-skeleton-row" key={index}>
          <i></i>
          <b style={{ width: `${Math.max(42, 78 - index * 8)}%` }}></b>
          <em style={{ width: `${Math.max(28, 58 - index * 7)}%` }}></em>
        </span>
      ))}
    </div>
  );
}

function InlineLoader({ label = "Carregando", className = "" }) {
  return (
    <span
      className={`app-inline-loader ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="app-loading-spinner" aria-hidden="true"></span>
      <span>{label}</span>
    </span>
  );
}

function LoadingState({
  title = "Carregando",
  detail = "",
  className = "",
  compact = false,
  skeleton = 0,
  as: Component = "div",
}) {
  return (
    <Component
      className={[
        "app-loading-state",
        compact ? "is-compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="app-loading-spinner" aria-hidden="true"></span>
      <span className="app-loading-copy">
        <strong>{title}</strong>
        {detail ? <small>{detail}</small> : null}
      </span>
      {skeleton ? <LoadingSkeletonRows count={skeleton} /> : null}
    </Component>
  );
}

export { InlineLoader, LoadingState };
