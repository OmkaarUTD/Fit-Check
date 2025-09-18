/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StartScreen from './components/StartScreen';
import Canvas from './components/Canvas';
import WardrobePanel from './components/WardrobeModal';
import OutfitStack from './components/OutfitStack';
import { generateGarmentTryOnImage, generateAccessoryTryOnImage, generatePoseVariation, generateStyleScore, generateStyleSuggestions } from './services/geminiService';
import { OutfitLayer, WardrobeItem, SavedOutfit } from './types';
import { ChevronDownIcon, ChevronUpIcon } from './components/icons';
import { defaultWardrobe } from './wardrobe';
import Footer from './components/Footer';
import { getFriendlyErrorMessage, urlToFile } from './lib/utils';
import Spinner from './components/Spinner';
import SavedOutfitsPanel from './components/SavedOutfitsPanel';

const POSE_INSTRUCTIONS = [
  "Full frontal view, hands on hips",
  "Slightly turned, 3/4 view",
  "Side profile view",
  "Jumping in the air, mid-action shot",
  "Walking towards camera",
  "Leaning against a wall",
];

const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', listener);
    
    if (mediaQueryList.matches !== matches) {
      setMatches(mediaQueryList.matches);
    }

    return () => {
      mediaQueryList.removeEventListener('change', listener);
    };
  }, [query, matches]);

  return matches;
};

interface AppState {
  modelImageUrl: string | null;
  garmentHistory: OutfitLayer[];
  currentGarmentIndex: number;
  activeAccessories: WardrobeItem[];
  generatedAccessoryImageUrl: string | null;
  currentPoseIndex: number;
}

const useHistoryState = <T,>(initialState: T) => {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const state = useMemo(() => history[currentIndex], [history, currentIndex]);

  const setState = useCallback((value: T | ((prevState: T) => T)) => {
    const newState = typeof value === 'function' ? (value as (prevState: T) => T)(state) : value;
    
    // Simple deep-enough comparison to avoid pushing identical states
    if (JSON.stringify(newState) === JSON.stringify(state)) {
      return;
    }

    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  }, [history, currentIndex, state]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prevIndex => prevIndex - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prevIndex => prevIndex - 1);
    }
  }, [currentIndex, history.length]);
  
  const reset = useCallback((newState: T) => {
    setHistory([newState]);
    setCurrentIndex(0);
  }, []);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  return { state, setState, undo, redo, canUndo, canRedo, reset };
};

