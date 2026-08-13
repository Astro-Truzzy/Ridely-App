import * as DocumentPicker from 'expo-document-picker';

let activePick: Promise<DocumentPicker.DocumentPickerResult> | null = null;

/**
 * Serializes document picker calls. expo-document-picker rejects concurrent
 * getDocumentAsync invocations with "Different document picking in progress".
 */
export async function getDocumentAsync(
  options: DocumentPicker.DocumentPickerOptions
): Promise<DocumentPicker.DocumentPickerResult> {
  if (activePick) {
    return { canceled: true, assets: null, output: null };
  }

  const pick = DocumentPicker.getDocumentAsync(options);
  activePick = pick;

  try {
    return await pick;
  } finally {
    if (activePick === pick) {
      activePick = null;
    }
  }
}
