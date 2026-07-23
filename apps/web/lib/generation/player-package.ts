import type {
  ActMaterial,
  PlayerPackageContent,
  PlayerPackageGenerationStatus,
  PlayerPackageType,
} from '@narrlight/shared';

export type {
  ActMaterial,
  PlayerPackageContent,
  PlayerPackageCover,
  PlayerPackageGenerationStatus,
  PlayerPackageType,
  SupplementPackage,
} from '@narrlight/shared';

export interface PlayerPackage {
  id: string;
  scriptId: string;
  playerSeatId: string;
  identityAssignmentId?: string | null;
  packageOrder: number;
  packageTitle: string;
  currentIdentity: string;
  readOrder: number;
  packageType: PlayerPackageType;
  contentJson: PlayerPackageContent;
  wordCount: number;
  generationStatus: PlayerPackageGenerationStatus;
  createdAt: string;
  updatedAt: string;
}

export function hasActMaterialPayload(material: ActMaterial): boolean {
  return Boolean(
    material.mainText?.trim() ||
      material.objectives?.some((item) => item.trim()) ||
      material.knownFacts?.some((item) => item.trim()) ||
      material.sayableInfo?.some((item) => item.trim()) ||
      material.forbiddenInfo?.some((item) => item.trim()),
  );
}

export function countPlayerPackageWords(content: PlayerPackageContent): number {
  return collectText(content).join('').replace(/\s+/g, '').length;
}

function collectText(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectText(item));
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => collectText(item));
  return [];
}
