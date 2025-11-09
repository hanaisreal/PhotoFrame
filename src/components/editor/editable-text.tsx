"use client";

import { useRef } from "react";
import type Konva from "konva";
import { Text as KonvaText } from "react-konva";

import type { TextElement } from "@/types/frame";

interface EditableTextProps {
  nodeId: string;
  element: TextElement;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (next: Partial<TextElement>) => void;
}

export const EditableText = ({
  nodeId,
  element,
  isSelected,
  onSelect,
  onChange,
}: EditableTextProps) => {
  const shapeRef = useRef<Konva.Text>(null);

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) {
      return;
    }

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const nextWidth = Math.max(80, element.width * scaleX);
    const nextFontSize = Math.max(8, element.fontSize * scaleY);

    node.scaleX(1);
    node.scaleY(1);

    onChange({
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: nextWidth,
      fontSize: nextFontSize,
      rotation: node.rotation(),
    });
  };

  const handleDragEnd = () => {
    const node = shapeRef.current;
    if (!node) {
      return;
    }
    onChange({
      x: node.x(),
      y: node.y(),
    });
  };

  return (
    <KonvaText
      id={nodeId}
      ref={shapeRef}
      x={element.x}
      y={element.y}
      width={element.width}
      text={element.content}
      fontFamily={element.fontFamily}
      fontSize={element.fontSize}
      fill={element.color}
      align={element.align}
      draggable
      rotation={element.rotation}
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      listening
      stroke={isSelected ? "#2563eb" : undefined}
      strokeWidth={isSelected ? 0.5 : 0}
    />
  );
};
