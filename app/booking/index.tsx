import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { ArrowLeft, Package, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';

interface ParcelSize {
  id: 'small' | 'medium' | 'large';
  title: string;
  description: string;
  dimensions: string;
  maxWeight: string;
  icon: string;
}

export default function BookingScreen() {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const parcelSizes: ParcelSize[] = [
    {
      id: 'small',
      title: 'Small',
      description: 'Documents, keys, small items',
      dimensions: 'Up to 20cm x 15cm x 5cm',
      maxWeight: 'Max 1kg',
      icon: '📄',
    },
    {
      id: 'medium',
      title: 'Medium',
      description: 'Clothing, books, electronics',
      dimensions: 'Up to 40cm x 30cm x 20cm',
      maxWeight: 'Max 5kg',
      icon: '📦',
    },
    {
      id: 'large',
      title: 'Large',
      description: 'Large packages, multiple items',
      dimensions: 'Up to 60cm x 45cm x 40cm',
      maxWeight: 'Max 15kg',
      icon: '📫',
    },
  ];

  const handleContinue = () => {
    if (selectedSize) {
      router.push({
        pathname: '/booking/address',
        params: { size: selectedSize },
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.title}>Book a Delivery</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, styles.activeStep]} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
            <View style={styles.progressStep} />
          </View>
          <Text style={styles.progressText}>Step 1 of 4</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.sectionHeader}>
            <Package size={28} color="#5A47FF" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Select Parcel Size</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Choose the size that best fits your package. Pricing will be calculated based on
            your selection and delivery distance.
          </Text>

          {/* Size Options */}
          <View style={styles.sizeContainer}>
            {parcelSizes.map((size) => (
              <TouchableOpacity
                key={size.id}
                style={[
                  styles.sizeCard,
                  selectedSize === size.id && styles.selectedSizeCard,
                ]}
                onPress={() => setSelectedSize(size.id)}>
                <View style={styles.sizeHeader}>
                  <Text style={styles.sizeIcon}>{size.icon}</Text>
                  <View style={styles.sizeInfo}>
                    <Text
                      style={[
                        styles.sizeTitle,
                        selectedSize === size.id && styles.selectedText,
                      ]}>
                      {size.title}
                    </Text>
                    <Text
                      style={[
                        styles.sizeDescription,
                        selectedSize === size.id && styles.selectedSubtext,
                      ]}>
                      {size.description}
                    </Text>
                  </View>
                  {selectedSize === size.id && (
                    <View style={styles.checkmark}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </View>
                <View style={styles.sizeDetails}>
                  <Text
                    style={[
                      styles.sizeDimensions,
                      selectedSize === size.id && styles.selectedSubtext,
                    ]}>
                    📏 {size.dimensions}
                  </Text>
                  <Text
                    style={[
                      styles.sizeWeight,
                      selectedSize === size.id && styles.selectedSubtext,
                    ]}>
                    ⚖️ {size.maxWeight}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>💡 Good to know</Text>
            <Text style={styles.infoText}>
              • Medium parcels include a 2% size surcharge{'\n'}
              • Large parcels include a 5% size surcharge{'\n'}
              • Final pricing is calculated after address selection{'\n'}
              • All packages are insured up to $100
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.continueButton, !selectedSize && styles.disabledButton]}
          onPress={handleContinue}
          disabled={!selectedSize}>
          <Text style={[styles.continueText, !selectedSize && styles.disabledText]}>
            Continue to Addresses
          </Text>
          <ChevronRight
            size={20}
            color={selectedSize ? '#FFFFFF' : '#9CA3AF'}
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
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
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
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  activeStep: {
    backgroundColor: '#5A47FF',
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#1F2937',
    marginLeft: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 32,
  },
  sizeContainer: {
    gap: 16,
    marginBottom: 32,
  },
  sizeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedSizeCard: {
    borderColor: '#5A47FF',
    backgroundColor: '#F8F9FF',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  selectedText: {
    color: '#5A47FF',
  },
  sizeDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  selectedSubtext: {
    color: '#4F46E5',
  },
  checkmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#5A47FF',
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
    color: '#6B7280',
    marginBottom: 4,
  },
  sizeWeight: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C4A6E',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0C4A6E',
    lineHeight: 20,
  },
  bottomContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueButton: {
    flexDirection: 'row',
    backgroundColor: '#5A47FF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#E5E7EB',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  disabledText: {
    color: '#9CA3AF',
  },
});