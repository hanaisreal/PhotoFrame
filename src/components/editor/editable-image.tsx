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
      draggable={draggable}
      onClick={() => onSelect(kind)}
      onTap={() => onSelect(kind)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      stroke={isSelected ? "#2563eb" : undefined}
      strokeWidth={isSelected ? 1 : 0}
    />
  );
};
