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
  onContextMenu?: (e: any) => void;
  onTransform?: (node: Konva.Text, commit: boolean) => void;
  onTransformStart?: (node: Konva.Text) => void;
}

export const EditableText = ({
  nodeId,
  element,
  isSelected,
  onSelect,
  onChange,
  onContextMenu,
  onTransform,
  onTransformStart,
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

  const handleTransform = (commit: boolean) => {
    if (!onTransform) {
      return;
    }
    const node = shapeRef.current;
    if (!node) {
      return;
    }
    onTransform(node, commit);
  };

  const handleTransformStart = () => {
    if (!onTransformStart) {
      return;
    }
    const node = shapeRef.current;
    if (!node) {
      return;
    }
    onTransformStart(node);
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
        draggable={!(element.isLocked ?? false)}
        rotation={element.rotation}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={handleDragEnd}
        onContextMenu={(e) => {
          e.evt.preventDefault();
          e.evt.stopPropagation();
          if (!isSelected) {
            onSelect();
          }
          if (onContextMenu) {
            onContextMenu(e);
          }
        }}
        listening
        stroke={isSelected ? "#2563eb" : (element.isLocked ? "#ef4444" : undefined)}
        strokeWidth={isSelected || element.isLocked ? 1 : 0}
        visible={element.isVisible ?? true}
        name="editable-text"
        onTransformStart={handleTransformStart}
        onTransform={() => handleTransform(false)}
        onTransformEnd={() => handleTransform(true)}
    />
    </>
  );
};
