import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Package, ChevronRight } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

interface ParcelSize {
  id: 'small' | 'medium' | 'large';
  title: string;
  description: string;
  dimensions: string;
  maxWeight: string;
  icon: string;
}

const PARCEL_SIZES: ParcelSize[] = [
  { id: 'small', title: 'Small', description: 'Documents, keys, small items', dimensions: 'Up to 20cm x 15cm x 5cm', maxWeight: 'Max 1kg', icon: '📄' },
  { id: 'medium', title: 'Medium', description: 'Clothing, books, electronics', dimensions: 'Up to 40cm x 30cm x 20cm', maxWeight: 'Max 5kg', icon: '📦' },
  { id: 'large', title: 'Large', description: 'Large packages, multiple items', dimensions: 'Up to 60cm x 45cm x 40cm', maxWeight: 'Max 15kg', icon: '📫' },
];

function ParcelSizeCard({
  size,
  selected,
  onSelect,
  theme,
  isDark,
}: {
  size: ParcelSize;
  selected: boolean;
  onSelect: () => void;
  theme: { colors: { card: string; border: string; text: string; textSecondary: string; primary: string }; shadows: { medium: object } };
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.sizeCard,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border, ...theme.shadows.medium },
        selected && styles.selectedSizeCard,
        selected && { borderColor: theme.colors.primary, backgroundColor: isDark ? theme.colors.surface : '#F8F9FF' },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${size.title}: ${size.description}`}
    >
      <View style={styles.sizeHeader}>
        <Text style={styles.sizeIcon}>{size.icon}</Text>
        <View style={styles.sizeInfo}>
          <Text style={[styles.sizeTitle, { color: theme.colors.text }, selected && { color: theme.colors.primary }]}>{size.title}</Text>
          <Text style={[styles.sizeDescription, { color: theme.colors.textSecondary }, selected && { color: theme.colors.primary }]}>{size.description}</Text>
        </View>
        {selected && (
          <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </View>
      <View style={styles.sizeDetails}>
        <Text style={[styles.sizeDimensions, { color: theme.colors.textSecondary }, selected && { color: theme.colors.primary }]}>📏 {size.dimensions}</Text>
        <Text style={[styles.sizeWeight, { color: theme.colors.textSecondary }, selected && { color: theme.colors.primary }]}>⚖️ {size.maxWeight}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const { scheduleLater } = useLocalSearchParams<{ scheduleLater?: string }>();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const handleContinue = useCallback(() => {
    if (selectedSize) {
      router.push({
        pathname: '/booking/address',
        params: { size: selectedSize, ...(scheduleLater ? { scheduleLater: '1' } : {}) },
      });
    }
  }, [selectedSize, scheduleLater]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['left', 'right', 'bottom']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {/* Header - card background fills to top; content padded below status bar */}
      <View style={[styles.header, {
        backgroundColor: theme.colors.card,
        borderBottomColor: theme.colors.border,
        paddingTop: 10 + insets.top,
      }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? theme.colors.card : '#F3F4F6' }]}
          onPress={() => router.back()}>
          <ArrowLeft size={24} color={theme.colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.colors.text }]}>Book a Delivery</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.activeStep]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
            <View style={[styles.progressStep, { backgroundColor: theme.colors.border }]} />
          </View>
          <Text style={[styles.progressText, { color: theme.colors.textSecondary }]}>{'Step 1 of 4'}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Package size={28} color={theme.colors.primary} strokeWidth={2} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{'Select Parcel Size'}</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
            Choose the size that best fits your package. Pricing will be calculated based on
            your selection and delivery distance.
          </Text>

          {/* Size Options */}
          <View style={styles.sizeContainer}>
            {PARCEL_SIZES.map((size) => (
              <ParcelSizeCard
                key={size.id}
                size={size}
                selected={selectedSize === size.id}
                onSelect={() => setSelectedSize(size.id)}
                theme={theme}
                isDark={!!isDark}
              />
            ))}
          </View>

          {/* Info Box */}
          <View style={[styles.infoBox, { 
            backgroundColor: isDark ? theme.colors.info + '18' : '#F0F9FF',
            borderLeftColor: theme.colors.info
          }]}>
            <Text style={[styles.infoTitle, { color: isDark ? theme.colors.info : '#0C4A6E' }]}>{'💡 Good to know'}</Text>
            <Text style={[styles.infoText, { color: isDark ? theme.colors.textSecondary : '#0C4A6E' }]}>
              {'• Medium parcels include a 2% size surcharge\n'}
              {'• Large parcels include a 5% size surcharge\n'}
              {'• Final pricing is calculated after address selection\n'}
              {'• All packages are insured up to $100'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={[styles.bottomContainer, { 
        backgroundColor: theme.colors.card,
        borderTopColor: theme.colors.border
      }]}>
        <TouchableOpacity
          style={[styles.continueButton,
            !selectedSize && { backgroundColor: theme.colors.border },
            selectedSize && { backgroundColor: theme.colors.primary },
          ]}
          onPress={handleContinue}
          disabled={!selectedSize}>
          <Text
            style={[
              styles.continueText,
              !selectedSize && { color: theme.colors.textTertiary },
              selectedSize && { color: '#FFFFFF' },
            ]}>
            {'Continue to Addresses'}
          </Text>
          <ChevronRight
            size={20}
            color={selectedSize ? '#FFFFFF' : theme.colors.textTertiary}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressStep: {
    width: 60,
    height: 4,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  activeStep: {
    backgroundColor: '#5A47FF',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  sizeContainer: {
    gap: 16,
    marginBottom: 32,
  },
  sizeCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedSizeCard: {
    borderColor: '#5A47FF',
  },
  sizeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sizeIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  sizeInfo: {
    flex: 1,
  },
  sizeTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sizeDescription: {
    fontSize: 14,
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sizeDetails: {
    paddingLeft: 48,
  },
  sizeDimensions: {
    fontSize: 14,
    marginBottom: 4,
  },
  sizeWeight: {
    fontSize: 14,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomContainer: {
    padding: 20,
    borderTopWidth: 1,
  },
  continueButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});