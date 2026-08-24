export interface GlbChunk {
  type: number;
  data: Buffer;
  isJson: boolean;
}

export interface GlbJson {
  [key: string]: any;
  animations?: Array<{ name?: string }>;
}

export interface ParsedGlb {
  version: number;
  declaredLength: number;
  chunks: GlbChunk[];
  jsonChunkIndex: number;
  json: GlbJson;
}

export interface StaticArResult {
  buffer: Buffer;
  sourceJson: GlbJson;
  outputJson: GlbJson;
  sourceAnimationNames: string[];
  sourceHash: string;
  outputHash: string;
}

export interface StaticArReport {
  inputPath: string;
  outputPath: string;
  sourceHash: string;
  outputHash: string;
  sourceAnimationNames: string[];
  outputAnimationCount: number;
  sourceSize: number;
  outputSize: number;
  validation: string;
}

export interface StaticBounds {
  min: number[];
  max: number[];
  size: number[];
  vertexCount: number;
}

export function sha256(buffer: Uint8Array): string;
export function parseGlb(input: Uint8Array): ParsedGlb;
export function serializeGlbWithJson(
  parsed: ParsedGlb,
  json: GlbJson,
): Buffer;
export function createStaticArBuffer(sourceBuffer: Uint8Array): StaticArResult;
export function writeStaticArGlb(
  inputPath: string,
  outputPath: string,
): Promise<StaticArReport>;
export function measureStaticScene(input: Uint8Array): StaticBounds;
