import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SettingsStackParamList } from '../types';
import { colors } from '../theme';

import { SettingsMainScreen } from '../screens/SettingsMainScreen';
import { PiConnectionScreen } from '../screens/PiConnectionScreen';
import { DiagnosticsScreen } from '../screens/DiagnosticsScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="SettingsMain" component={SettingsMainScreen} />
      <Stack.Screen name="PiConnection" component={PiConnectionScreen} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
    </Stack.Navigator>
  );
};
