/**
 * 编辑器侧栏导航链接（客户端组件）
 *
 * 从 URL pathname 中提取当前 scriptId，确保侧栏链接
 * 始终指向当前打开的剧本，而非 scriptsTyped[0]。
 */
'use client';

import { usePathname } from 'next/navigation';
import { Clock, FlaskConical, CreditCard, Users, ImageIcon } from 'lucide-react';
import { NavItem } from './nav-item';

interface EditorNavLinksProps {
  /** 服务端传入的 fallback scriptId（无剧本时禁用） */
  fallbackScriptId?: string;
}

function extractScriptId(pathname: string): string | null {
  // /editor/[scriptId] or /editor/[scriptId]/sub
  const match = pathname.match(/^\/editor\/([a-f0-9-]+)/);
  return match?.[1] ?? null;
}

export function EditorNavLinks({ fallbackScriptId }: EditorNavLinksProps) {
  const pathname = usePathname();
  const scriptId = extractScriptId(pathname) ?? fallbackScriptId;
  const hasScript = scriptId != null;
  const editorBase = hasScript ? `/editor/${scriptId}` : '/generate';
  const navHref = (sub: string) => (hasScript ? `${editorBase}/${sub}` : '/generate');

  return (
    <>
      <div className="nav-section-title">校验</div>
      <NavItem
        href={navHref('timeline')}
        icon={<Clock />}
        label="时间线校验"
        disabled={!hasScript}
      />
      <NavItem
        href={navHref('validation')}
        icon={<FlaskConical />}
        label="逻辑校验"
        disabled={!hasScript}
      />

      <div className="nav-section-title">物料</div>
      <NavItem
        href={navHref('clues')}
        icon={<CreditCard />}
        label="线索卡管理"
        disabled={!hasScript}
      />
      <NavItem
        href={navHref('relations')}
        icon={<Users />}
        label="人物关系"
        disabled={!hasScript}
      />
      <NavItem
        href={navHref('illustrations')}
        icon={<ImageIcon />}
        label="插画生成"
        disabled={!hasScript}
      />
    </>
  );
}
