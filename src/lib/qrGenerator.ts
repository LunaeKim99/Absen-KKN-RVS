import QRCode from 'qrcode';

/**
 * Build the scan URL for a given token.
 * QR codes encode the full URL so mobile cameras can open it directly.
 */
export function buildScanUrl(token: string): string {
  const baseUrl = import.meta.env.VITE_APP_URL?.replace(/\/$/, '') ?? '';
  return `${baseUrl}/scan/${token}`;
}

/**
 * Generate a QR code as a data URL (PNG) for a given token.
 * Used by the admin scan-display screen and by member scan previews.
 */
export async function generateQrDataUrl(token: string): Promise<string> {
  const url = buildScanUrl(token);
  return QRCode.toDataURL(url, {
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
  const url = buildScanUrl(token);
  await QRCode.toCanvas(canvas, url, {
    width: 256,
    margin: 2,
  });
}
