import React from 'react';

export interface SkinLayer {
  name: string;
  enabled: boolean;
}

export interface PixelChange {
  x: number;
  y: number;
  color: string;
}

export interface Tool {
  name: 'brush' | 'eraser' | 'picker';
  icon: React.ReactNode;
}

export enum ViewMode {
  Mode3D = '3D',
  Mode2D = '2D',
  Split = 'Split'
}

export interface GeneratorConfig {
    itemName: string;
    itemLore: string;
    isUnbreakable: boolean;
    enchantments: boolean;
}

export interface HistoryNode {
    id: string;
    parentId: string | null;
    textureData: string;
    previewData: string;
    timestamp: number;
    children: string[];
    activeChildId: string | null; // For linear redo logic within branches
}