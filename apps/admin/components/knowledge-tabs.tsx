"use client";

import { useState, type ReactNode } from "react";

export type KnowledgeTab = "items" | "intake" | "usage";

export function KnowledgeTabs({
  initialTab,
  items,
  intake,
  usage,
}: {
  initialTab: KnowledgeTab;
  items: ReactNode;
  intake: ReactNode;
  usage: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<KnowledgeTab>(initialTab);

  return (
    <>
      <nav aria-label="知识库分区" className="admin-tabs" role="tablist">
        <TabButton active={activeTab === "items"} label="知识条目" onClick={() => setActiveTab("items")} />
        <TabButton active={activeTab === "intake"} label="资料抽取" onClick={() => setActiveTab("intake")} />
        <TabButton active={activeTab === "usage"} label="引用与质检" onClick={() => setActiveTab("usage")} />
      </nav>
      {activeTab === "items" && items}
      {activeTab === "intake" && intake}
      {activeTab === "usage" && usage}
    </>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`admin-tab${active ? " active" : ""}`}
      role="tab"
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
