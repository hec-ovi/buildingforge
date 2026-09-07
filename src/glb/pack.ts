// GLB container assembly with both embedded images and external image URIs.

import { BufferUtils, Format, type Document, type PlatformIO, type Texture } from '@gltf-transform/core';

const GLTF_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export async function writeBinaryWithUris(
  io: PlatformIO,
  doc: Document,
  imageUris: Map<Texture, string>,
): Promise<Uint8Array> {
  if (doc.getRoot().listBuffers().length > 1) throw new Error('GLB must have zero or one buffer.');

  // GLTF serialization keeps image resources separate from the geometry buffer.
  const { json, resources } = await io.writeJSON(doc, { format: Format.GLTF });
  const buffer = json.buffers?.[0];
  const geometry = buffer?.uri ? resources[buffer.uri] : undefined;
  const chunks = geometry ? [BufferUtils.pad(geometry)] : [];
  let byteLength = chunks[0]?.byteLength ?? 0;

  // Image definitions follow root.listTextures() order.
  const textures = doc.getRoot().listTextures();
  for (const [index, image] of (json.images ?? []).entries()) {
    const uri = imageUris.get(textures[index]!);
    if (uri) {
      image.uri = uri;
      continue;
    }
    if (!image.uri) continue;
    const bytes = resources[image.uri];
    if (!bytes) throw new Error(`Missing embedded image resource: ${image.uri}`);
    const views = json.bufferViews ??= [];
    image.bufferView = views.length;
    views.push({ buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength });
    delete image.uri;
    const padded = BufferUtils.pad(bytes);
    chunks.push(padded);
    byteLength += padded.byteLength;
  }
  if (byteLength) {
    json.buffers = [{ ...buffer, byteLength }];
    delete json.buffers[0]!.uri;
  } else {
    delete json.buffers;
  }
  return pack(json, BufferUtils.concat(chunks));
}

function pack(json: unknown, bin: Uint8Array): Uint8Array {
  const jsonData = BufferUtils.pad(BufferUtils.encodeText(JSON.stringify(json)), 0x20);
  const jsonChunk = BufferUtils.concat([BufferUtils.toView(new Uint32Array([jsonData.byteLength, CHUNK_JSON])), jsonData]);

  const chunks = [jsonChunk];
  if (bin.byteLength) {
    const binData = BufferUtils.pad(bin, 0);
    chunks.push(BufferUtils.concat([BufferUtils.toView(new Uint32Array([binData.byteLength, CHUNK_BIN])), binData]));
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 12);
  const header = BufferUtils.toView(new Uint32Array([GLTF_MAGIC, 2, total]));
  return BufferUtils.concat([header, ...chunks]);
}
