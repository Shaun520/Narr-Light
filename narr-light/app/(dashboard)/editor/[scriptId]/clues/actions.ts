'use server';

import { revalidatePath } from 'next/cache';
import { clueService, type ClueDTO } from '@/lib/services/clue-service';

export async function markClueDistractorAction(
  scriptId: string,
  clueId: string,
  isDistractor: boolean,
): Promise<ClueDTO> {
  const clue = await clueService.markDistractor(clueId, isDistractor);
  revalidatePath(`/editor/${scriptId}/clues`);
  revalidatePath(`/editor/${scriptId}/validation`);
  return clue;
}

export async function markClueKeyAction(
  scriptId: string,
  clueId: string,
  isKey: boolean,
): Promise<ClueDTO> {
  const clue = await clueService.markKeyClue(clueId, isKey);
  revalidatePath(`/editor/${scriptId}/clues`);
  revalidatePath(`/editor/${scriptId}/validation`);
  return clue;
}
