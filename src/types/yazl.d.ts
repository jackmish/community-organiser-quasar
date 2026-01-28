declare module 'yazl' {
  import type { Readable } from 'stream';

  export class ZipFile {
    outputStream: Readable;
    addBuffer(
      buffer: Buffer,
      metadataPath: string,
      options?: { mtime?: Date; mode?: number; compress?: boolean },
    ): void;
    end(): void;
  }

  export = { ZipFile: typeof ZipFile };
}
