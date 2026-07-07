import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const BUCKET = 'rider-verification-docs';
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type VerificationDocumentType =
  | 'nin'
  | 'guarantor_letter'
  | 'drivers_license'
  | 'vehicle_registration'
  | 'other';

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType?: string;
}

/**
 * Read local file to base64 then upload to Supabase storage.
 * Path format: {riderId}/{documentType}/{timestamp}_{sanitizedName}
 */
export async function uploadVerificationDocument(
  riderId: string,
  documentType: VerificationDocumentType,
  picked: PickedDocument
): Promise<{ filePath: string; fileName: string }> {
  const ext = picked.name.split('.').pop() || 'bin';
  const safeName = picked.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 80);
  const filePath = `${riderId}/${documentType}/${Date.now()}_${safeName}`;

  const mimeType = picked.mimeType && ALLOWED_MIME.includes(picked.mimeType)
    ? picked.mimeType
    : 'application/octet-stream';

  const base64 = await FileSystem.readAsStringAsync(picked.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;
  return { filePath, fileName: picked.name };
}
