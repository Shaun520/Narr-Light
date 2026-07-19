'use server';

import { illustrationService } from '@/lib/services/illustration-service';
import type { IllustrationAsset } from '@/components/illust/asset-list';

export type IllustrationAssetView = IllustrationAsset & {
  sourceType?: string | null;
  sourceId?: string | null;
};

export async function getIllustrationAssetsAction(
  scriptId: string,
): Promise<IllustrationAssetView[]> {
  const assets = await illustrationService.getAssets(scriptId);
  return assets.map((asset) => ({
    id: asset.id,
    type: asset.type,
    title: asset.title,
    sub: asset.sub,
    status: asset.status,
    thumb: asset.thumb,
    progress: asset.progress,
    sourceType: asset.sourceType,
    sourceId: asset.sourceId,
  }));
}
