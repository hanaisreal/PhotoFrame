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
    elementType,
    timestamp: Date.now()
  });
  const menuRef = useRef<HTMLDivElement>(null);
  const openingTimeRef = useRef<number>(0);

  // Add logging to onClose to track when and why it's being called
  const loggedOnClose = () => {
    console.log('🚨 CONTEXT MENU CLOSING - onClose called!', {
      timestamp: Date.now(),
      timeSinceOpen: Date.now() - openingTimeRef.current,
      stackTrace: new Error().stack
    });
    onClose();
  };

  useEffect(() => {
    if (isVisible) {
      console.log('🚀 Context menu becoming visible, recording opening time');
      openingTimeRef.current = Date.now();

      const handleClickOutside = (event: MouseEvent) => {
        const timeSinceOpen = Date.now() - openingTimeRef.current;
        console.log('🖱️ Mouse event detected', {
          type: event.type,
          button: event.button,
          target: event.target,
          timeSinceOpen: timeSinceOpen + 'ms',
          menuRef: menuRef.current
        });

        // Ignore right mouse button events (button 2) completely - they're for opening, not closing
        if (event.button === 2) {
          console.log('🚫 Ignoring right mouse button event');
          return;
        }

        // Ignore clicks that happen too soon after opening (within 300ms)
        if (timeSinceOpen < 300) {
          console.log('⏰ Ignoring click - too soon after opening');
          return;
        }

        // Only close on LEFT clicks outside the menu
        if (event.button === 0 && menuRef.current && !menuRef.current.contains(event.target as Node)) {
          console.log('📴 Closing context menu due to left click outside');
          loggedOnClose();
        } else {
          console.log('🏠 Click was inside menu or not a left click, keeping open');
        }
      };

      console.log('🎧 Adding mouse event listeners');
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('mouseup', handleClickOutside, true);

      return () => {
        console.log('🧹 Cleaning up context menu listeners');
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('mouseup', handleClickOutside, true);
      };
    }

    return () => {
      console.log('🧹 Context menu not visible, no cleanup needed');
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    console.log('❌ Context menu not visible, returning null');
    return null;
  }

  console.log('✅ Context menu is visible, rendering...');

  // Smart positioning to keep menu close to mouse but within viewport
  const menuWidth = 200;
  const menuHeight = 300;

  const adjustedPosition = {
    x: position.x + menuWidth > window.innerWidth
      ? position.x - menuWidth - 10  // Show on left if too close to right edge
      : position.x,
    y: position.y + menuHeight > window.innerHeight
      ? position.y - menuHeight - 10 // Show above if too close to bottom edge
      : position.y,
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
      className="fixed min-w-48 rounded-xl bg-white border border-gray-200 shadow-lg py-1 animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        zIndex: 999999,
        pointerEvents: 'auto',
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        console.log('🖱️ Clicked inside context menu - not closing');
      }}
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={item.action}>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-all duration-150 hover:scale-[1.02] rounded-lg mx-1"
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