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

  const applyTextTransform = useCallback(
    (node: Konva.Text, commit: boolean) => {
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();

      // Use the average of scaleX and scaleY for more consistent scaling
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2;

      const nextWidth = Math.max(80, node.width() * Math.abs(scaleX));
      const nextFontSize = Math.max(8, node.fontSize() * avgScale);

      node.width(nextWidth);
      node.fontSize(nextFontSize);
      node.scaleX(1);
      node.scaleY(1);
      node.getLayer()?.batchDraw();

      if (commit && selection.kind === "text" && selection.id) {
        updateTextElement(selection.id, {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          width: nextWidth,
          fontSize: nextFontSize,
        });
      }
    },
    [selection.id, selection.kind, updateTextElement],
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
    console.log('🖱️ Right-click detected!', {
      elementId,
      elementType,
      event: e,
      evt: e.evt
    });

    e.evt.preventDefault();

    // Get stage position to calculate menu position
    const stage = stageRef.current;
    if (!stage) {
      console.log('❌ No stage reference');
      return;
    }

    const stageBox = stage.container().getBoundingClientRect();
    const position = {
      x: e.evt.clientX,
      y: e.evt.clientY,
    };

    console.log('📍 Context menu position:', position);

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

    // Also select the element
    setSelection({ id: elementId, kind: elementType });

    // Log the state after setting it
    setTimeout(() => {
      console.log('🔍 Context menu state after update:', contextMenu);
    }, 100);
  }, [setSelection, setContextMenu]);


  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) {
      return;
    }

    if (!selection.id || !selection.kind) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const target = stage.findOne(`#${selection.kind}-${selection.id}`);
    if (target) {
      transformer.nodes([target as Konva.Node]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selection, stageRef]);

  const handleStageDeselection = (event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    const clickedOnEmpty = event.target === event.target.getStage();
    if (clickedOnEmpty) {
      setSelection({ id: null, kind: null });
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const handleContextMenuAction = (action: string) => {
    const { elementId, elementType } = contextMenu;
    if (!elementId || !elementType) return;

    switch (action) {
      case 'copy':
        // TODO: Implement copy to clipboard
        console.log('Copy action for:', elementType, elementId);
        break;

      case 'duplicate':
        if (elementType === 'image') {
          const originalImage = images.find(img => img.id === elementId);
          if (originalImage) {
            addImage({
              ...originalImage,
              x: originalImage.x + 20,
              y: originalImage.y + 20,
            });
          }
        } else if (elementType === 'sticker') {
          const originalSticker = stickers.find(sticker => sticker.id === elementId);
          if (originalSticker) {
            addSticker({
              ...originalSticker,
              x: originalSticker.x + 20,
              y: originalSticker.y + 20,
            });
          }
        } else if (elementType === 'text') {
          const originalText = texts.find(text => text.id === elementId);
          if (originalText) {
            addText({
              ...originalText,
              x: originalText.x + 20,
              y: originalText.y + 20,
            });
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
        break;

      case 'bring-front':
        // TODO: Implement z-index management
        console.log('Bring to front:', elementType, elementId);
        break;

      case 'send-back':
        // TODO: Implement z-index management
        console.log('Send to back:', elementType, elementId);
        break;

      case 'crop':
        if (elementType === 'image') {
          // TODO: Implement crop functionality
          console.log('Crop image:', elementId);
        }
        break;

      case 'transparency':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            // Toggle transparency (opacity)
            const currentOpacity = image.opacity ?? 1;
            const newOpacity = currentOpacity === 0.5 ? 1 : 0.5;
            updateImage(elementId, { opacity: newOpacity });
          }
        } else if (elementType === 'sticker') {
          const sticker = stickers.find(s => s.id === elementId);
          if (sticker) {
            const currentOpacity = sticker.opacity ?? 1;
            const newOpacity = currentOpacity === 0.5 ? 1 : 0.5;
            updateSticker(elementId, { opacity: newOpacity });
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
          }
        }
        break;

      case 'flip-v':
        if (elementType === 'image') {
          const image = images.find(img => img.id === elementId);
          if (image) {
            updateImage(elementId, { scaleY: -image.scaleY });
          }
        }
        break;

      case 'toggle-lock':
        // TODO: Implement lock/unlock functionality
        console.log('Toggle lock:', elementType, elementId);
        break;

      case 'toggle-visibility':
        // TODO: Implement show/hide functionality
        console.log('Toggle visibility:', elementType, elementId);
        break;

      default:
        console.log('Unknown action:', action);
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
    groupedImages.get(slotId)?.map((image) => (
      <EditableImage
        key={image.id}
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
    floatingImages.map((image) => (
      <EditableImage
        key={image.id}
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
    stickers.map((sticker) => (
      <EditableImage
        key={sticker.id}
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
        element={text}
        isSelected={selection.id === text.id && selection.kind === "text"}
        onSelect={() => setSelection({ id: text.id, kind: "text" })}
        onChange={(next) => updateTextElement(text.id, next)}
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
        console.log('🚫 Preventing default context menu');
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
        onClick={handleStageDeselection}
        onTouchStart={handleStageDeselection}
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

          {layout.bottomText.content ? (
            <Text
              text={layout.bottomText.content}
              fill={layout.bottomText.color}
              fontSize={layout.bottomText.fontSize}
              fontFamily={layout.bottomText.fontFamily}
              letterSpacing={layout.bottomText.letterSpacing}
              align="center"
              width={layout.canvas.width}
              x={0}
              y={layout.canvas.height - layout.bottomText.offsetY}
              name="frame-bottom-text"
            />
          ) : null}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={transformerAnchors}
              boundBoxFunc={transformerBoundBox}
              anchorCornerRadius={4}
              onTransform={() => {
                if (selection.kind === "text") {
                  const node = transformerRef.current
                    ?.nodes?.()[0] as Konva.Text | undefined;
                  if (node) {
                    applyTextTransform(node, false);
                  }
                }
              }}
              onTransformEnd={() => {
                if (selection.kind === "text") {
                  const node = transformerRef.current
                    ?.nodes?.()[0] as Konva.Text | undefined;
                  if (node) {
                    applyTextTransform(node, true);
                  }
                }
              }}
            />
        </Layer>
      </Stage>

      {/* Context Menu */}
      {(() => {
        console.log('🎨 Rendering ContextMenu with props:', {
          isVisible: contextMenu.visible,
          position: contextMenu.position,
          elementType: contextMenu.elementType || 'image',
          contextMenuState: contextMenu
        });
        return (
          <ContextMenu
            isVisible={contextMenu.visible}
            position={contextMenu.position}
            onClose={closeContextMenu}
            onAction={handleContextMenuAction}
            elementType={contextMenu.elementType || 'image'}
          />
        );
      })()}
    </div>
  );
};
