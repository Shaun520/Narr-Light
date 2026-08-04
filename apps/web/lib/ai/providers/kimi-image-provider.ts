// Kimi 插画 Provider - 插画生成（图像模型）
// 复用剧本生成同一套 Kimi 凭据（KIMI_API_KEY / KSPMAS / MOONSHOT 环境变量），
// 调用 OpenAI 兼容的 /images/generations 接口，默认模型 kimi-m3

import type {
  AIProvider,
  GenerateOptions,
  IllustrationResult,
  StreamChunk,
  ValidationResult,
} from './base-provider';
import type { ProviderRuntimeConfig } from '@narrlight/shared';
import { fetchWithOptionalProxy } from './fetch-with-proxy';

interface KimiImageResponse {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

function randomSeed(): number {
  return Math.floor(Math.random() * 900000) + 100000;
}

export class KimiImageProvider implements AIProvider {
  readonly name = 'kimi-image';
  model: string;
  private readonly defaultSize: string;
  private readonly timeout: number;
  private readonly retries: number;

  // 与 KimiProvider（剧本生成）使用同一组 API Key / Base URL 环境变量
  private readonly apiKey =
    process.env.KIMI_API_KEY ??
    process.env.KSPMAS_API_KEY ??
    process.env.MOONSHOT_API_KEY ??
    '';
  private readonly baseUrl = normalizeKimiBaseUrl(
    process.env.KIMI_BASE_URL ??
      process.env.KSPMAS_BASE_URL ??
      process.env.MOONSHOT_BASE_URL ??
      'https://api.moonshot.ai/v1',
  );

  constructor(config?: Partial<ProviderRuntimeConfig>) {
    this.model = config?.model || 'kimi-m3';
    this.defaultSize = config?.size || '1024x1024';
    this.timeout = config?.timeout ?? 60;
    this.retries = config?.retries ?? 3;
  }

  async illustrate(
    prompt: string,
    options?: Record<string, unknown>,
  ): Promise<IllustrationResult> {
    if (!this.apiKey) {
      throw new Error('KIMI_API_KEY（或 KSPMAS_API_KEY / MOONSHOT_API_KEY）未配置，无法调用 Kimi 插画模型');
    }

    // 模型 ID 与剧本生成 KimiProvider 共用同一组环境变量（星流平台为接入点 ID ep-xxx），
    // 优先级高于调用方透传的 admin 展示模型名（如 kimi-m3）
    const model =
      process.env.KIMI_MODEL_ID ??
      process.env.KSPMAS_MODEL_ID ??
      process.env.MOONSHOT_MODEL_ID ??
      (options?.model as string | undefined) ??
      this.model;
    const outputFormat = (options?.output_format as string | undefined) ?? 'png';
    const response = await requestWithRetry(
      `${this.baseUrl}/images/generations`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          n: Math.max(1, Math.min(Number(options?.n ?? 1), 4)),
          size: options?.size ?? this.defaultSize,
          output_format: outputFormat,
        }),
        signal: (options?.signal ?? undefined) as AbortSignal | undefined,
      },
      process.env.KIMI_PROXY_URL ?? process.env.OPENAI_PROXY_URL,
      this.retries,
      this.timeout,
    );

    if (!response.ok) {
      throw new Error(await buildProviderError('Kimi Images', response));
    }

    const data = (await response.json()) as KimiImageResponse;
    const image = data.data?.[0];
    const imageUrl = image?.b64_json
      ? `data:image/${outputFormat};base64,${image.b64_json}`
      : image?.url;

    if (!imageUrl) {
      throw new Error('Kimi Images returned empty image data');
    }

    return {
      imageUrl,
      model,
      seed: randomSeed(),
    };
  }

  generate(_options: GenerateOptions): Promise<string> {
    void _options;
    return Promise.reject(new Error('KimiImageProvider only supports image generation'));
  }

  async *generateStream(_options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    void _options;
    throw new Error('KimiImageProvider only supports image generation');
  }

  generateJSON<T>(_options: GenerateOptions): Promise<T> {
    void _options;
    return Promise.reject(new Error('KimiImageProvider only supports image generation'));
  }

  validate(_options: GenerateOptions): Promise<ValidationResult> {
    void _options;
    return Promise.reject(new Error('KimiImageProvider only supports image generation'));
  }
}

async function buildProviderError(provider: string, response: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => '');
  }
  const requestId = response.headers.get('x-request-id') || '';
  return `${provider} API error ${response.status}: ${detail || response.statusText}${requestId ? ` (request-id: ${requestId})` : ''}`;
}

async function requestWithRetry(
  input: string | URL,
  init: RequestInit = {},
  explicitProxyUrl?: string,
  retries = 3,
  timeoutSec = 60,
): Promise<Response> {
  const maxAttempts = Math.max(1, retries + 1);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutSec * 1000);
    const externalSignal = (init.signal ?? undefined) as AbortSignal | undefined;
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetchWithOptionalProxy(input, { ...init, signal: controller.signal }, explicitProxyUrl);
      if (response.ok || !shouldRetry(response.status) || attempt === maxAttempts) {
        return response;
      }
      lastError = new Error(`Kimi Images temporary failure ${response.status}`);
      await delay(200 * 2 ** (attempt - 1), externalSignal);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (externalSignal?.aborted) {
        throw lastError;
      }
      if (attempt === maxAttempts) {
        throw lastError;
      }
      await delay(200 * 2 ** (attempt - 1), externalSignal);
    } finally {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }

  throw lastError ?? new Error('Kimi Images request failed');
}

function shouldRetry(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function normalizeKimiBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (trimmed === 'https://kspmas.ksyun.com') {
    return 'https://kspmas.ksyun.com/v1';
  }
  return trimmed;
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
