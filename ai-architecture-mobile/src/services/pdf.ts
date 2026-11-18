import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

import type { DownloadPdfRequest } from '@/types/api';
import { downloadPdf } from '@/services/api';

const PDF_FILENAME = 'Building_Plan_Report.pdf';

export async function savePdfReport(payload: DownloadPdfRequest): Promise<string> {
  if (Platform.OS === 'web') {
    throw new Error('PDF download is currently supported on iOS and Android only.');
  }

  const buffer = await downloadPdf(payload);
  const signature = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 5));
  const isPdf =
    signature.length === 5 &&
    signature[0] === 37 &&
    signature[1] === 80 &&
    signature[2] === 68 &&
    signature[3] === 70 &&
    signature[4] === 45;
  if (!isPdf) {
    throw new Error('The server response was not a valid PDF file.');
  }

  const file = new File(Paths.document, PDF_FILENAME);
  file.create({ intermediates: true, overwrite: true });
  file.write(new Uint8Array(buffer));
  return file.uri;
}

export async function sharePdfReport(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('PDF sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Building Plan Report',
  });
}
