import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface AppleIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const AppleIcon: React.FC<AppleIconProps> = ({
  size = 48,
  color = '#000000', // Classic Apple black
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name="apple" size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AppleIcon;
