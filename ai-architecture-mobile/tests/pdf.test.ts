import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';
import { File, Paths } from 'expo-file-system';
import { downloadPdf } from '../src/services/api';
import { savePdfReport } from '../src/services/pdf';
import { validResult, validRequest } from './fixtures';

jest.mock('expo-file-system', () => ({
  File: jest.fn(),
  Paths: { document: 'app-documents' },
}));

jest.mock('../src/services/api', () => ({
  downloadPdf: jest.fn(),
}));

describe('PDF save validation', () => {
  const mockFile = {
    uri: 'file:///app-documents/Building_Plan_Report.pdf',
    create: jest.fn(),
    write: jest.fn<(...args: [Uint8Array]) => Promise<void>>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (
      File as unknown as Mock<(...args: unknown[]) => unknown>
    ).mockImplementation(() => mockFile);
  });

  it('accepts a PDF signature and saves it in app documents', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    (
      downloadPdf as unknown as Mock<(...args: unknown[]) => Promise<ArrayBuffer>>
    ).mockResolvedValue(bytes.buffer);

    await expect(
      savePdfReport({ result: validResult, inputs: validRequest }),
    ).resolves.toBe(mockFile.uri);
    expect(File).toHaveBeenCalledWith(Paths.document, 'Building_Plan_Report.pdf');
    expect(mockFile.create).toHaveBeenCalledWith({
      intermediates: true,
      overwrite: true,
    });
    expect(mockFile.write).toHaveBeenCalledWith(bytes);
  });

  it('rejects a response that does not start with %PDF-', async () => {
    (
      downloadPdf as unknown as Mock<(...args: unknown[]) => Promise<ArrayBuffer>>
    ).mockResolvedValue(
      new Uint8Array([123, 34, 111, 107, 125]).buffer,
    );

    await expect(
      savePdfReport({ result: validResult, inputs: validRequest }),
    ).rejects.toThrow('The server response was not a valid PDF file.');
    expect(mockFile.write).not.toHaveBeenCalled();
  });

  it('surfaces errors when writing the PDF file fails', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    (
      downloadPdf as unknown as Mock<(...args: unknown[]) => Promise<ArrayBuffer>>
    ).mockResolvedValue(bytes.buffer);
    mockFile.write.mockRejectedValue(new Error('File write failed.'));

    await expect(
      savePdfReport({ result: validResult, inputs: validRequest }),
    ).rejects.toThrow('File write failed.');
  });
});
