import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ELOProvider } from './src/context/ELOContext';
import { V2Provider } from './src/context/V2Context';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <ELOProvider>
        <V2Provider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </V2Provider>
      </ELOProvider>
    </SafeAreaProvider>
  );
}
