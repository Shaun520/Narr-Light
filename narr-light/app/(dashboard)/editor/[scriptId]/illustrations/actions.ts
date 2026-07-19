'use server';

import { illustrationService } from '@/lib/services/illustration-service';
import { illustrationGenerateService } from '@/lib/services/illustration-generate-service';
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

export interface GenerateIllustrationInput {
  scriptId: string;
  assetId: string;
  prompt: string;
  model: string;
  ratio: string;
  count: number;
}

export async function generateIllustrationAssetAction(
  input: GenerateIllustrationInput,
  _onProgress?: unknown,
): Promise<{ imageUrl: string; model: string; seed: number }> {
  void _onProgress;
  const result = await illustrationGenerateService.generateSingle(input);
  return {
    imageUrl: result.imageUrl,
    model: result.model,
    seed: result.seed,
  };
}
