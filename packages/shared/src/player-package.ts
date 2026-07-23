export type PlayerPackageType = 'initial' | 'act' | 'supplement' | 'ending';

export type PlayerPackageGenerationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface PlayerPackageCover {
  title: string;
  subtitle?: string;
}

export interface ActMaterial {
  actOrder: number;
  actTitle: string;
  preActIntro?: string;
  mainText?: string;
  knownFacts?: string[];
  misunderstandings?: string[];
  sayableInfo?: string[];
  forbiddenInfo?: string[];
  objectives?: string[];
  interactionPrompts?: string[];
  pauseInstruction?: string;
}

export interface SupplementPackage {
  releaseAct: number;
  releaseCondition?: string;
  receiverPlayerSeatId: string;
  receiverName: string;
  title?: string;
  newIdentity?: string;
  newMemory?: string;
  newObjectives?: string[];
  newSpeechRestrictions?: string[];
  content?: string;
}

export interface PlayerPackageContent {
  manualText?: string;
  cover?: PlayerPackageCover;
  prologue?: string;
  publicIdentity?: string;
  privateBackground?: string;
  knownRelations?: string[];
  hiddenSecrets?: string[];
  globalObjectives?: string[];
  actMaterials?: ActMaterial[];
  supplementPackages?: SupplementPackage[];
  endingPrompt?: string;
}