const StyleSuggestionsPanel: React.FC<{
  suggestions: WardrobeItem[];
  onItemSelect: (file: File, item: WardrobeItem) => Promise<void>;
  isLoading: boolean;
}> = ({ suggestions, onItemSelect, isLoading }) => {
  const handleSuggestionClick = async (item: WardrobeItem) => {
    if (isLoading) return;
    try {
      const file = await urlToFile(item.url, item.name);
      await onItemSelect(file, item);
    } catch (err) {
      console.error("Failed to handle suggestion click", err);
    }
  };

  return (
    <div className="pt-6 border-t border-gray-400/50">
      <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">You might also like...</h2>
      <div className="grid grid-cols-3 gap-3">
        {suggestions.map((item) => (
          <button
            key={item.id}
            onClick={() => handleSuggestionClick(item)}
            disabled={isLoading}
            className="relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label={`Select ${item.name}`}
          >
            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const initialState: AppState = {
    modelImageUrl: null,
    garmentHistory: [],
    currentGarmentIndex: 0,
    activeAccessories: [],
    generatedAccessoryImageUrl: null,
    currentPoseIndex: 0,
  };

  const { state, setState, undo, redo, canUndo, canRedo, reset } = useHistoryState<AppState>(initialState);
  const { modelImageUrl, garmentHistory, currentGarmentIndex, activeAccessories, generatedAccessoryImageUrl, currentPoseIndex } = state;

  // States not part of undo/redo history
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>(defaultWardrobe);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [styleScore, setStyleScore] = useState<{ score: number; critique: string } | null>(null);
  const [isScoringStyle, setIsScoringStyle] = useState(false);
  const [styleSuggestions, setStyleSuggestions] = useState<WardrobeItem[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const isMobile = useMediaQuery('(max-width: 767px)');

  const STORAGE_KEY = 'virtual-try-on-outfits';

  const activeGarmentLayers = useMemo(() => 
    garmentHistory.slice(0, currentGarmentIndex + 1), 
    [garmentHistory, currentGarmentIndex]
  );
  
  const activeGarmentIds = useMemo(() => 
    activeGarmentLayers.slice(1).map(layer => layer.item!.id),
    [activeGarmentLayers]
  );
  const activeAccessoryIds = useMemo(() => activeAccessories.map(acc => acc.id), [activeAccessories]);
  
  const activeItemIds = useMemo(() => 
    [...activeGarmentIds, ...activeAccessoryIds],
    [activeGarmentIds, activeAccessoryIds]
  );
  
  const displayImageUrl = useMemo(() => {
    const currentGarmentLayer = garmentHistory[currentGarmentIndex];
    if (!currentGarmentLayer) return modelImageUrl;

    const poseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
    const baseGarmentImageUrl = currentGarmentLayer.poseImages[poseInstruction] ?? Object.values(currentGarmentLayer.poseImages)[0];

    return generatedAccessoryImageUrl ?? baseGarmentImageUrl;
  }, [garmentHistory, currentGarmentIndex, currentPoseIndex, modelImageUrl, generatedAccessoryImageUrl]);

  const availablePoseKeys = useMemo(() => {
    if (garmentHistory.length === 0) return [];
    const currentLayer = garmentHistory[currentGarmentIndex];
    return currentLayer ? Object.keys(currentLayer.poseImages) : [];
  }, [garmentHistory, currentGarmentIndex]);
  
  const clearStyleScore = useCallback(() => {
    setStyleScore(null);
  }, []);

  useEffect(() => {
    try {
      const storedOutfits = localStorage.getItem(STORAGE_KEY);
      if (storedOutfits) {
        setSavedOutfits(JSON.parse(storedOutfits));
      }
    } catch (error) {
      console.error("Failed to load saved outfits from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedOutfits));
    } catch (error) {
      console.error("Failed to save outfits to localStorage", error);
    }
  }, [savedOutfits]);
  
  // Clear style score and suggestions whenever the active outfit changes
  useEffect(() => {
    clearStyleScore();
    setStyleSuggestions([]);
  }, [activeGarmentLayers, activeAccessories, clearStyleScore]);

  const updateAccessoryLayer = useCallback(async (accessories: WardrobeItem[], overrideBaseImageUrl?: string) => {
    const currentGarmentLayer = garmentHistory[currentGarmentIndex];
    const baseImageUrl = overrideBaseImageUrl ?? (currentGarmentLayer ? (Object.values(currentGarmentLayer.poseImages)[0]) : modelImageUrl);
    
    if (!baseImageUrl) return;

    if (accessories.length === 0) {
        setState(prev => ({...prev, generatedAccessoryImageUrl: null, activeAccessories: []}));
        return;
    }

    setIsLoading(true);
    setLoadingMessage(`Styling accessories...`);
    setError(null);

    try {
        const accessoryFiles = await Promise.all(
            accessories.map(acc => urlToFile(acc.url, acc.name))
        );
        const newImageUrl = await generateAccessoryTryOnImage(baseImageUrl, accessoryFiles, accessories);
        setState(prev => ({...prev, generatedAccessoryImageUrl: newImageUrl, activeAccessories: accessories}));
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to apply accessories'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  }, [garmentHistory, currentGarmentIndex, modelImageUrl, setState]);

  const handleModelFinalized = (url: string) => {
    reset({
      ...initialState,
      modelImageUrl: url,
      garmentHistory: [{
        item: null,
        poseImages: { [POSE_INSTRUCTIONS[0]]: url }
      }],
    });
  };

  const handleStartOver = () => {
    reset(initialState);
    setIsLoading(false);
    setLoadingMessage('');
    setError(null);
    setIsSheetCollapsed(false);
    setWardrobe(defaultWardrobe);
    clearStyleScore();
  };

  const handleItemSelect = useCallback(async (itemFile: File, itemInfo: WardrobeItem) => {
    const baseGarmentImageUrl = displayImageUrl?.startsWith('data:') ? displayImageUrl : modelImageUrl;
    if (!baseGarmentImageUrl || isLoading) return;

    if (itemInfo.type === 'garment') {
        const nextLayer = garmentHistory[currentGarmentIndex + 1];
        if (nextLayer && nextLayer.item?.id === itemInfo.id) {
            setState(prev => ({ ...prev, currentGarmentIndex: prev.currentGarmentIndex + 1, currentPoseIndex: 0, activeAccessories: [], generatedAccessoryImageUrl: null }));
            return;
        }

        setError(null);
        setIsLoading(true);
        setLoadingMessage(`Adding ${itemInfo.name}...`);

        try {
          const newImageUrl = await generateGarmentTryOnImage(baseGarmentImageUrl, itemFile);
          const currentPoseInstruction = POSE_INSTRUCTIONS[currentPoseIndex];
          
          const newLayer: OutfitLayer = { 
            item: itemInfo, 
            poseImages: { [currentPoseInstruction]: newImageUrl } 
          };

          setState(prev => {
            const newHistory = prev.garmentHistory.slice(0, prev.currentGarmentIndex + 1);
            return {
              ...prev,
              garmentHistory: [...newHistory, newLayer],
              currentGarmentIndex: prev.currentGarmentIndex + 1,
              activeAccessories: [],
              generatedAccessoryImageUrl: null,
            };
          });
          
          setWardrobe(prev => {
            if (prev.find(item => item.id === itemInfo.id)) return prev;
            return [...prev, itemInfo];
          });
        } catch (err) {
          setError(getFriendlyErrorMessage(err, 'Failed to apply item'));
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
    } else { // Accessory
        const isAlreadyActive = activeAccessories.some(acc => acc.id === itemInfo.id);
        const newAccessories = isAlreadyActive
            ? activeAccessories.filter(acc => acc.id !== itemInfo.id)
            : [...activeAccessories, itemInfo];
        
        updateAccessoryLayer(newAccessories);
    }
  }, [displayImageUrl, modelImageUrl, isLoading, currentPoseIndex, garmentHistory, currentGarmentIndex, activeAccessories, updateAccessoryLayer, setState]);

  const handleRemoveLastGarment = () => {
    if (currentGarmentIndex > 0) {
      setState(prev => ({
        ...prev,
        currentGarmentIndex: prev.currentGarmentIndex - 1,
        currentPoseIndex: 0,
        activeAccessories: [],
        generatedAccessoryImageUrl: null,
      }));
    }
  };
  
  const handlePoseSelect = useCallback(async (newIndex: number) => {
    if (isLoading || garmentHistory.length === 0 || newIndex === currentPoseIndex) return;
    
    const poseInstruction = POSE_INSTRUCTIONS[newIndex];
    const currentLayer = garmentHistory[currentGarmentIndex];

    if (currentLayer.poseImages[poseInstruction]) {
      setState(prev => ({ ...prev, currentPoseIndex: newIndex }));
      if (activeAccessories.length > 0) {
        updateAccessoryLayer(activeAccessories, currentLayer.poseImages[poseInstruction]);
      }
      return;
    }

    const baseImageForPoseChange = Object.values(currentLayer.poseImages)[0];
    if (!baseImageForPoseChange) return;

    setError(null);
    setIsLoading(true);
    setLoadingMessage(`Changing pose...`);
    
    try {
      const newImageUrl = await generatePoseVariation(baseImageForPoseChange, poseInstruction);
      const newHistory = [...garmentHistory];
      const updatedLayer = newHistory[currentGarmentIndex];
      updatedLayer.poseImages[poseInstruction] = newImageUrl;

      setState(prev => ({
        ...prev,
        garmentHistory: newHistory,
        currentPoseIndex: newIndex,
      }));
      
      if (activeAccessories.length > 0) {
        await updateAccessoryLayer(activeAccessories, newImageUrl);
      }
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Failed to change pose'));
      // No need to revert state, as setState was not called on error
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [currentPoseIndex, garmentHistory, isLoading, currentGarmentIndex, activeAccessories, updateAccessoryLayer, setState]);

  const handleSaveOutfit = () => {
    if (!modelImageUrl || !displayImageUrl || (currentGarmentIndex === 0 && activeAccessories.length === 0)) {
        setError("Add at least one item to save an outfit.");
        setTimeout(() => setError(null), 4000);
        return;
    }

    const historyToSave = activeGarmentLayers.map(layer => ({
      item: layer.item,
      imageUrl: Object.values(layer.poseImages)[0],
    }));

    const newSavedOutfit: SavedOutfit = {
        id: `outfit-${Date.now()}`,
        name: `Outfit - ${new Date().toLocaleString()}`,
        thumbnailUrl: displayImageUrl,
        modelImageUrl,
        garmentHistory: historyToSave,
        activeAccessories,
        wardrobe,
    };

    setSavedOutfits(prev => [newSavedOutfit, ...prev]);
  };

  const handleLoadOutfit = (outfitId: string) => {
    if (isLoading) return;
    const outfitToLoad = savedOutfits.find(o => o.id === outfitId);
    if (outfitToLoad) {
        setError(null);
        setIsLoading(true);
        setLoadingMessage("Loading outfit...");
        
        setTimeout(() => {
            const reconstructedHistory: OutfitLayer[] = outfitToLoad.garmentHistory.map(storedLayer => ({
                item: storedLayer.item,
                poseImages: { [POSE_INSTRUCTIONS[0]]: storedLayer.imageUrl }
            }));
            
            reset({
              modelImageUrl: outfitToLoad.modelImageUrl,
              garmentHistory: reconstructedHistory,
              currentGarmentIndex: reconstructedHistory.length - 1,
              currentPoseIndex: 0,
              activeAccessories: outfitToLoad.activeAccessories,
              generatedAccessoryImageUrl: null, // will be regenerated
            });

            setWardrobe(outfitToLoad.wardrobe);
            
            if (outfitToLoad.activeAccessories.length > 0) {
              const baseImageUrl = Object.values(reconstructedHistory[reconstructedHistory.length - 1].poseImages)[0];
              updateAccessoryLayer(outfitToLoad.activeAccessories, baseImageUrl);
            } else {
              setState(prev => ({...prev, generatedAccessoryImageUrl: null}));
            }

            setIsLoading(false);
            setLoadingMessage('');
        }, 200);
    }
  };

  const handleDeleteOutfit = (outfitId: string) => {
    if (isLoading) return;
    setSavedOutfits(prev => prev.filter(o => o.id !== outfitId));
  };

  const handleDownloadImage = () => {
    if (!displayImageUrl) return;
    const link = document.createElement('a');
    link.href = displayImageUrl;
    link.download = `virtual-try-on-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleReorderGarments = async (reorderedItems: OutfitLayer[]) => {
    const newOrderedHistory = [garmentHistory[0], ...reorderedItems];
    
    if (JSON.stringify(newOrderedHistory.map(l => l.item?.id)) === JSON.stringify(garmentHistory.map(l => l.item?.id))) {
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingMessage('Re-styling your outfit...');

    try {
      let currentImage = modelImageUrl!;
      const regeneratedLayers: OutfitLayer[] = [garmentHistory[0]];

      for (let i = 1; i < newOrderedHistory.length; i++) {
        const layerToApply = newOrderedHistory[i];
        const itemInfo = layerToApply.item!;
        const itemFile = await urlToFile(itemInfo.url, itemInfo.name);

        const newImageUrl = await generateGarmentTryOnImage(currentImage, itemFile);
        currentImage = newImageUrl;
        
        const newLayer: OutfitLayer = {
            item: itemInfo,
            poseImages: { [POSE_INSTRUCTIONS[0]]: newImageUrl }
        };
        regeneratedLayers.push(newLayer);
      }
      
      const finalGarmentImage = currentImage;
      
      setState(prev => ({
        ...prev,
        garmentHistory: regeneratedLayers,
        currentGarmentIndex: regeneratedLayers.length - 1,
        currentPoseIndex: 0,
      }));

      if (activeAccessories.length > 0) {
        await updateAccessoryLayer(activeAccessories, finalGarmentImage);
      }

    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to reorder outfit. Reverting to previous order.'));
    } finally {
        setIsLoading(false);
        setLoadingMessage('');
    }
  };
  
  const handleRemoveAccessory = (accessoryId: string) => {
    if (isLoading) return;
    const newAccessories = activeAccessories.filter(acc => acc.id !== accessoryId);
    updateAccessoryLayer(newAccessories);
  };
  
  const handleReorderAccessories = (reorderedItems: WardrobeItem[]) => {
    if (isLoading) return;
    updateAccessoryLayer(reorderedItems);
  };

  const handleGetStyleScore = async () => {
    if (isScoringStyle || (activeGarmentLayers.length <= 1 && activeAccessories.length === 0)) return;

    setIsScoringStyle(true);
    setError(null);
    clearStyleScore();

    try {
        const allItems = [
            ...activeGarmentLayers.slice(1).map(layer => layer.item!),
            ...activeAccessories
        ];
        
        if (allItems.length > 0) {
            const result = await generateStyleScore(allItems);
            setStyleScore(result);
        }
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to get style score'));
    } finally {
        setIsScoringStyle(false);
    }
  };

  const handleGetStyleSuggestions = async () => {
    if (isSuggesting || isLoading) return;
  
    const currentItems = [
        ...activeGarmentLayers.slice(1).map(layer => layer.item!),
        ...activeAccessories
    ];
  
    if (currentItems.length === 0) {
        setError("Add at least one item to get suggestions.");
        setTimeout(() => setError(null), 4000);
        return;
    }
  
    setIsSuggesting(true);
    setError(null);
    setStyleSuggestions([]);
  
    try {
        const availableItems = wardrobe.filter(item => !activeItemIds.includes(item.id));
        if (availableItems.length === 0) {
            return; 
        }
        
        const suggestedIds = await generateStyleSuggestions(currentItems, availableItems);
        const suggestions = wardrobe.filter(item => suggestedIds.includes(item.id));
        setStyleSuggestions(suggestions);
  
    } catch (err) {
        setError(getFriendlyErrorMessage(err, 'Failed to get style suggestions'));
    } finally {
        setIsSuggesting(false);
    }
  };

  const viewVariants = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
  };

  return (
    <div className="font-sans">
      <AnimatePresence mode="wait">
        {!modelImageUrl ? (
          <motion.div
            key="start-screen"
            className="w-screen min-h-screen flex items-start sm:items-center justify-center bg-gray-50 p-4 pb-20"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <StartScreen onModelFinalized={handleModelFinalized} />
          </motion.div>
        ) : (
          <motion.div
            key="main-app"
            className="relative flex flex-col h-screen bg-white overflow-hidden"
            variants={viewVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <main className="flex-grow relative flex flex-col md:flex-row overflow-hidden">
              <div className="w-full h-full flex-grow flex items-center justify-center bg-white pb-16 relative">
                <Canvas 
                  displayImageUrl={displayImageUrl}
                  onStartOver={handleStartOver}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  onSelectPose={handlePoseSelect}
                  poseInstructions={POSE_INSTRUCTIONS}
                  currentPoseIndex={currentPoseIndex}
                  availablePoseKeys={availablePoseKeys}
                  onDownloadImage={handleDownloadImage}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
              </div>

              <aside 
                className={`absolute md:relative md:flex-shrink-0 bottom-0 right-0 h-auto md:h-full w-full md:w-1/3 md:max-w-sm bg-white/80 backdrop-blur-md flex flex-col border-t md:border-t-0 md:border-l border-gray-200/60 transition-transform duration-500 ease-in-out ${isSheetCollapsed ? 'translate-y-[calc(100%-4.5rem)]' : 'translate-y-0'} md:translate-y-0`}
                style={{ transitionProperty: 'transform' }}
              >
                  <button 
                    onClick={() => setIsSheetCollapsed(!isSheetCollapsed)} 
                    className="md:hidden w-full h-8 flex items-center justify-center bg-gray-100/50"
                    aria-label={isSheetCollapsed ? 'Expand panel' : 'Collapse panel'}
                  >
                    {isSheetCollapsed ? <ChevronUpIcon className="w-6 h-6 text-gray-500" /> : <ChevronDownIcon className="w-6 h-6 text-gray-500" />}
                  </button>
                  <div className="p-4 md:p-6 pb-20 overflow-y-auto flex-grow flex flex-col gap-8">
                    {error && (
                      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded-md" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                      </div>
                    )}
                    <OutfitStack 
                      garmentHistory={activeGarmentLayers}
                      activeAccessories={activeAccessories}
                      onRemoveLastGarment={handleRemoveLastGarment}
                      onRemoveAccessory={handleRemoveAccessory}
                      onSaveOutfit={handleSaveOutfit}
                      canSave={!isLoading && (currentGarmentIndex > 0 || activeAccessories.length > 0)}
                      onReorderGarments={handleReorderGarments}
                      onReorderAccessories={handleReorderAccessories}
                      isLoading={isLoading}
                      onGetStyleScore={handleGetStyleScore}
                      onClearStyleScore={clearStyleScore}
                      styleScore={styleScore}
                      isScoringStyle={isScoringStyle}
                      onGetStyleSuggestions={handleGetStyleSuggestions}
                      isSuggesting={isSuggesting}
                    />
                    <AnimatePresence>
                      {styleSuggestions.length > 0 && (
                        <motion.div 
                          layout 
                          initial={{ opacity: 0, height: 0, y: -20 }} 
                          animate={{ opacity: 1, height: 'auto', y: 0 }} 
                          exit={{ opacity: 0, height: 0, y: -20 }}
                          transition={{ duration: 0.4, ease: 'easeInOut' }}
                        >
                          <StyleSuggestionsPanel 
                            suggestions={styleSuggestions} 
                            onItemSelect={handleItemSelect} 
                            isLoading={isLoading} 
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <WardrobePanel
                      onItemSelect={handleItemSelect}
                      activeItemIds={activeItemIds}
                      isLoading={isLoading}
                      wardrobe={wardrobe}
                    />
                    <SavedOutfitsPanel
                      outfits={savedOutfits}
                      onLoad={handleLoadOutfit}
                      onDelete={handleDeleteOutfit}
                      isLoading={isLoading}
                    />
                  </div>
              </aside>
            </main>
            <AnimatePresence>
              {isLoading && isMobile && (
                <motion.div
                  className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Spinner />
                  {loadingMessage && (
                    <p className="text-lg font-serif text-gray-700 mt-4 text-center px-4">{loadingMessage}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <Footer isOnDressingScreen={!!modelImageUrl} />
    </div>
  );
};

export default App;