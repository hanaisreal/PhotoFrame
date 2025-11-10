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
    <>
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
      listening
      stroke={isSelected ? "#2563eb" : undefined}
      strokeWidth={isSelected ? 0.5 : 0}
      name="editable-text"
    />
    </>
  );
};
