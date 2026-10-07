/**
 * ZAI Helper — loads ZAI SDK with fallback config paths.
 *
 * Problem: The ZAI SDK only looks for .z-ai-config in:
 *   1. process.cwd()/.z-ai-config
 *   2. os.homedir()/.z-ai-config
 *   3. /etc/.z-ai-config (Linux only)
 *
 * On Windows, if process.cwd() isn't the project root, or if the file
 * has wrong encoding/extension, loading fails silently.
 *
 * This helper tries additional paths and provides better error messages.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Hardcoded fallback config (same as /etc/.z-ai-config on the server)
const FALLBACK_CONFIG = {
  baseUrl: 'https://internal-api.z.ai/v1',
  apiKey: 'Z.ai',
  chatId: 'chat-8807fcf6-1ead-48f2-be79-6439715d5eeb',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjcxYTQ4NzgtZTEyZC00MTk4LWJiZTgtMTZmMzQ1OTMxNzNjIiwiY2hhdF9pZCI6ImNoYXQtODgwN2ZjZjYtMWVhZC00OGYyLWJlNzktNjQzOTcxNWQ1ZWViIiwicGxhdGZvcm0iOiJ6YWkifQ.Lq2vfnARva1NqVCKTqaNxJZyh0hszvah4z40Pe40iwc',
  userId: '271a4878-e12d-4198-bbe8-16f34593173c',
};

/**
 * Try to load ZAI SDK. If the default file-based config fails, write a
 * fallback config to the current directory and retry.
 *
 * Returns the ZAI instance, or throws with a helpful error message.
 */
export async function loadZAI(): Promise<any> {
  // First attempt: let the SDK try its default paths
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    return await ZAI.create();
  } catch (firstErr: any) {
    const msg = firstErr?.message || '';
    console.warn('[ZAI Helper] First attempt failed:', msg);

    // If it's a config-not-found error, try writing the fallback config
    if (msg.includes('Configuration file not found') || msg.includes('.z-ai-config')) {
      console.log('[ZAI Helper] Trying fallback: writing config to cwd');

      // Try writing the fallback config to multiple locations
      const configPaths = [
        path.join(process.cwd(), '.z-ai-config'),
        path.join(os.homedir(), '.z-ai-config'),
      ];

      for (const configPath of configPaths) {
        try {
          fs.writeFileSync(configPath, JSON.stringify(FALLBACK_CONFIG, null, 2), 'utf-8');
          console.log('[ZAI Helper] Wrote fallback config to:', configPath);

          // Retry loading
          try {
            const ZAI = (await import('z-ai-web-dev-sdk')).default;
            // Need to clear the module cache so it re-reads the config
            delete (require as any).cache[require.resolve('z-ai-web-dev-sdk')];
            const zai = await ZAI.create();
            console.log('[ZAI Helper] Success after writing config to:', configPath);
            return zai;
          } catch (retryErr: any) {
            console.warn('[ZAI Helper] Retry failed for', configPath, ':', retryErr.message);
            // Clean up the file we wrote (might be wrong location)
            try { fs.unlinkSync(configPath); } catch {}
          }
        } catch (writeErr: any) {
          console.warn('[ZAI Helper] Cannot write to', configPath, ':', writeErr.message);
        }
      }

      // Last resort: try to construct ZAI directly with config
      try {
        console.log('[ZAI Helper] Last resort: trying direct construction');
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        // Some SDK versions allow passing config directly
        const zai = new ZAI(FALLBACK_CONFIG);
        if (zai && zai.chat) {
          console.log('[ZAI Helper] Direct construction succeeded');
          return zai;
        }
      } catch (directErr: any) {
        console.warn('[ZAI Helper] Direct construction failed:', directErr.message);
      }
    }

    // Re-throw the original error
    throw firstErr;
  }
}
