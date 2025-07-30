import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const slides = [
  {
    image: require('@/assets/Pngs/book.png'),
    tagline: 'Fast citywide delivery at your fingertips.',
  },
  {
    image: require('@/assets/Pngs/locationparcel.png'),
    tagline: 'Track your package in real-time.',
  },
  {
    image: require('@/assets/Pngs/savetime.png'),
    tagline: 'Your deliveries are safe and insured.',
  },
];

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const pagerRef = useRef<PagerView>(null);
  const [page, setPage] = useState(0);
  const { width, height } = useWindowDimensions();

  const handleSkip = async () => {
    await AsyncStorage.setItem('onboarding_seen', 'true');
    router.replace('/(auth)/welcome');
  };

  const handlePageSelected = (e: any) => {
    setPage(e.nativeEvent.position);
  };

  const handleNext = () => {
    if (page < slides.length - 1) {
      pagerRef.current?.setPage(page + 1);
    } else {
      handleSkip();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      <PagerView
        style={{ flex: 1 }}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={handlePageSelected}
      >
        {slides.map((slide, idx) => (
          <View key={idx} style={styles.slide}>
            <Image
              source={slide.image}
              style={[
                styles.image,
                { width: width * 0.7, tintColor: undefined },
              ]}
              resizeMode="contain"
            />
            <Text style={[styles.tagline, { color: theme.colors.text }]}>
              {slide.tagline}
            </Text>
            <View style={styles.dotsContainer}>
              {slides.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === page
                          ? theme.colors.primary
                          : theme.colors.textTertiary,
                    },
                  ]}
                />
              ))}
            </View>
            {/* Next/Get Started button remains in center */}
            {idx < slides.length - 1 && (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={[styles.nextText, { color: '#fff' }]}>Next</Text>
              </TouchableOpacity>
            )}
            {idx === slides.length - 1 && (
              <TouchableOpacity
                style={[
                  styles.nextButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleSkip}
                activeOpacity={0.8}
              >
                <Text style={[styles.nextText, { color: '#fff' }]}>
                  Get Started
                </Text>
              </TouchableOpacity>
            )}
            {/* Skip button absolutely positioned at bottom right */}
            <TouchableOpacity
              style={[
                styles.skipButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  position: 'absolute',
                  bottom: 32,
                  right: 32,
                  marginBottom: 0,
                  alignSelf: 'auto',
                },
              ]}
              onPress={handleSkip}
              activeOpacity={0.8}
            >
              <Text style={[styles.skipText, { color: theme.colors.primary }]}>
                Skip
              </Text>
            </TouchableOpacity>
          </View>
        ))}
      </PagerView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  image: {
    height: 240,
    marginBottom: 40,
    alignSelf: 'center',
  },
  tagline: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  skipButton: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginBottom: 16,
    alignSelf: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignSelf: 'center',
  },
  nextText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
