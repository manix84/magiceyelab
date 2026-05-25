export type DepthMapSource =
  | { type: "painted"; canvas: HTMLCanvasElement }
  | { type: "imported"; image: HTMLImageElement };

export type PatternSource =
  | { type: "drawn"; canvas: HTMLCanvasElement }
  | { type: "imported"; image: HTMLImageElement }
  | { type: "generated"; canvas: HTMLCanvasElement };

export type StereogramSettings = {
  width: number;
  height: number;
  depthStrength: number;
  repeatWidth: number;
  invertDepth: boolean;
};
