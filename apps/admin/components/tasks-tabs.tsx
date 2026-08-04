"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileText } from "lucide-react";

const TABS = [
  { href: "/tasks/generation", label: "生成任务", Icon: Activity },
  { href: "/tasks/illustration", label: "插画任务", Icon: FileText },
] as const;

export function TasksTabs() {
  const pathname = usePathname();

  return (
    <div className="tasks-tabs" role="tablist" aria-label="任务类型">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            role="tab"
            aria-selected={active}
            className={`tasks-tab${active ? " active" : ""}`}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
