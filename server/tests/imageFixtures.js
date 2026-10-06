// Valid one-pixel PNG; optional tEXt metadata makes a real oversized image fixture.
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPuoAAAAASUVORK5CYII=', 'base64');
export function pngImage(bytes = pixel.length) {
  if (bytes === pixel.length) return 'data:image/png;base64,' + pixel.toString('base64');
  const data = Buffer.alloc(bytes - pixel.length - 12, 97);
  data.write('note\0');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length);
  chunk.write('tEXt', 4);
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, chunk.length - 4);
  return 'data:image/png;base64,' + Buffer.concat([pixel.subarray(0, -12), chunk, pixel.subarray(-12)]).toString('base64');
}
