"use client";

import { useRef } from "react";
import type Konva from "konva";
import { Image as KonvaImage } from "react-konva";

import type { ImageElement, StickerElement } from "@/types/frame";

import { useImageElement } from "@/hooks/use-image-element";

type EditableElement = ImageElement | StickerElement;

interface EditableImageProps<T extends EditableElement> {
  nodeId: string;
  element: T;
  isSelected: boolean;
  draggable?: boolean;
  kind: "image" | "sticker";
  onSelect: (kind: "image" | "sticker") => void;
  onChange: (next: Partial<T>) => void;
  nodeName?: string;
  onContextMenu?: (e: any) => void;
}

export const EditableImage = <T extends EditableElement>({
  nodeId,
  element,
  isSelected,
  draggable = true,
  kind,
  onSelect,
  onChange,
  nodeName,
  onContextMenu,
}: EditableImageProps<T>) => {
  const { image } = useImageElement(element.dataUrl);
  const shapeRef = useRef<Konva.Image>(null);

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) {
      return;
    }

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    onChange({
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX,
      scaleY,
    } as Partial<T>);
  };

  const handleDragEnd = () => {
    const node = shapeRef.current;
    if (!node) {
      return;
    }
    onChange({
      x: node.x(),
      y: node.y(),
    } as Partial<T>);
  };

  return (
    <KonvaImage
      id={nodeId}
      name={nodeName}
      image={image ?? undefined}
      ref={shapeRef}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      scaleX={element.scaleX}
      scaleY={element.scaleY}
      rotation={element.rotation}
      opacity={element.opacity ?? 1}
      draggable={draggable && !(element.isLocked ?? false)}
      onClick={() => {
        console.log('🖱️ LEFT CLICK on image:', element.id);
        onSelect(kind);
      }}
      onTap={() => {
        console.log('📱 TAP on image:', element.id);
        onSelect(kind);
      }}
      onMouseEnter={() => {
        console.log('🏠 HOVER on image:', element.id);
      }}
      onMouseLeave={() => {
        console.log('🚪 LEAVE image:', element.id);
      }}
      onContextMenu={(e) => {
        console.log('🖱️ RIGHT-CLICK on image:', element.id, 'Selected:', isSelected);
        e.evt.preventDefault();
        e.evt.stopPropagation();

        // Always select the image immediately on right-click
        if (!isSelected) {
          console.log('🎯 Selecting image immediately:', element.id);
          onSelect(kind);
        }

        if (onContextMenu) {
          console.log('📞 Calling onContextMenu handler for image:', element.id);
          onContextMenu(e);
        } else {
          console.log('❌ No onContextMenu handler provided');
        }
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? "#2563eb" : (element.isLocked ? "#ef4444" : undefined)}
      strokeWidth={isSelected || element.isLocked ? 1 : 0}
      visible={element.isVisible ?? true}
    />
  );
};
