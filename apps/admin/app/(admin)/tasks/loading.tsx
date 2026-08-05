export default function TasksLoading() {
  return (
    <div className="page-stack">
      <div className="admin-card" aria-busy="true" aria-live="polite">
        <div className="tasks-loading-bar" />
        <div className="tasks-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tasks-loading-row">
              <div className="tasks-loading-cell tasks-loading-cell--title" />
              <div className="tasks-loading-cell tasks-loading-cell--author" />
              <div className="tasks-loading-cell tasks-loading-cell--tag" />
              <div className="tasks-loading-cell tasks-loading-cell--status" />
              <div className="tasks-loading-cell tasks-loading-cell--small" />
              <div className="tasks-loading-cell tasks-loading-cell--small" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}