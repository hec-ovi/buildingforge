// GLB container assembly. @gltf-transform's writeBinary drops the URI of an
// image that carries no bytes, so external-texture output goes through
// writeJSON, patches the image URIs, and packs the container here.

import { BufferUtils, Format, type Document, type PlatformIO, type Texture } from '@gltf-transform/core';

interface ImageDef { uri?: string; bufferView?: number; mimeType?: string }

const GLTF_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export async function writeBinaryWithUris(
  io: PlatformIO,
  doc: Document,
  imageUris: Map<Texture, string>,
): Promise<Uint8Array> {
  const { json, resources } = await io.writeJSON(doc, { format: Format.GLB });
  if (imageUris.size > 0) {
    // json.images follows root.listTextures() order (glTF writer contract).
    const images = (json as { images?: ImageDef[] }).images ?? [];
    doc.getRoot().listTextures().forEach((texture, i) => {
      const uri = imageUris.get(texture);
      const def = images[i];
      if (uri && def) def.uri = uri;
    });
  }
  return pack(json, resources);
}

function pack(json: unknown, resources: Record<string, Uint8Array>): Uint8Array {
  const jsonData = BufferUtils.pad(BufferUtils.encodeText(JSON.stringify(json)), 0x20);
  const jsonChunk = BufferUtils.concat([BufferUtils.toView(new Uint32Array([jsonData.byteLength, CHUNK_JSON])), jsonData]);

  const bin = Object.values(resources)[0];
  const chunks = [jsonChunk];
  if (bin && bin.byteLength) {
    const binData = BufferUtils.pad(bin, 0);
    chunks.push(BufferUtils.concat([BufferUtils.toView(new Uint32Array([binData.byteLength, CHUNK_BIN])), binData]));
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 12);
  const header = BufferUtils.toView(new Uint32Array([GLTF_MAGIC, 2, total]));
  return BufferUtils.concat([header, ...chunks]);
}
