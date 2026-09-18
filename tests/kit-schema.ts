import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function validateKitSchemas(cases: { schema: 'kit' | 'placement' | 'blueprint' | 'kit-request'; value: unknown; valid?: boolean }[]): void {
  execFileSync('python3', [fileURLToPath(new URL('./kit-schema.py', import.meta.url))], {
    input: JSON.stringify(cases), encoding: 'utf8',
  });
}
