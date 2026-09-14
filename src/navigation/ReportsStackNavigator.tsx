import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ReportsScreen } from '../screens/ReportsScreen';
import { ReportDetailScreen } from '../screens/ReportDetailScreen';
import { ReportsStackParamList } from '../types';

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export const ReportsStackNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="ReportsList"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ReportsList" component={ReportsScreen} />
      <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
    </Stack.Navigator>
  );
};
