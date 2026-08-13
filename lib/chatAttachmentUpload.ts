import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';

const BUCKET = 'chat-attachments';
const MAX_SIZE_MB = 5;

export type PickSource = 'camera' | 'gallery';

let pickingInProgress = false;

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 0.7,
};

async function requestPermission(source: PickSource): Promise<boolean> {
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function pickChatImage(
  source: PickSource
): Promise<{ uri: string; mimeType?: string } | null> {
  if (pickingInProgress) return null;
  pickingInProgress = true;

  try {
    const granted = await requestPermission(source);
    if (!granted) {
      throw new Error(
        source === 'camera'
          ? 'Camera permission is required to take a photo.'
          : 'Photo library permission is required to choose an image.'
      );
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);

    if (result.canceled || !result.assets?.[0]) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
  } finally {
    pickingInProgress = false;
  }
}

/** Uploads a chat photo and returns its storage path within the bucket. */
export async function uploadChatImage(
  deliveryId: string,
  picked: { uri: string; mimeType?: string }
): Promise<string> {
  const ext =
    picked.mimeType === 'image/png'
      ? 'png'
      : picked.mimeType === 'image/webp'
        ? 'webp'
        : 'jpg';
  const mimeType =
    picked.mimeType &&
    ['image/jpeg', 'image/png', 'image/webp'].includes(picked.mimeType)
      ? picked.mimeType
      : 'image/jpeg';
  const path = `${deliveryId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const info = await FileSystem.getInfoAsync(picked.uri);
  if (
    info.exists &&
    typeof (info as { size?: number }).size === 'number' &&
    (info as { size: number }).size > MAX_SIZE_MB * 1024 * 1024
  ) {
    throw new Error(`Image must be under ${MAX_SIZE_MB}MB.`);
  }

  const base64 = await FileSystem.readAsStringAsync(picked.uri, {
    encoding: 'base64',
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
  });
  if (error) throw error;
  return path;
}

export async function getChatImageSignedUrl(
  imagePath: string,
  expiresIn = 60 * 60 * 24
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(imagePath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}
