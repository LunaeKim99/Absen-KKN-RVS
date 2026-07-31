import QRCode from 'qrcode';

/**
 * Generate a QR code as a data URL (PNG) for a given token.
 * Used by the admin scan-display screen and by member scan previews.
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 256,
    margin: 2,
    color: { dark: '#000', light: '#fff' },
  });
}

/**
 * Render a QR code directly onto an HTMLCanvasElement.
 * Used by the live QR management screen where the canvas is owned by the page.
 */
export async function generateQrCanvas(
  token: string,
  canvas: HTMLCanvasElement,
): Promise<void> {
  await QRCode.toCanvas(canvas, token, {
    width: 256,
    margin: 2,
  });
}
