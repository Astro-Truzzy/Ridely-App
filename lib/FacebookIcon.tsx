import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

interface FacebookIconProps {
  size?: number;
  color?: string;
  style?: ViewStyle;
}

const FacebookIcon: React.FC<FacebookIconProps> = ({
  size = 40,
  color = '#1877F2',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons name="facebook" size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FacebookIcon;
