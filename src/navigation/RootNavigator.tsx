import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from '../screens/HomeScreen';
import { ReportsStackNavigator } from './ReportsStackNavigator';
import { RestrictionsScreen } from '../screens/RestrictionsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RootTabParamList } from '../types';
import { colors } from '../theme';

const Tab = createBottomTabNavigator<RootTabParamList>();

export const RootNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Home') {
            iconName = focused ? 'radio-button-on' : 'radio-button-off';
          } else if (route.name === 'Reports') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Restrictions') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Control' }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsStackNavigator}
        options={{ tabBarLabel: 'Reports' }}
      />
      <Tab.Screen
        name="Restrictions"
        component={RestrictionsScreen}
        options={{ tabBarLabel: 'Limits' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    elevation: 0,
    shadowOpacity: 0,
    height: Platform.OS === 'ios' ? 84 : 60,
    paddingBottom: Platform.OS === 'ios' ? 24 : 6,
    paddingTop: 6,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
