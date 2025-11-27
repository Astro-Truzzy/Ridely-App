import React from "react";
import { View, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

interface GoogleIconProps {
    size?: number;
    color?: string;
}

const GoogleIcon: React.FC<GoogleIconProps> = ({ size = 24, color = "#4285F4" }) => {
    return (
        <View style={styles.container}>
            <Icon name="google" size={size} color={color} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default GoogleIcon;