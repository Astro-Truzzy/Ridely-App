import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

const BUCKET = 'avatars';
const MAX_SIZE_MB = 2;

export type PickSource = 'camera' | 'gallery';

/**
 * Pick an image from the gallery using expo-document-picker (no native ImagePicker module needed).
 * For camera we use document picker too; on Android some devices allow picking from "Camera" as a source.
 */
export async function pickProfileImage(
  source: PickSource
): Promise<{ uri: string; mimeType?: string } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled) return null;
    const asset = (result as { assets?: { uri: string; mimeType?: string }[] }).assets?.[0];
    const uri = asset?.uri ?? (result as { uri?: string }).uri;
    const mimeType = asset?.mimeType ?? (result as { mimeType?: string }).mimeType ?? 'image/jpeg';
    if (!uri) return null;
    return { uri, mimeType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg || 'Could not pick image.');
  }
}

/**
 * Upload a picked image to Supabase storage and return the public URL.
 * Path: {userId}/avatar.{ext}
 */
export async function uploadAvatar(
  userId: string,
  picked: { uri: string; mimeType?: string }
): Promise<string> {
  const ext = (picked.mimeType === 'image/png')
    ? 'png'
    : (picked.mimeType === 'image/webp')
      ? 'webp'
      : 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const mimeType = picked.mimeType && ['image/jpeg', 'image/png', 'image/webp'].includes(picked.mimeType)
    ? picked.mimeType
    : 'image/jpeg';

  const base64 = await FileSystem.readAsStringAsync(picked.uri, {
    encoding: 'base64',
  });
  const info = await FileSystem.getInfoAsync(picked.uri);
  if (info.exists && 'size' in info && typeof (info as { size?: number }).size === 'number' && (info as { size: number }).size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`Image must be under ${MAX_SIZE_MB}MB.`);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw error;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const base = supabaseUrl.replace(/\/$/, '');
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}
