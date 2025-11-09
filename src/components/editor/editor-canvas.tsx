"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

import { EditableImage } from "@/components/editor/editable-image";
import { EditableText } from "@/components/editor/editable-text";
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
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const updateImage = useEditorStore((state) => state.updateImage);
  const updateSticker = useEditorStore((state) => state.updateSticker);
  const updateTextElement = useEditorStore((state) => state.updateText);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(MAX_CANVAS_SCALE);

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
    >
      <Stage
        width={layout.canvas.width}
        height={layout.canvas.height}
        scaleX={scale}
        scaleY={scale}
        x={stageOffsetX}
        y={stageOffsetY}
        ref={stageRef}
        onMouseDown={handleStageDeselection}
        onTouchStart={handleStageDeselection}
      >
        <Layer>
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
                {renderSlotImages(slot.id)}
              </Group>
            ))}
            {renderFloatingImages()}
            {renderStickers()}
            {renderTexts()}
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
              />
            ) : null}
            <Transformer
              ref={transformerRef}
              rotateEnabled
              enabledAnchors={[
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right",
              ]}
              anchorCornerRadius={4}
            />
        </Layer>
      </Stage>
    </div>
  );
};
