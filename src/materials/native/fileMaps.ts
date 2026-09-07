import { readFile } from 'node:fs/promises';

const root = new URL('../../../public/native-materials/themes/', import.meta.url);

export async function readNativeMap(theme: string, path: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(new URL(`${theme}/${path}`, root)));
}
