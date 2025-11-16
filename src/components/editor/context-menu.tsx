"use client";

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Scissors,
  Trash2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Layers,
  Layers3,
  Square,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Palette
} from 'lucide-react';

interface ContextMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string) => void;
  elementType: 'image' | 'text' | 'sticker';
  isLocked?: boolean;
  elementVisible?: boolean;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isVisible,
  position,
  onClose,
  onAction,
  elementType,
  isLocked = false,
  elementVisible = true
}) => {
  console.log('🎨 ContextMenu render:', {
    isVisible,
    position,
    elementType
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    console.log('❌ Context menu not visible, returning null');
    return null;
  }

  console.log('✅ Context menu is visible, rendering...');

  // Smart positioning to keep menu close to mouse but within viewport
  const adjustedPosition = {
    x: Math.min(position.x + 5, window.innerWidth - 200), // 5px offset, stay within viewport
    y: Math.min(position.y + 5, window.innerHeight - 300), // 5px offset, stay within viewport
  };

  const menuItems = [
    // Basic Actions
    { icon: Copy, label: 'Copy', action: 'copy', divider: false },
    { icon: Square, label: 'Duplicate', action: 'duplicate', divider: false },
    { icon: Trash2, label: 'Delete', action: 'delete', divider: true },

    // Layer Management
    { icon: Layers3, label: 'Bring to Front', action: 'bring-front', divider: false },
    { icon: Layers, label: 'Send to Back', action: 'send-back', divider: true },

    // Image-specific options
    ...(elementType === 'image' ? [
      { icon: Crop, label: 'Crop', action: 'crop', divider: false },
      { icon: Palette, label: 'Transparency', action: 'transparency', divider: false },
      { icon: RotateCw, label: 'Rotate', action: 'rotate', divider: false },
      { icon: FlipHorizontal, label: 'Flip H', action: 'flip-h', divider: false },
      { icon: FlipVertical, label: 'Flip V', action: 'flip-v', divider: true },
    ] : []),

    // Lock/Visibility
    {
      icon: isLocked ? Unlock : Lock,
      label: isLocked ? 'Unlock' : 'Lock',
      action: 'toggle-lock',
      divider: false
    },
    {
      icon: elementVisible ? EyeOff : Eye,
      label: elementVisible ? 'Hide' : 'Show',
      action: 'toggle-visibility',
      divider: false
    },
  ];

  console.log('🎨 Creating menu element at:', adjustedPosition);

  const menuElement = (
    <div
      ref={menuRef}
      className="fixed min-w-48 rounded-lg bg-white border border-gray-200 shadow-xl py-2"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 999999,
        pointerEvents: 'auto',
        backgroundColor: 'white',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={item.action}>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
            onClick={() => {
              onAction(item.action);
              onClose();
            }}
          >
            <item.icon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700">{item.label}</span>
          </button>
          {item.divider && index < menuItems.length - 1 && (
            <div className="border-t border-gray-100 my-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // Temporarily render directly (not as portal) for debugging
  console.log('🚀 Rendering context menu directly (debug mode)');
  return menuElement;

  // TODO: Re-enable portal after debugging
  // if (typeof window !== 'undefined') {
  //   console.log('🚀 Rendering context menu via portal to document.body');
  //   return createPortal(menuElement, document.body);
  // }
  // return null;
};