'use client';

import { useRef, useState } from 'react';
import { App as AntdApp, Checkbox } from 'antd';
import { Download, Grid3x3 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  ClueCard,
  STYLE_CHIPS,
  type Clue,
  type ClueCardStyle,
} from '@/components/clue-card/clue-card';
import { ClueDetail } from '@/components/clue-card/clue-detail';
import { ClueHierarchy } from '@/components/clue-card/clue-hierarchy';
import { ClueTabs, useClueFilter } from '@/components/clue-card/clue-tabs';
import { ClueTags } from '@/components/clue-card/clue-tags';
import {
  ExportProgress,
  type ExportStatus,
} from '@/components/clue-card/export-progress';
import { Modal } from '@/components/common/modal';
import {
  downloadImagesAsZip,
  exportCluesToImages,
  type ExportedImage,
} from '@/lib/export/clue-image-export';
import {
  markClueDistractorAction,
  markClueKeyAction,
} from '@/app/(dashboard)/editor/[scriptId]/clues/actions';

const REDRAW_STAMPS = ['〔AI 重绘〕', '〔水墨重绘〕', '〔细节增强〕', '〔构图微调〕'];

function stripRedrawStamp(text: string): string {
  return text.replace(/\s*〔[^〕]*重绘[^〕]*〕\s*$/, '');
}

interface CluesManagerProps {
  scriptId: string;
  initialClues: Clue[];
}

