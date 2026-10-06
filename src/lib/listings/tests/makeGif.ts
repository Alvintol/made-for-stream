// Builds the bytes of a minimal 1x1 GIF with one frame per delay (in
// hundredths of a second), for tests that need a real GIF structure.
export const makeGif = (
  delays: number[],
  {
    globalColourTable = false,
    // What real exported GIFs carry: the "loop forever" application block
    // and a comment, both of which a reader has to step over.
    realWorldBlocks = false,
    localColourTables = false,
  }: {
    globalColourTable?: boolean;
    realWorldBlocks?: boolean;
    localColourTables?: boolean;
  } = {},
): Uint8Array => {
  const bytes: number[] = [
    ..."GIF89a".split("").map((character) => character.charCodeAt(0)),
    // Logical screen descriptor: 1x1, then the packed byte (0x80 = a
    // two-colour global table follows), background, aspect.
    1, 0, 1, 0, globalColourTable ? 0x80 : 0, 0, 0,
    ...(globalColourTable ? [0, 0, 0, 255, 255, 255] : []),
  ];

  if (realWorldBlocks) {
    bytes.push(
      0x21, 0xff, 11,
      ..."NETSCAPE2.0".split("").map((character) => character.charCodeAt(0)),
      3, 1, 0, 0, 0,
      // A comment whose text happens to contain the frame and trailer markers.
      0x21, 0xfe, 4, 0x2c, 0x3b, 0x21, 0xf9, 0,
    );
  }

  for (const delay of delays) {
    bytes.push(
      // Graphic control extension carrying this frame's delay.
      0x21, 0xf9, 4, 0, delay & 0xff, delay >> 8, 0, 0,
      // Image descriptor; its last byte says whether a two-colour local
      // table follows.
      0x2c, 0, 0, 0, 0, 1, 0, 1, 0, localColourTables ? 0x80 : 0,
      ...(localColourTables ? [0, 0, 0, 255, 255, 255] : []),
      // LZW minimum code size, one data sub-block, end of data.
      2, 2, 0x4c, 0x01, 0,
    );
  }

  bytes.push(0x3b);

  return new Uint8Array(bytes);
};
