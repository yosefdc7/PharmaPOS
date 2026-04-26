/**
 * Minimal, browser-compatible ESC/POS command builder.
 * Uses Uint8Array and TextEncoder for UTF-8 output.
 */

const encoder = new TextEncoder();

// --- ESC/POS constants ---
export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;
export const DLE = 0x10;
export const EOT = 0x04;

// --- Command builders ---

export function initPrinter(): Uint8Array {
  return new Uint8Array([ESC, 0x40]); // ESC @
}

export function feedLines(lines = 1): Uint8Array {
  return new Uint8Array([ESC, 0x64, lines]); // ESC d n
}

export function cut(full = true): Uint8Array {
  // GS V n: n=1 full cut, n=0 partial cut (paper fed first)
  return new Uint8Array([GS, 0x56, full ? 0x01 : 0x00]);
}

export function partialCutWithFeed(lines = 3): Uint8Array {
  // GS V m: m=66 partial cut, feed paper first
  return new Uint8Array([GS, 0x56, 0x42, lines]);
}

export function align(mode: "left" | "center" | "right"): Uint8Array {
  const n = mode === "left" ? 0 : mode === "center" ? 1 : 2;
  return new Uint8Array([ESC, 0x61, n]); // ESC a n
}

export function bold(on = true): Uint8Array {
  return new Uint8Array([ESC, 0x45, on ? 0x01 : 0x00]); // ESC E n
}

export function underline(mode: 0 | 1 | 2 = 0): Uint8Array {
  return new Uint8Array([ESC, 0x2d, mode]); // ESC - n
}

export function textSize(width: 0 | 1 | 2 | 3 = 0, height: 0 | 1 | 2 | 3 = 0): Uint8Array {
  const n = (width << 4) | height;
  return new Uint8Array([GS, 0x21, n]); // GS ! n
}

export function normalSize(): Uint8Array {
  return textSize(0, 0);
}

export function doubleHeight(): Uint8Array {
  return textSize(0, 1);
}

export function doubleWidth(): Uint8Array {
  return textSize(1, 0);
}

export function openCashDrawer(pin = 0): Uint8Array {
  // ESC p m t1 t2
  return new Uint8Array([ESC, 0x70, pin, 0x32, 0x32]);
}

export function beep(times = 1, duration = 1): Uint8Array {
  // ESC B n t
  return new Uint8Array([ESC, 0x42, times, duration]);
}

export function text(str: string): Uint8Array {
  return encoder.encode(str);
}

export function line(str = ""): Uint8Array {
  return encoder.encode(str + "\n");
}

export function rawStatusRequest(): Uint8Array {
  // DLE EOT n (n=1 printer, n=2 off-line, n=3 error, n=4 paper)
  return new Uint8Array([DLE, EOT, 0x01]);
}

export function rawPaperStatusRequest(): Uint8Array {
  return new Uint8Array([DLE, EOT, 0x04]);
}

// --- Aggregator ---

export type EscPosSegment = Uint8Array;

export class EscPosBuilder {
  private segments: EscPosSegment[] = [];

  add(segment: EscPosSegment): this {
    this.segments.push(segment);
    return this;
  }

  addText(str: string): this {
    return this.add(text(str));
  }

  addLine(str = ""): this {
    return this.add(line(str));
  }

  init(): this {
    return this.add(initPrinter());
  }

  alignLeft(): this {
    return this.add(align("left"));
  }

  alignCenter(): this {
    return this.add(align("center"));
  }

  alignRight(): this {
    return this.add(align("right"));
  }

  setBold(on = true): this {
    return this.add(bold(on));
  }

  setUnderline(mode: 0 | 1 | 2 = 0): this {
    return this.add(underline(mode));
  }

  setNormalSize(): this {
    return this.add(normalSize());
  }

  setDoubleHeight(): this {
    return this.add(doubleHeight());
  }

  setDoubleWidth(): this {
    return this.add(doubleWidth());
  }

  feed(lines = 1): this {
    return this.add(feedLines(lines));
  }

  fullCut(): this {
    return this.add(cut(true));
  }

  partialCut(): this {
    return this.add(cut(false));
  }

  partialCutWithFeed(lines = 3): this {
    return this.add(partialCutWithFeed(lines));
  }

  openDrawer(): this {
    return this.add(openCashDrawer());
  }

  beep(times = 1): this {
    return this.add(beep(times));
  }

  build(): Uint8Array {
    const totalLength = this.segments.reduce((sum, seg) => sum + seg.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const seg of this.segments) {
      result.set(seg, offset);
      offset += seg.length;
    }
    return result;
  }
}
