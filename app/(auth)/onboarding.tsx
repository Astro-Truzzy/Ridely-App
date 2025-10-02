import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
  Image,
  Animated,
} from 'react-native';
import { ChevronRight, SkipBack as Skip } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

import { ImageSourcePropType } from 'react-native';

interface OnboardingSlide {
  id: string;
  image: ImageSourcePropType;
  title: string;
  subtitle: string;
  tagline: string;
}

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = new Animated.Value(0);

  const slides: OnboardingSlide[] = [
    {
      id: '1',
      image: require('@/assets/Illustrations/savetime.png'),
      title: 'Fast & Reliable Delivery',
      subtitle:
        'Get your packages delivered quickly with our network of verified motorcycle riders',
      tagline: 'Speed meets reliability',
    },
    {
      id: '2',
      image: require('@/assets/Illustrations/locationparcel.png'),
      title: 'Real-time Tracking',
      subtitle:
        'Track your delivery in real-time and stay connected with your rider throughout the journey',
      tagline: 'Always in the know',
    },
    {
      id: '3',
      image: require('@/assets/Illustrations/doorstep.png'),
      title: 'Secure & Insured',
      subtitle:
        'Every package is insured up to NGN100,000 with end-to-end security and verified riders',
      tagline: 'Your trust, our priority',
    },
  ];

  const handleNext = () => {
    if (currentIndex < slides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  const handleSkip = () => {
    router.replace('/(auth)/welcome');
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderSlide = ({
    item,
    index,
  }: {
    item: OnboardingSlide;
    index: number;
  }) => {
    const inputRange = [
      (index - 1) * screenWidth,
      index * screenWidth,
      (index + 1) * screenWidth,
    ];

    const imageScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.8, 1, 0.8],
      extrapolate: 'clamp',
    });

    const imageOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.3, 1, 0.3],
      extrapolate: 'clamp',
    });

    const textTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [50, 0, -50],
      extrapolate: 'clamp',
    });

    const textOpacity = scrollX.interpolate({
      inputRange,
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });

    return (
      <View style={[styles.slide, { width: screenWidth }]}>
        <View style={styles.imageContainer}>
          <Animated.View
            style={[
              styles.imageWrapper,
              {
                transform: [{ scale: imageScale }],
                opacity: imageOpacity,
              },
            ]}
          >
            <Image
              source={item.image}
              style={styles.slideImage}
              resizeMode="cover"
            />
            <View
              style={[
                styles.imageOverlay,
                { backgroundColor: `${theme.colors.primary}20` },
              ]}
            />
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              transform: [{ translateY: textTranslateY }],
              opacity: textOpacity,
            },
          ]}
        >
          <Text style={[styles.tagline, { color: theme.colors.primary }]}>
            {item.tagline}
          </Text>
          <Text style={[styles.slideTitle, { color: theme.colors.text }]}>
            {item.title}
          </Text>
          <Text
            style={[
              styles.slideSubtitle,
              { color: theme.colors.textSecondary },
            ]}
          >
            {item.subtitle}
          </Text>
        </Animated.View>
      </View>
    );
  };

  const renderPagination = () => {
    return (
      <View style={styles.paginationContainer}>
        {slides.map((_, index) => {
          const inputRange = [
            (index - 1) * screenWidth,
            index * screenWidth,
            (index + 1) * screenWidth,
          ];

          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.paginationDot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
      {/* Skip Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text
            style={[styles.skipText, { color: theme.colors.textSecondary }]}
          >
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
      />

      {/* Bottom Section */}
      <View style={styles.bottomContainer}>
        {renderPagination()}

        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: theme.colors.primary },
            theme.shadows.medium,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <ChevronRight size={20} color="#FFFFFF" strokeWidth={2} />
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    alignItems: 'flex-end',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginBottom: 40,
  },
  imageWrapper: {
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
    position: 'relative',
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 140,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  slideSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    height: 8,
  },
  paginationDot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  nextButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
});
