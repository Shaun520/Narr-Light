import { CluesManager } from '@/components/clue-card/clues-manager';
import { clueService } from '@/lib/services/clue-service';
import './clues.css';

interface PageProps {
  params: Promise<{ scriptId: string }>;
}

export default async function CluesPage({ params }: PageProps) {
  const { scriptId } = await params;
  const clues = await clueService.getClues(scriptId);

  return <CluesManager scriptId={scriptId} initialClues={clues} />;
}
