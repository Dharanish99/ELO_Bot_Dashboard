import React from 'react';
import { Platform, StyleSheet, TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { HomeStackParamList } from '../types';
import { colors } from '../theme';

// Screens — lazy-required to avoid circular issues
import { HomeMainScreen } from '../screens/HomeMainScreen';
import { ControlScreen } from '../screens/ControlScreen';
import { VoiceScreen } from '../screens/VoiceScreen';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export const HomeStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={({ navigation }) => ({
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen name="HomeMain" component={HomeMainScreen} />
      <Stack.Screen
        name="Control"
        component={ControlScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="Voice"
        component={VoiceScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};
