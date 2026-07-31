/**
 * Minimal declarations for html5-qrcode v2.3.8.
 * The library ships its own types; these augment the module with the
 * subset of the public API used by the ScanPage scanner.
 */
declare module 'html5-qrcode' {
  export interface QrDimensions {
    width: number;
    height: number;
  }

  export type QrDimensionFunction = (
    viewfinderWidth: number,
    viewfinderHeight: number,
  ) => QrDimensions;

  export interface Html5QrcodeCameraScanConfig {
    fps?: number | undefined;
    qrbox?:
      | number
      | QrDimensions
      | QrDimensionFunction
      | undefined;
    aspectRatio?: number | undefined;
    disableFlip?: boolean | undefined;
    videoConstraints?: MediaTrackConstraints | undefined;
  }

  export type QrcodeSuccessCallback = (
    decodedText: string,
    result: unknown,
  ) => void;

  export type QrcodeErrorCallback = (
    errorMessage: string,
    error?: unknown,
  ) => void;

  export class Html5Qrcode {
    constructor(elementId: string, configOrVerbosityFlag?: boolean | unknown);
    start(
      cameraIdOrConfig: string | MediaTrackConstraints,
      configuration: Html5QrcodeCameraScanConfig | undefined,
      qrCodeSuccessCallback: QrcodeSuccessCallback | undefined,
      qrCodeErrorCallback: QrcodeErrorCallback | undefined,
    ): Promise<null>;
    pause(shouldPauseVideo?: boolean): void;
    resume(): void;
    stop(): Promise<void>;
    clear(): void;
  }

  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: unknown,
      verbose?: boolean,
    );
    render(
      qrCodeSuccessCallback: QrcodeSuccessCallback,
      qrCodeErrorCallback: QrcodeErrorCallback | undefined,
    ): void;
    pause(shouldPauseVideo?: boolean): void;
    resume(): void;
    clear(): Promise<void>;
  }
}
