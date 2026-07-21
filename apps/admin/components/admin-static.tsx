import type { ReactNode } from "react";
import { Download, Filter, RefreshCw, Save } from "lucide-react";

type TagTone = "default" | "success" | "warning" | "error" | "info" | "purple";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        <div className="page-sub">{description}</div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Toolbar({
  search,
  filters = [],
  actions,
}: {
  search: string;
  filters?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <input className="input" placeholder={search} />
        {filters.map((filter) => (
          <select className="select" key={filter} defaultValue={filter}>
            <option>{filter}</option>
          </select>
        ))}
        <button className="admin-btn primary" type="button">
          查询
        </button>
        <button className="admin-btn" type="button">
          重置
        </button>
      </div>
      {actions && <div className="toolbar-right">{actions}</div>}
    </div>
  );
}

export function AdminTable({
  headers,
  rows,
  total,
}: {
  headers: string[];
  rows: ReactNode[][];
  total: string;
}) {
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination total={total} />
    </>
  );
}

export function Tag({ tone = "default", children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function RowActions({ actions }: { actions: Array<{ label: string; danger?: boolean }> }) {
  return (
    <div className="row-actions">
      {actions.map((action) => (
        <button className={`link-btn${action.danger ? " danger" : ""}`} key={action.label} type="button">
          {action.label}
        </button>
      ))}
    </div>
  );
}

export function UserCell({
  avatar,
  name,
  sub,
}: {
  avatar: string;
  name: string;
  sub?: string;
}) {
  return (
    <div className="user-cell">
      <span className="avatar-sm">{avatar}</span>
      <span>
        <b>{name}</b>
        {sub && <small>{sub}</small>}
      </span>
    </div>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; trend: string; tone?: TagTone }>;
}) {
  return (
    <section className="stat-grid">
      {items.map((item) => (
        <article className="stat-card" key={item.label}>
          <div>
            <div className="stat-label">{item.label}</div>
            <div className="stat-value">{item.value}</div>
            <div className="stat-trend">{item.trend}</div>
          </div>
          <span className={`stat-dot stat-dot-${item.tone ?? "info"}`} />
        </article>
      ))}
    </section>
  );
}

export function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <div className="admin-card-title">{title}</div>
        {sub && <div className="admin-card-sub">{sub}</div>}
      </div>
      <div className="admin-card-body">{children}</div>
    </section>
  );
}

export function DetailPreview({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, ReactNode]>;
}) {
  return (
    <Card title={title} sub="原型中的右侧抽屉静态预览">
      <dl className="desc-list">
        {rows.map(([label, value]) => (
          <div className="desc-row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function ConfigCard({
  logo,
  name,
  desc,
  enabled = true,
  fields,
}: {
  logo: string;
  name: string;
  desc: string;
  enabled?: boolean;
  fields: Array<[string, string]>;
}) {
  return (
    <section className="admin-card config-card">
      <div className="config-head">
        <div className="provider">
          <span className="provider-logo">{logo}</span>
          <span>
            <b>{name}</b>
            <small>{desc}</small>
          </span>
        </div>
        <span className={`switch${enabled ? " on" : ""}`} />
      </div>
      {fields.map(([label, value]) => (
        <label className="config-field" key={label}>
          <span>{label}</span>
          <input className="input" value={value} readOnly />
        </label>
      ))}
    </section>
  );
}

export function Bars({
  items,
}: {
  items: Array<{ label: string; value: string; height: number; tone: TagTone }>;
}) {
  return (
    <div className="bar-chart" aria-label="静态柱状图">
      {items.map((item) => (
        <div className="bar-group" key={item.label}>
          <div className={`bar bar-${item.tone}`} style={{ height: `${item.height}%` }}>
            <span className="bar-value">{item.value}</span>
          </div>
          <span className="bar-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ExportButton() {
  return (
    <button className="admin-btn" type="button">
      <Download size={14} />
      导出
    </button>
  );
}

export function FilterButton({ children = "审核队列" }: { children?: ReactNode }) {
  return (
    <button className="admin-btn primary" type="button">
      <Filter size={14} />
      {children}
    </button>
  );
}

export function RefreshButton() {
  return (
    <button className="admin-btn" type="button">
      <RefreshCw size={14} />
      刷新
    </button>
  );
}

export function SaveButton() {
  return (
    <button className="admin-btn primary" type="button">
      <Save size={14} />
      保存变更
    </button>
  );
}

function Pagination({ total }: { total: string }) {
  return (
    <div className="pagination">
      <span className="page-total">{total}</span>
      <button className="page-btn" type="button">
        ‹
      </button>
      <button className="page-btn active" type="button">
        1
      </button>
      <button className="page-btn" type="button">
        2
      </button>
      <button className="page-btn" type="button">
        3
      </button>
      <button className="page-btn" type="button">
        ›
      </button>
    </div>
  );
}
