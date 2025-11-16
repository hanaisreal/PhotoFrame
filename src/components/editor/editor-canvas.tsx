"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import {
  Stage,
  Layer,
  Rect,
  Group,
  Text,
  Transformer,
  Line,
} from "react-konva";
import useImage from "use-image";

import { EditableImage } from "@/components/editor/editable-image";
import { EditableText } from "@/components/editor/editable-text";
import { ContextMenu } from "@/components/editor/context-menu";
import { useEditorStore } from "@/state/editor-store";
import type { ImageElement, StickerElement } from "@/types/frame";

interface EditorCanvasProps {
  stageRef: React.RefObject<Konva.Stage>;
}

const SLOT_BACKGROUND = "#ffffff";
const MAX_CANVAS_SCALE = 0.45;

export const EditorCanvas = ({ stageRef }: EditorCanvasProps) => {
  const layout = useEditorStore((state) => state.layout);
  const images = useEditorStore((state) => state.images);
  const stickers = useEditorStore((state) => state.stickers);
  const texts = useEditorStore((state) => state.texts);
  const overlayDataUrl = useEditorStore((state) => state.overlayDataUrl);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const updateImage = useEditorStore((state) => state.updateImage);
  const updateSticker = useEditorStore((state) => state.updateSticker);
  const updateTextElement = useEditorStore((state) => state.updateText);
  const removeImage = useEditorStore((state) => state.removeImage);
  const removeSticker = useEditorStore((state) => state.removeSticker);
  const removeText = useEditorStore((state) => state.removeText);
  const addImage = useEditorStore((state) => state.addImage);
  const addSticker = useEditorStore((state) => state.addSticker);
  const addText = useEditorStore((state) => state.addText);



  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(MAX_CANVAS_SCALE);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    elementId: string | null;
    elementType: 'image' | 'text' | 'sticker' | null;
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    elementId: null,
    elementType: null,
  });



  type TransformerBoundBox = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  };

  const transformerAnchors = useMemo(() => {
    if (selection.kind === "text") {
      return [
        "top-left",
        "top-right",
        "bottom-left",
        "bottom-right",
      ];
    }
    return ["top-left", "top-right", "bottom-left", "bottom-right"];
  }, [selection.kind]);

  const transformerBoundBox = useCallback(
    (oldBox: TransformerBoundBox, newBox: TransformerBoundBox) => {
      if (selection.kind === "text") {
        const minWidth = 60;
        const minHeight = 30;
        if (
          Math.abs(newBox.width) < minWidth ||
          Math.abs(newBox.height) < minHeight
        ) {
          return oldBox;
        }
      }
      return newBox;
    },
    [selection.kind],
  );

  const textTransformCache = useRef(
    new Map<
      string,
      { width: number; height: number; fontSize: number }
    >(),
  );

  const beginTextTransform = useCallback((node: Konva.Text) => {
    const cache = {
      width: Math.max(Math.abs(node.width()), 1),
      height: Math.max(Math.abs(node.height()), 1),
      fontSize: node.fontSize(),
    };
    textTransformCache.current.set(node.id(), cache);
  }, []);

  const applyTextTransform = useCallback(
    (node: Konva.Text, commit: boolean) => {
      let cache = textTransformCache.current.get(node.id());

      if (!cache) {
        const stateText =
          selection.kind === "text" && selection.id
            ? texts.find((t) => t.id === selection.id)
            : undefined;
        cache = {
          width: Math.max(
            stateText?.width ?? Math.abs(node.width()),
            1,
          ),
          height: Math.max(Math.abs(node.height()), 1),
          fontSize: stateText?.fontSize ?? node.fontSize(),
        };
        textTransformCache.current.set(node.id(), cache);
      }

      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const rawWidth = Math.max(Math.abs(node.width()), 1);
      const rawHeight = Math.max(Math.abs(node.height()), 1);

      const hasDirectScale =
        Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001;

      let computedScaleX = hasDirectScale
        ? Math.abs(scaleX)
        : Math.abs(rawWidth / cache.width);
      let computedScaleY = hasDirectScale
        ? Math.abs(scaleY)
        : Math.abs(rawHeight / cache.height);

      if (!Number.isFinite(computedScaleX) || computedScaleX === 0) {
        computedScaleX = 1;
      }
      if (!Number.isFinite(computedScaleY) || computedScaleY === 0) {
        computedScaleY = computedScaleX;
      }

      // Use the dominant axis to keep perceived scale consistent even if only width/height changes
      const effectiveScale = Math.max(computedScaleX, computedScaleY);

      const nextWidth = Math.max(
        80,
        hasDirectScale ? cache.width * computedScaleX : rawWidth,
      );
      const nextFontSize = Math.max(8, cache.fontSize * effectiveScale);

      console.log('🔧 applyTextTransform:', {
        commit,
        oldFontSize: node.fontSize(),
        scaleX,
        scaleY,
        effectiveScale,
        nextFontSize,
        nextWidth,
      });

      node.width(nextWidth);
      node.fontSize(nextFontSize);
      node.scaleX(1);
      node.scaleY(1);
      node.getLayer()?.batchDraw();

      if (commit && selection.kind === "text" && selection.id) {
        console.log('💾 Committing text transform to state');
        updateTextElement(selection.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: nextWidth,
          fontSize: nextFontSize,
        });
        textTransformCache.current.delete(node.id());
      }
    },
    [selection.id, selection.kind, texts, updateTextElement],
  );


  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const width = container.offsetWidth * 0.9;
      const height =
        (container.offsetHeight || window.innerHeight) * 0.8;
      const scaleByWidth = width / layout.canvas.width;
      const scaleByHeight = height / layout.canvas.height;
      const nextScale = Math.min(
        scaleByWidth,
        scaleByHeight,
        MAX_CANVAS_SCALE,
      );
      setScale(nextScale);
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [layout.canvas.height, layout.canvas.width]);

  const handleContextMenu = useCallback((e: any, elementId: string, elementType: 'image' | 'text' | 'sticker') => {
    console.log('🎯 handleContextMenu called!', {
      elementId,
      elementType,
      event: e,
      evt: e?.evt,
      currentMenuVisible: contextMenu.visible
    });

    e.evt.preventDefault();

    // If context menu is already visible, close it first
    if (contextMenu.visible) {
      console.log('🔄 Context menu already visible, closing first');
      setContextMenu(prev => ({ ...prev, visible: false }));
      // Small delay before showing new one
      setTimeout(() => {
        showContextMenu();
      }, 50);
      return;
    }

    showContextMenu();

    function showContextMenu() {
      // Use the exact mouse position from the event
      const position = {
        x: e.evt.clientX + 5, // Small offset so menu doesn't cover cursor
        y: e.evt.clientY + 5,
      };

      console.log('📍 Context menu position:', position);

      // Selection is already handled at the image level, just show context menu
      setContextMenu({
        visible: true,
        position,
        elementId,
        elementType,
      });

      console.log('🎯 Setting context menu state:', {
        visible: true,
        position,
        elementId,
        elementType,
      });
    }
  }, [setContextMenu, contextMenu.visible]);

  const handleStageDeselection = useCallback((event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const isMouseEvent = event.evt instanceof MouseEvent;
    const button = isMouseEvent ? (event.evt as MouseEvent).button : undefined;

    console.log('🎯 Stage deselection triggered:', {
      target: event.target,
      targetName: event.target.name?.(),
      targetClassName: event.target.className,
      button: button,
      contextMenuVisible: contextMenu.visible,
      eventType: isMouseEvent ? 'mouse' : 'touch'
    });

    // Don't close context menu on right-clicks or if context menu is visible
    // Only check button for mouse events
    if ((isMouseEvent && button === 2) || contextMenu.visible) {
      console.log('🚫 Ignoring stage deselection - right click or context menu visible');
      return;
    }

    // Don't deselect when clicking on text elements
    if (event.target.className === 'Text' && event.target.name?.() === 'editable-text') {
      console.log('🚫 Ignoring stage deselection - clicked on text element');
      return;
    }

    // Don't deselect when clicking on images
    if (event.target.className === 'Image') {
      console.log('🚫 Ignoring stage deselection - clicked on image element');
      return;
    }

    // Don't deselect when clicking on transformer anchors
    if (event.target.className === 'Rect' && event.target.name?.().includes('_anchor')) {
      console.log('🚫 Ignoring stage deselection - clicked on transformer anchor');
      return;
    }

    // Don't deselect when clicking on the transformer itself
    if (event.target.className === 'Transformer') {
      console.log('🚫 Ignoring stage deselection - clicked on transformer');
      return;
    }

    // Only deselect if we actually clicked on the Stage background
    if (event.target === event.target.getStage()) {
      console.log('🔄 Clearing selection - clicked on stage background');
      if (selection.id) {
        setSelection({ id: null, kind: null });
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    } else {
      console.log('🚫 Ignoring stage deselection - not stage background');
    }
  }, [selection.id, setSelection, contextMenu.visible]);

  // Update handleStageDeselection to use current contextMenu state
  const handleStageDeselectionWithContext = useCallback((event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    return handleStageDeselection(event);
  }, [handleStageDeselection]);


  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;

    console.log('🔧 Transformer attachment attempt:', {
      transformerExists: !!transformer,
      stageExists: !!stage,
      selection: selection
    });

    if (!transformer || !stage) {
      console.log('❌ Missing transformer or stage references');
      return;
    }

    if (!selection.id || !selection.kind) {
      console.log('🧹 Clearing transformer - no selection');
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const targetId = `${selection.kind}-${selection.id}`;
    const target = stage.findOne(`#${targetId}`);

    console.log('🎯 Looking for target:', {
      targetId: targetId,
      found: !!target,
      targetType: target?.className,
      allTextNodes: stage.find('Text').map(n => ({ id: n.id(), className: n.className, name: n.name?.() }))
    });

    if (target) {
      console.log('✅ Attaching transformer to target');
      transformer.nodes([target as Konva.Node]);
      transformer.getLayer()?.batchDraw();
    } else {
      console.log('❌ Target not found, clearing transformer');
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selection, stageRef]);


  const closeContextMenu = useCallback(() => {
    console.log('🔒 Closing context menu');
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);


  const generateUniqueId = () => {
    return `img-${Math.random().toString(36).substr(2, 8)}`;
  };

  const handleContextMenuAction = (action: string) => {
    const { elementId, elementType } = contextMenu;
    if (!elementId || !elementType) return;

    switch (action) {
      case 'copy':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            // Copy to clipboard as JSON
            const imageData = { ...image, type: 'image' };
            navigator.clipboard.writeText(JSON.stringify(imageData))
              .then(() => console.log('✅ Image copied to clipboard'))
              .catch(err => console.error('❌ Failed to copy:', err));
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const stickerData = { ...sticker, type: 'sticker' };
            navigator.clipboard.writeText(JSON.stringify(stickerData))
              .then(() => console.log('✅ Sticker copied to clipboard'))
              .catch(err => console.error('❌ Failed to copy:', err));
          }
        }
        break;

      case 'duplicate':
        if (elementType === 'image') {
          const originalImage = images.find(img => img.id === elementId);
          if (originalImage) {
            const newImage = {
              ...originalImage,
              id: generateUniqueId(),
              x: originalImage.x + 20,
              y: originalImage.y + 20,
              zIndex: (originalImage.zIndex ?? 0) + 1,
            };
            addImage(newImage);
            console.log('✅ Image duplicated with new ID:', newImage.id);
          }
        } else if (elementType === 'sticker') {
          const originalSticker = stickers.find(sticker => sticker.id === elementId);
          if (originalSticker) {
            const newSticker = {
              ...originalSticker,
              id: generateUniqueId(),
              x: originalSticker.x + 20,
              y: originalSticker.y + 20,
              zIndex: (originalSticker.zIndex ?? 0) + 1,
            };
            addSticker(newSticker);
            console.log('✅ Sticker duplicated with new ID:', newSticker.id);
          }
        }
        break;

      case 'delete':
        if (elementType === 'image') {
          removeImage(elementId);
        } else if (elementType === 'sticker') {
          removeSticker(elementId);
        } else if (elementType === 'text') {
          removeText(elementId);
        }
        setSelection({ id: null, kind: null });
        console.log('✅ Element deleted:', elementId);
        break;

      case 'bring-front':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            const maxZ = Math.max(...images.map(img => img.zIndex ?? 0), 0);
            updateImage(elementId, { zIndex: maxZ + 1 });
            console.log('✅ Image brought to front, z-index:', maxZ + 1);
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const maxZ = Math.max(...stickers.map(s => s.zIndex ?? 0), 0);
            updateSticker(elementId, { zIndex: maxZ + 1 });
            console.log('✅ Sticker brought to front, z-index:', maxZ + 1);
          }
        }
        break;

      case 'send-back':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            const minZ = Math.min(...images.map(img => img.zIndex ?? 0), 0);
            updateImage(elementId, { zIndex: minZ - 1 });
            console.log('✅ Image sent to back, z-index:', minZ - 1);
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const minZ = Math.min(...stickers.map(s => s.zIndex ?? 0), 0);
            updateSticker(elementId, { zIndex: minZ - 1 });
            console.log('✅ Sticker sent to back, z-index:', minZ - 1);
          }
        }
        break;

      case 'crop':
        if (elementType === 'image') {
          // Enter crop mode - we'll implement a crop overlay
          console.log('🔲 Entering crop mode for image:', elementId);
          // TODO: Implement crop overlay UI
          alert('Crop functionality - Coming soon! Will add interactive crop overlay.');
        }
        break;

      case 'transparency':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            const currentOpacity = Math.round((image.opacity ?? 1) * 100);
            const newOpacity = prompt(`Set transparency (0-100%):`, currentOpacity.toString());
            if (newOpacity !== null) {
              const opacityValue = Math.max(0, Math.min(100, parseInt(newOpacity) || 100)) / 100;
              updateImage(elementId, { opacity: opacityValue });
            }
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const currentOpacity = Math.round((sticker.opacity ?? 1) * 100);
            const newOpacity = prompt(`Set transparency (0-100%):`, currentOpacity.toString());
            if (newOpacity !== null) {
              const opacityValue = Math.max(0, Math.min(100, parseInt(newOpacity) || 100)) / 100;
              updateSticker(elementId, { opacity: opacityValue });
            }
          }
        }
        break;

      case 'rotate':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            updateImage(elementId, { rotation: (image.rotation + 90) % 360 });
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            updateSticker(elementId, { rotation: (sticker.rotation + 90) % 360 });
          }
        }
        break;

      case 'flip-h':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            updateImage(elementId, { scaleX: -image.scaleX });
            console.log('✅ Image flipped horizontally');
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            updateSticker(elementId, { scaleX: -sticker.scaleX });
            console.log('✅ Sticker flipped horizontally');
          }
        }
        break;

      case 'flip-v':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            updateImage(elementId, { scaleY: -image.scaleY });
            console.log('✅ Image flipped vertically');
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            updateSticker(elementId, { scaleY: -sticker.scaleY });
            console.log('✅ Sticker flipped vertically');
          }
        }
        break;

      case 'toggle-lock':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            const isLocked = !(image.isLocked ?? false);
            updateImage(elementId, { isLocked });
            console.log('✅ Image lock toggled:', isLocked ? 'LOCKED' : 'UNLOCKED');
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const isLocked = !(sticker.isLocked ?? false);
            updateSticker(elementId, { isLocked });
            console.log('✅ Sticker lock toggled:', isLocked ? 'LOCKED' : 'UNLOCKED');
          }
        }
        break;

      case 'toggle-visibility':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            const isVisible = !(image.isVisible ?? true);
            updateImage(elementId, { isVisible });
            console.log('✅ Image visibility toggled:', isVisible ? 'VISIBLE' : 'HIDDEN');
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const isVisible = !(sticker.isVisible ?? true);
            updateSticker(elementId, { isVisible });
            console.log('✅ Sticker visibility toggled:', isVisible ? 'VISIBLE' : 'HIDDEN');
          }
        }
        break;

      default:
        console.log('Unknown action:', action);
    }

    // Close context menu after action (unless opening transparency slider)
    if (action !== 'transparency') {
      closeContextMenu();
    }
  };

  const groupedImages = useMemo(() => {
    const map = new Map<string, ImageElement[]>();
    layout.slots.forEach((slot) => {
      map.set(slot.id, []);
    });
    images.forEach((image) => {
      if (image.slotId && map.has(image.slotId)) {
        map.get(image.slotId)?.push(image);
      }
    });
    return map;
  }, [images, layout.slots]);

  const floatingImages = images.filter((image) => !image.slotId);

  const renderSlotImages = (slotId: string) =>
    groupedImages.get(slotId)?.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((image) => (
      <EditableImage
        key={`slot-${slotId}-${image.id}`}
        nodeId={`image-${image.id}`}
        element={image}
        kind="image"
        nodeName="template-image"
        isSelected={
          selection.id === image.id && selection.kind === "image"
        }
        onSelect={(kind) => setSelection({ id: image.id, kind })}
        onChange={(next) => updateImage(image.id, next)}
        onContextMenu={(e) => handleContextMenu(e, image.id, 'image')}
      />
    ));

  const renderFloatingImages = () =>
    floatingImages.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((image) => (
      <EditableImage
        key={`floating-${image.id}`}
        nodeId={`image-${image.id}`}
        element={image}
        kind="image"
        nodeName="template-image"
        isSelected={
          selection.id === image.id && selection.kind === "image"
        }
        onSelect={(kind) => setSelection({ id: image.id, kind })}
        onChange={(next) => updateImage(image.id, next)}
        onContextMenu={(e) => handleContextMenu(e, image.id, 'image')}
      />
    ));

  const renderStickers = () =>
    stickers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)).map((sticker) => (
      <EditableImage
        key={`sticker-${sticker.id}`}
        nodeId={`sticker-${sticker.id}`}
        element={sticker as StickerElement}
        kind="sticker"
        nodeName="template-sticker"
        isSelected={
          selection.id === sticker.id && selection.kind === "sticker"
        }
        onSelect={(kind) => setSelection({ id: sticker.id, kind })}
        onChange={(next) => updateSticker(sticker.id, next)}
        onContextMenu={(e) => handleContextMenu(e, sticker.id, 'sticker')}
      />
    ));

  const renderTexts = () =>
    texts.map((text) => (
      <EditableText
        key={text.id}
        nodeId={`text-${text.id}`}
        element={{ ...text, isLocked: true }}
        isSelected={false}
        onSelect={() =>
          console.log("✋ Text editing is currently locked.")
        }
        onChange={() => undefined}
      />
    ));

  const scaledWidth = layout.canvas.width * scale;
  const scaledHeight = layout.canvas.height * scale;
  const stageOffsetX = (layout.canvas.width - scaledWidth) / 2;
  const stageOffsetY = (layout.canvas.height - scaledHeight) / 2;

  return (
    <div
      ref={containerRef}
      className="relative flex w-full items-center justify-center overflow-hidden"
      style={{ height: "calc(100vh - 180px)", maxHeight: "720px" }}
      onContextMenu={(e) => {
        console.log('🚫 Preventing browser context menu');
        e.preventDefault();
      }}
    >
      <Stage
        width={layout.canvas.width}
        height={layout.canvas.height}
        scaleX={scale}
        scaleY={scale}
        x={stageOffsetX}
        y={stageOffsetY}
        ref={stageRef}
        onClick={handleStageDeselectionWithContext}
        onTap={handleStageDeselectionWithContext}
      >
        <Layer>
          {/* Always render the live frame structure, never use overlay in editor */}
          <Rect
            x={0}
            y={0}
            width={layout.canvas.width}
            height={layout.canvas.height}
            fill={layout.frame.backgroundColor}
            cornerRadius={layout.frame.cornerRadius}
            name="frame-base"
            listening={false}
          />
          {layout.slots.map((slot) => (
            <Group
              key={slot.id}
              x={slot.x}
              y={slot.y}
              clip={{
                x: 0,
                y: 0,
                width: slot.width,
                height: slot.height,
              }}
            >
              <Rect
                x={0}
                y={0}
                width={slot.width}
                height={slot.height}
                cornerRadius={layout.frame.cornerRadius}
                name="slot-background"
                fill={SLOT_BACKGROUND}
                stroke="transparent"
                strokeWidth={0}
                listening={false}
              />
              <Line
                points={[0, 0, slot.width, slot.height]}
                stroke="#d4d4d8"
                strokeWidth={2}
                dash={[10, 6]}
                listening={false}
              />
              <Line
                points={[slot.width, 0, 0, slot.height]}
                stroke="#d4d4d8"
                strokeWidth={2}
                dash={[10, 6]}
                listening={false}
              />
            </Group>
          ))}
          <Rect
            x={0}
            y={0}
            width={layout.canvas.width}
            height={layout.canvas.height}
            stroke={layout.frame.color}
            strokeWidth={layout.frame.thickness}
            cornerRadius={layout.frame.cornerRadius}
            listening={false}
          />

          {/* Slot images with clipping */}
          {layout.slots.map((slot) => (
            <Group
              key={`slot-images-${slot.id}`}
              x={slot.x}
              y={slot.y}
              clip={{
                x: 0,
                y: 0,
                width: slot.width,
                height: slot.height,
              }}
            >
              {renderSlotImages(slot.id)}
            </Group>
          ))}

          {/* Floating images and other elements */}
          {renderFloatingImages()}
          {renderStickers()}
          {renderTexts()}

            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={transformerAnchors}
              boundBoxFunc={transformerBoundBox}
              anchorCornerRadius={4}
            />
        </Layer>
      </Stage>


      {/* Context Menu */}
      {(() => {
        const element = contextMenu.elementType === 'image'
          ? images.find(img => img.id === contextMenu.elementId)
          : stickers.find(s => s.id === contextMenu.elementId);

        return (
          <ContextMenu
            isVisible={contextMenu.visible}
            position={contextMenu.position}
            onClose={closeContextMenu}
            onAction={handleContextMenuAction}
            elementType={contextMenu.elementType || 'image'}
            isLocked={element?.isLocked ?? false}
            elementVisible={element?.isVisible ?? true}
            elementOpacity={element?.opacity ?? 1}
          />
        );
      })()}
    </div>
  );
};
