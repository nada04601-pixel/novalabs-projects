// gifenc(1.0.3)는 타입 선언을 함께 배포하지 않아 여기서 쓰는 함수만 적어 둡니다.
declare module "gifenc" {
  export type Palette = number[][];
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: "rgb565" | "rgb444" | "rgba4444" }): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: "rgb565" | "rgb444" | "rgba4444"): Uint8Array;
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: { palette?: Palette; delay?: number; repeat?: number; transparent?: boolean; dispose?: number }): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
  };
}
