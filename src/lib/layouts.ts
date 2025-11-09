import { customAlphabet } from "nanoid";
import type { FrameLayout, FrameSlot } from "@/types/frame";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;

export const createDefaultVerticalLayout = (
  slotCount = 4,
): FrameLayout => {
  const padding = 32;
  const gutter = 16;
  const frameThickness = 24;
  const slotWidthRatio = 3;
  const slotHeightRatio = 4;
  const availableHeight =
    CANVAS_HEIGHT - padding * 2 - gutter * (slotCount - 1);
  const slotHeight = availableHeight / slotCount;
  const rawSlotWidth = slotHeight * (slotWidthRatio / slotHeightRatio);
  const slotWidth = Math.min(rawSlotWidth, CANVAS_WIDTH - padding * 2);
  const horizontalPadding = (CANVAS_WIDTH - slotWidth) / 2;

  const slots: FrameSlot[] = Array.from({ length: slotCount }).map(
    (_, index) => ({
      id: `slot-${index + 1}-${nanoid(5)}`,
      x: horizontalPadding,
      y: padding + index * (slotHeight + gutter),
      width: slotWidth,
      height: slotHeight,
    }),
  );

  return {
    orientation: "portrait",
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      padding,
    },
    frame: {
      color: "#111111",
      thickness: frameThickness,
      cornerRadius: 20,
      gutter,
      backgroundColor: "#ffffff",
    },
    bottomText: {
      content: "Happy Birthday!",
      color: "#111111",
      fontSize: 64,
      fontFamily: "var(--font-geist-sans)",
      letterSpacing: 4,
      offsetY: 120,
    },
    slots,
  };
};
