import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SpotCategory } from './src/types';
import CategorySelectScreen from './src/screens/CategorySelectScreen';
import GuideScreen from './src/screens/GuideScreen';

type Screen = 'category' | 'guide';

export default function App() {
  const [screen, setScreen] = useState<Screen>('category');
  const [selectedCategories, setSelectedCategories] = useState<SpotCategory[]>([]);

  const handleStart = (categories: SpotCategory[]) => {
    setSelectedCategories(categories);
    setScreen('guide');
  };

  const handleStop = () => {
    setScreen('category');
  };

  return (
    <>
      <StatusBar style="auto" />
      {screen === 'category' ? (
        <CategorySelectScreen onStart={handleStart} />
      ) : (
        <GuideScreen
          selectedCategories={selectedCategories}
          onStop={handleStop}
        />
      )}
    </>
  );
}
