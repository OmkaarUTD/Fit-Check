/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  type: 'garment' | 'accessory';
}

export interface OutfitLayer {
  item: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}

export interface SavedOutfit {
  id: string;
  name: string;
  thumbnailUrl: string;
  modelImageUrl: string;
  garmentHistory: {
    item: WardrobeItem | null;
    imageUrl: string;
  }[];
  activeAccessories: WardrobeItem[];
  wardrobe: WardrobeItem[];
}
