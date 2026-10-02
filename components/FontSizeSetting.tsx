import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text as RNText,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type, Check, X } from 'lucide-react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/contexts/ThemeContext';
import { FONT_SCALE_OPTIONS, useTypography } from '@/contexts/TypographyContext';

const PREVIEW_BASE_SIZE = 30;

function percent(scale: number) {
  return `${Math.round(scale * 100)}%`;
}

/**
 * Text-size control for the settings screens. Shows the active step in the row
 * and, on tap, a sheet with a live preview so the choice can be seen before it
 * is committed. The preview renders a raw React Native `Text` at the drafted
 * scale — the scale-aware wrapper would otherwise apply the *saved* value.
 */
export function FontSizeSetting() {
  const { theme, isDark } = useTheme();
  const { fontScaleIndex, setFontScaleIndex } = useTypography();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(fontScaleIndex);

  const openSheet = () => {
    setDraft(fontScaleIndex);
    setOpen(true);
  };

  const commit = async () => {
    await setFontScaleIndex(draft);
    setOpen(false);
  };

  const active = FONT_SCALE_OPTIONS[fontScaleIndex];
  const previewScale = FONT_SCALE_OPTIONS[draft].scale;

  return (
    <>
      <TouchableOpacity
        style={styles.settingItem}
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel="Text size"
        accessibilityHint={`Currently ${active.label}, ${percent(active.scale)}. Opens text size options.`}
      >
        <View style={[styles.settingIcon, { backgroundColor: `${theme.colors.primary}20` }]}>
          <Type size={20} color={theme.colors.primary} strokeWidth={2} />
        </View>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingTitle, { color: theme.colors.text }]}>Text Size</Text>
          <Text style={[styles.settingSubtitle, { color: theme.colors.textSecondary }]}>
            {`${active.label} · ${percent(active.scale)}`}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          accessibilityLabel="Close text size options"
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.colors.surface, paddingBottom: insets.bottom + 8 },
              theme.shadows.large,
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleRow}>
                <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>Text Size</Text>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.preview,
                  { backgroundColor: theme.colors.background, borderColor: theme.colors.border },
                ]}
              >
                <RNText
                  allowFontScaling={false}
                  style={{
                    fontSize: Math.round(PREVIEW_BASE_SIZE * previewScale),
                    lineHeight: Math.round(PREVIEW_BASE_SIZE * previewScale * 1.3),
                    color: theme.colors.text,
                    fontWeight: '700',
                  }}
                >
                  Aa
                </RNText>
                <RNText
                  allowFontScaling={false}
                  style={[styles.previewCaption, { color: theme.colors.textSecondary }]}
                >
                  {`${FONT_SCALE_OPTIONS[draft].label} · ${percent(previewScale)}`}
                </RNText>
              </View>

              {FONT_SCALE_OPTIONS.map((option) => {
                const selected = option.id === FONT_SCALE_OPTIONS[draft].id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.option,
                      selected && { backgroundColor: `${theme.colors.primary}12` },
                    ]}
                    onPress={() => setDraft(FONT_SCALE_OPTIONS.findIndex((o) => o.id === option.id))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label}, ${percent(option.scale)}`}
                  >
                    <RNText
                      allowFontScaling={false}
                      style={[
                        styles.optionLabel,
                        { color: selected ? theme.colors.primary : theme.colors.text },
                      ]}
                    >
                      {option.label}
                    </RNText>
                    <RNText
                      allowFontScaling={false}
                      style={[styles.optionPercent, { color: theme.colors.textTertiary }]}
                    >
                      {percent(option.scale)}
                    </RNText>
                    {selected && (
                      <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.doneButton, { backgroundColor: theme.colors.primary }]}
                onPress={commit}
                accessibilityRole="button"
              >
                <RNText
                  allowFontScaling={false}
                  style={[styles.doneText, { color: isDark ? theme.colors.background : '#FFFFFF' }]}
                >
                  Done
                </RNText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,20,25,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetHeader: {
    marginBottom: 8,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 120,
  },
  previewCaption: {
    fontSize: 13,
    marginTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  optionPercent: {
    fontSize: 14,
    marginRight: 12,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    marginTop: 16,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