export function CluesManager({ scriptId, initialClues }: CluesManagerProps) {
  const [clues, setClues] = useState<Clue[]>(initialClues);
  const filter = useClueFilter(clues);
  const [style, setStyle] = useState<ClueCardStyle>('ink');
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');
  const [exportDone, setExportDone] = useState(0);
  const [exportTotal, setExportTotal] = useState(0);
  const [exportLabel, setExportLabel] = useState<string | undefined>(undefined);
  const [progressMode, setProgressMode] = useState<'export' | 'redraw'>('export');
  const [redrawOpen, setRedrawOpen] = useState(false);
  const [redrawSelectedIds, setRedrawSelectedIds] = useState<Set<string>>(new Set());
  const { message } = AntdApp.useApp();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const selectedClue = clues.find((c) => c.id === selectedClueId) ?? null;

  const replaceClue = (nextClue: Clue) => {
    setClues((prev) => prev.map((clue) => (clue.id === nextClue.id ? nextClue : clue)));
  };

  const handleMarkDistractor = async (clueId: string, isDistractor: boolean) => {
    const previous = clues;
    setClues((prev) =>
      prev.map((clue) =>
        clue.id === clueId
          ? { ...clue, isDistractor, isKey: isDistractor ? false : clue.isKey }
          : clue,
      ),
    );

    try {
      const updated = await markClueDistractorAction(scriptId, clueId, isDistractor);
      replaceClue(updated);
      message.success(isDistractor ? '已标记为干扰线索' : '已取消干扰标记');
    } catch (error) {
      setClues(previous);
      message.error(error instanceof Error ? error.message : '更新干扰标记失败');
    }
  };

  const handleMarkKeyClue = async (clueId: string, isKey: boolean) => {
    const previous = clues;
    setClues((prev) =>
      prev.map((clue) =>
        clue.id === clueId
          ? { ...clue, isKey, isDistractor: isKey ? false : clue.isDistractor }
          : clue,
      ),
    );

    try {
      const updated = await markClueKeyAction(scriptId, clueId, isKey);
      replaceClue(updated);
      message.success(isKey ? '已标记为关键线索' : '已取消关键标记');
    } catch (error) {
      setClues(previous);
      message.error(error instanceof Error ? error.message : '更新关键标记失败');
    }
  };

  const handleJumpToTruth = () => {
    router.push(`/editor/${scriptId}?node=truth`);
  };

  const handleExportPng = async () => {
    if (!gridRef.current || filter.visible.length === 0) return;
    setProgressMode('export');
    setExportOpen(true);
    setExportStatus('running');
    setExportDone(0);
    setExportTotal(filter.visible.length);
    setExportLabel(undefined);

    try {
      const nodes = filter.visible
        .map((clue) => gridRef.current?.querySelector(`[data-clue-id="${clue.id}"]`) as HTMLElement | null)
        .filter((node): node is HTMLElement => node !== null);

      const images: ExportedImage[] = [];
      for (let i = 0; i < nodes.length; i += 1) {
        setExportLabel(filter.visible[i].title);
        const batch = await exportCluesToImages([nodes[i]], [filter.visible[i]]);
        images.push(...batch);
        setExportDone(i + 1);
      }

      await downloadImagesAsZip(images, `${scriptId}_线索卡`);
      setExportStatus('completed');
    } catch {
      setExportStatus('failed');
    }
  };

  const handleBatchRedraw = () => {
    if (filter.visible.length === 0) {
      message.warning('当前筛选下没有可重绘的线索卡');
      return;
    }
    setRedrawSelectedIds(new Set(filter.visible.map((clue) => clue.id)));
    setRedrawOpen(true);
  };

  const handleRedrawConfirm = async () => {
    const ids = Array.from(redrawSelectedIds);
    if (ids.length === 0) {
      message.warning('请至少选择一张线索卡');
      return;
    }
    setRedrawOpen(false);
    setProgressMode('redraw');
    setExportOpen(true);
    setExportStatus('running');
    setExportDone(0);
    setExportTotal(ids.length);
    setExportLabel(undefined);

    try {
      for (let i = 0; i < ids.length; i += 1) {
        const clue = clues.find((item) => item.id === ids[i]);
        if (clue) setExportLabel(clue.title);
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
        if (clue) {
          const stamp = REDRAW_STAMPS[Math.floor(Math.random() * REDRAW_STAMPS.length)];
          setClues((prev) =>
            prev.map((item) =>
              item.id === clue.id ? { ...item, text: `${stripRedrawStamp(item.text)} ${stamp}` } : item,
            ),
          );
        }
        setExportDone(i + 1);
      }
      setExportStatus('completed');
      message.success(`批量重绘完成，共更新 ${ids.length} 张线索卡`);
    } catch {
      setExportStatus('failed');
      message.error('批量重绘失败，请重试');
    }
  };

  const handleRedrawToggleAll = (checked: boolean) => {
    setRedrawSelectedIds(checked ? new Set(filter.visible.map((clue) => clue.id)) : new Set());
  };

  return (
    <div className="clues-page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            线索卡管理 <span className="seal">{clues.length} 张</span>
          </h1>
          <div className="page-desc">
            {'// 四种风格一键切换 · 自动分类 · 批量重绘与导出'}
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={handleBatchRedraw}>
            <Grid3x3 size={15} />
            批量重绘
          </button>
          <button type="button" className="btn btn-primary" onClick={handleExportPng}>
            <Download size={15} />
            导出 PNG
          </button>
        </div>
      </div>

      <div className="style-switcher">
        {STYLE_CHIPS.map((chip) => (
          <div
            key={chip.style}
            className={`style-chip ${style === chip.style ? 'active' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => setStyle(chip.style)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setStyle(chip.style);
              }
            }}
          >
            {chip.label}
          </div>
        ))}
      </div>

      <ClueTabs
        clues={clues}
        curAct={filter.curAct}
        curPhase={filter.curPhase}
        counts={filter.counts}
        onActChange={filter.setAct}
        onPhaseChange={filter.setPhase}
      />

      <div className="clue-grid" ref={gridRef}>
        {filter.visible.map((clue) => (
          <ClueCard
            key={clue.id}
            clue={clue}
            style={style}
            selected={clue.id === selectedClueId}
            onClick={(item) => setSelectedClueId(item.id)}
          />
        ))}
        {filter.isEmpty && (
          <div className="clue-empty">当前筛选下无线索卡</div>
        )}
      </div>

      {selectedClue && (
        <>
          <div
            className="clue-detail-drawer-mask"
            onClick={() => setSelectedClueId(null)}
          />
          <div className="clue-detail-drawer open">
            <ClueDetail
              clue={selectedClue}
              onClose={() => setSelectedClueId(null)}
              onJumpToTruth={handleJumpToTruth}
            />
            <div className="cd-extra">
              <ClueTags
                clue={selectedClue}
                onMarkDistractor={handleMarkDistractor}
                onMarkKeyClue={handleMarkKeyClue}
              />
              <ClueHierarchy
                clue={selectedClue}
                allClues={clues}
                onSelectClue={(item) => setSelectedClueId(item.id)}
              />
            </div>
          </div>
        </>
      )}

      <ExportProgress
        open={exportOpen}
        total={exportTotal}
        done={exportDone}
        status={exportStatus}
        currentLabel={exportLabel}
        title={progressMode === 'redraw' ? '批量重绘线索卡' : '批量导出线索卡'}
        currentLabelPrefix={progressMode === 'redraw' ? '正在重绘' : '正在导出'}
        completedTip={
          progressMode === 'redraw'
            ? '批量重绘完成。'
            : '导出完成，文件已开始下载。'
        }
        failedTip={
          progressMode === 'redraw'
            ? '批量重绘失败，请重试。'
            : '导出失败，请重试或检查浏览器下载权限。'
        }
        onClose={() => setExportOpen(false)}
      />

      <Modal
        open={redrawOpen}
        title="批量重绘线索卡"
        okText="开始重绘"
        cancelText="取消"
        width={480}
        onOk={handleRedrawConfirm}
        onCancel={() => setRedrawOpen(false)}
      >
        <div className="redraw-modal-body">
          <div className="redraw-summary">
            已选择 <b>{redrawSelectedIds.size}</b> / {filter.visible.length} 张线索卡，
            确认后将调用 AI 逐张重绘。
          </div>
          <div className="redraw-toolbar">
            <Checkbox
              checked={
                filter.visible.length > 0 &&
                redrawSelectedIds.size === filter.visible.length
              }
              onChange={(event) => handleRedrawToggleAll(event.target.checked)}
            >
              全选
            </Checkbox>
          </div>
          <div className="redraw-list">
            <Checkbox.Group
              value={Array.from(redrawSelectedIds)}
              onChange={(values) => {
                const ids = values.filter((value): value is string => typeof value === 'string');
                setRedrawSelectedIds(new Set(ids));
              }}
            >
              {filter.visible.map((clue) => (
                <div key={clue.id} className="redraw-item">
                  <Checkbox value={clue.id}>
                    <span className="redraw-item-title">{clue.title}</span>
                    <span className="redraw-item-code">{clue.code}</span>
                  </Checkbox>
                </div>
              ))}
            </Checkbox.Group>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CluesManager;
