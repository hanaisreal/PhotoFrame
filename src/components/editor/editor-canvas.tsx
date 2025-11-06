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
} from "react-konva";

import { EditableImage } from "@/components/editor/editable-image";
import { useEditorStore } from "@/state/editor-store";
import type { ImageElement, StickerElement } from "@/types/frame";

interface EditorCanvasProps {
  stageRef: React.RefObject<Konva.Stage>;
}

const SLOT_BACKGROUND = "#f5f5f5";

export const EditorCanvas = ({ stageRef }: EditorCanvasProps) => {
  const layout = useEditorStore((state) => state.layout);
  const images = useEditorStore((state) => state.images);
  const stickers = useEditorStore((state) => state.stickers);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const updateImage = useEditorStore((state) => state.updateImage);
  const updateSticker = useEditorStore((state) => state.updateSticker);

  const containerRef = useRef<HTMLDivElement>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [scale, setScale] = useState(0.25);

  useEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      const width = container.offsetWidth;
      const height = container.offsetHeight;

      const scaleByWidth = width / layout.canvas.width;
      const scaleByHeight = height / layout.canvas.height;
      const nextScale = Math.min(scaleByWidth, scaleByHeight, 0.8);
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

  const handleStageDeselection = (event: Konva.KonvaEventObject<MouseEvent>) => {
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

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full rounded-3xl bg-slate-100 p-4"
    >
      <div className="rounded-3xl border border-slate-300/70 bg-white shadow-inner">
        <Stage
          width={layout.canvas.width}
          height={layout.canvas.height}
          scaleX={scale}
          scaleY={scale}
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
                  stroke={layout.frame.color}
                  strokeWidth={layout.frame.thickness / 3}
                  listening={false}
                />
                {renderSlotImages(slot.id)}
              </Group>
            ))}
            {renderFloatingImages()}
            {renderStickers()}
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
    </div>
  );
};
