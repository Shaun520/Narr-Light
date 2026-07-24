import { NextResponse } from 'next/server';
import { getTextProviderInstance } from '@/lib/services/ai-config-service';

export async function GET() {
  const { name, runtime } = await getTextProviderInstance();
  return NextResponse.json({
    provider: name,
    model: runtime.model || null,
  });
}
