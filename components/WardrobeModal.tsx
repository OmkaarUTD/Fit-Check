/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo } from 'react';
import type { WardrobeItem } from '../types';
import { UploadCloudIcon, CheckCircleIcon } from './icons';
import { urlToFile } from '../lib/utils';

interface WardrobePanelProps {
  onItemSelect: (itemFile: File, itemInfo: WardrobeItem) => void;
  activeItemIds: string[];
  isLoading: boolean;
  wardrobe: WardrobeItem[];
}

const WardrobePanel: React.FC<WardrobePanelProps> = ({ onItemSelect, activeItemIds, isLoading, wardrobe }) => {
    const [error, setError] = useState<string | null>(null);

    const garments = useMemo(() => wardrobe.filter(item => item.type === 'garment'), [wardrobe]);
    const accessories = useMemo(() => wardrobe.filter(item => item.type === 'accessory'), [wardrobe]);

    const handleItemClick = async (item: WardrobeItem) => {
        if (isLoading) return;
        // Garments cannot be re-selected if active, but accessories can be toggled.
        if (item.type === 'garment' && activeItemIds.includes(item.id)) return;
        
        setError(null);
        try {
            const file = await urlToFile(item.url, item.name);
            onItemSelect(file, item);
        } catch (err) {
            const detailedError = `Failed to load wardrobe item. This is often a CORS issue. Check the developer console for details.`;
            setError(detailedError);
            console.error(`[CORS Check] Failed to load and convert wardrobe item from URL: ${item.url}. The browser's console should have a specific CORS error message if that's the issue.`, err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                if (dataUrl) {
                    const customItemInfo: WardrobeItem = {
                        id: `custom-${Date.now()}`,
                        name: file.name,
                        url: dataUrl, // Use data URL for persistence
                        type: 'garment', // User-uploaded items default to garments
                    };
                    onItemSelect(file, customItemInfo);
                } else {
                    setError('Could not read the uploaded file.');
                }
            };
            reader.onerror = () => setError('Error reading the uploaded file.');
            reader.readAsDataURL(file);
        }
    };

  const renderWardrobeGrid = (items: WardrobeItem[], isApparel: boolean) => (
    <div className="grid grid-cols-3 gap-3">
        {items.map((item) => {
        const isActive = activeItemIds.includes(item.id);
        const isDisabled = isLoading || (isActive && item.type === 'garment');
        return (
            <button
            key={item.id}
            onClick={() => handleItemClick(item)}
            disabled={isDisabled}
            className="relative aspect-square border rounded-lg overflow-hidden transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-800 group disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label={`Select ${item.name}`}
            >
            <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs font-bold text-center p-1">{item.name}</p>
            </div>
            {isActive && (
                <div className="absolute inset-0 bg-gray-900/70 flex items-center justify-center">
                    <CheckCircleIcon className="w-8 h-8 text-white" />
                </div>
            )}
            </button>
        );
        })}
        {isApparel && (
            <label htmlFor="custom-garment-upload" className={`relative aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 transition-colors ${isLoading ? 'cursor-not-allowed bg-gray-100' : 'hover:border-gray-400 hover:text-gray-600 cursor-pointer'}`}>
                <UploadCloudIcon className="w-6 h-6 mb-1"/>
                <span className="text-xs text-center">Upload</span>
                <input id="custom-garment-upload" type="file" className="hidden" accept="image/png, image/jpeg, image/webp, image/avif, image/heic, image/heif" onChange={handleFileChange} disabled={isLoading}/>
            </label>
        )}
    </div>
  );

  return (
    <div className="pt-6 border-t border-gray-400/50 flex flex-col gap-8">
        <div>
          <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Apparel</h2>
          {renderWardrobeGrid(garments, true)}
        </div>
        {accessories.length > 0 && (
          <div>
            <h2 className="text-xl font-serif tracking-wider text-gray-800 mb-3">Accessories</h2>
            {renderWardrobeGrid(accessories, false)}
          </div>
        )}
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
    </div>
  );
};

export default WardrobePanel;
