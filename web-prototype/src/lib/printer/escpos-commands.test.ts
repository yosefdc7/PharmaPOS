/**
 * Unit tests for ESC/POS command builder
 */

import { describe, it, expect } from 'vitest';
import {
  ESC,
  GS,
  FS,
  DLE,
  EOT,
  initPrinter,
  feedLines,
  cut,
  partialCutWithFeed,
  align,
  bold,
  underline,
  textSize,
  normalSize,
  doubleHeight,
  doubleWidth,
  openCashDrawer,
  beep,
  text,
  line,
  rawStatusRequest,
  rawPaperStatusRequest,
  EscPosBuilder,
} from './escpos-commands';

describe('ESC/POS Constants', () => {
  it('should have correct constant values', () => {
    expect(ESC).toBe(0x1b);
    expect(GS).toBe(0x1d);
    expect(FS).toBe(0x1c);
    expect(DLE).toBe(0x10);
    expect(EOT).toBe(0x04);
  });
});

describe('Basic Commands', () => {
  it('initPrinter should return ESC @ command', () => {
    const result = initPrinter();
    expect(result).toEqual(new Uint8Array([ESC, 0x40]));
  });

  it('feedLines should return ESC d n command', () => {
    const result = feedLines(3);
    expect(result).toEqual(new Uint8Array([ESC, 0x64, 3]));
  });

  it('feedLines should default to 1 line', () => {
    const result = feedLines();
    expect(result).toEqual(new Uint8Array([ESC, 0x64, 1]));
  });

  it('cut should return GS V n command for full cut', () => {
    const result = cut(true);
    expect(result).toEqual(new Uint8Array([GS, 0x56, 0x01]));
  });

  it('cut should return GS V n command for partial cut', () => {
    const result = cut(false);
    expect(result).toEqual(new Uint8Array([GS, 0x56, 0x00]));
  });

  it('partialCutWithFeed should return GS V m command', () => {
    const result = partialCutWithFeed(3);
    expect(result).toEqual(new Uint8Array([GS, 0x56, 0x42, 3]));
  });

  it('partialCutWithFeed should default to 3 lines', () => {
    const result = partialCutWithFeed();
    expect(result).toEqual(new Uint8Array([GS, 0x56, 0x42, 3]));
  });
});

describe('Text Formatting Commands', () => {
  it('align should return ESC a n command for left', () => {
    const result = align('left');
    expect(result).toEqual(new Uint8Array([ESC, 0x61, 0]));
  });

  it('align should return ESC a n command for center', () => {
    const result = align('center');
    expect(result).toEqual(new Uint8Array([ESC, 0x61, 1]));
  });

  it('align should return ESC a n command for right', () => {
    const result = align('right');
    expect(result).toEqual(new Uint8Array([ESC, 0x61, 2]));
  });

  it('bold should return ESC E n command for on', () => {
    const result = bold(true);
    expect(result).toEqual(new Uint8Array([ESC, 0x45, 0x01]));
  });

  it('bold should return ESC E n command for off', () => {
    const result = bold(false);
    expect(result).toEqual(new Uint8Array([ESC, 0x45, 0x00]));
  });

  it('underline should return ESC - n command', () => {
    const result = underline(1);
    expect(result).toEqual(new Uint8Array([ESC, 0x2d, 1]));
  });

  it('underline should default to 0', () => {
    const result = underline();
    expect(result).toEqual(new Uint8Array([ESC, 0x2d, 0]));
  });
});

describe('Text Size Commands', () => {
  it('textSize should calculate correct n value', () => {
    const result = textSize(2, 1);
    // n = (width << 4) | height = (2 << 4) | 1 = 32 | 1 = 33
    expect(result).toEqual(new Uint8Array([GS, 0x21, 33]));
  });

  it('normalSize should return textSize(0, 0)', () => {
    const result = normalSize();
    expect(result).toEqual(new Uint8Array([GS, 0x21, 0]));
  });

  it('doubleHeight should return textSize(0, 1)', () => {
    const result = doubleHeight();
    expect(result).toEqual(new Uint8Array([GS, 0x21, 1]));
  });

  it('doubleWidth should return textSize(1, 0)', () => {
    const result = doubleWidth();
    expect(result).toEqual(new Uint8Array([GS, 0x21, 16]));
  });
});

describe('Hardware Commands', () => {
  it('openCashDrawer should return ESC p m t1 t2 command', () => {
    const result = openCashDrawer(0);
    expect(result).toEqual(new Uint8Array([ESC, 0x70, 0, 0x32, 0x32]));
  });

  it('openCashDrawer should use default pin 0', () => {
    const result = openCashDrawer();
    expect(result).toEqual(new Uint8Array([ESC, 0x70, 0, 0x32, 0x32]));
  });

  it('beep should return ESC B n t command', () => {
    const result = beep(2, 3);
    expect(result).toEqual(new Uint8Array([ESC, 0x42, 2, 3]));
  });

  it('beep should use default values', () => {
    const result = beep();
    expect(result).toEqual(new Uint8Array([ESC, 0x42, 1, 1]));
  });
});

describe('Text Commands', () => {
  it('text should encode string to UTF-8', () => {
    const result = text('Hello');
    const expected = new TextEncoder().encode('Hello');
    expect(result).toEqual(expected);
  });

  it('line should encode string with newline', () => {
    const result = line('Hello');
    const expected = new TextEncoder().encode('Hello\n');
    expect(result).toEqual(expected);
  });

  it('line should default to empty string', () => {
    const result = line();
    const expected = new TextEncoder().encode('\n');
    expect(result).toEqual(expected);
  });
});

describe('Status Commands', () => {
  it('rawStatusRequest should return DLE EOT n command', () => {
    const result = rawStatusRequest();
    expect(result).toEqual(new Uint8Array([DLE, EOT, 0x01]));
  });

  it('rawPaperStatusRequest should return DLE EOT n command', () => {
    const result = rawPaperStatusRequest();
    expect(result).toEqual(new Uint8Array([DLE, EOT, 0x04]));
  });
});

describe('EscPosBuilder', () => {
  it('should chain commands and build correctly', () => {
    const result = new EscPosBuilder()
      .init()
      .addText('Hello')
      .addLine('World')
      .feed(2)
      .fullCut()
      .build();

    const expected = new Uint8Array([
      ESC, 0x40, // init
      ...new TextEncoder().encode('Hello'), // addText
      ...new TextEncoder().encode('World\n'), // addLine
      ESC, 0x64, 2, // feed
      GS, 0x56, 0x01, // fullCut
    ]);

    expect(result).toEqual(expected);
  });

  it('should return empty array when no commands added', () => {
    const result = new EscPosBuilder().build();
    expect(result).toEqual(new Uint8Array(0));
  });

  it('should support method chaining', () => {
    const builder = new EscPosBuilder();
    const result = builder
      .init()
      .alignCenter()
      .setBold(true)
      .addText('Test')
      .build();

    expect(result.length).toBeGreaterThan(0);
  });

  it('setBold should toggle bold correctly', () => {
    const builder = new EscPosBuilder();
    builder.setBold(true).setBold(false);
    expect(builder['segments'].length).toBe(2);
  });

  it('feed should use default 1 line', () => {
    const result = new EscPosBuilder().feed().build();
    expect(result).toEqual(new Uint8Array([ESC, 0x64, 1]));
  });
});
