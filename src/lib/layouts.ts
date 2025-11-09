import { customAlphabet } from "nanoid";
import type { FrameLayout, FrameSlot } from "@/types/frame";

const nanoid = customAlphabet("1234567890abcdefghijklmnopqrstuvwxyz", 10);

const REAL_STRIP_WIDTH_MM = 54;
const REAL_STRIP_HEIGHT_MM = 150;
const MM_TO_PX_SCALE = 10;

const CANVAS_WIDTH = REAL_STRIP_WIDTH_MM * MM_TO_PX_SCALE; // 540px
const CANVAS_HEIGHT = REAL_STRIP_HEIGHT_MM * MM_TO_PX_SCALE; // 1500px

export const createDefaultVerticalLayout = (
  slotCount = 4,
): FrameLayout => {
  const padding = 18;
  const frameThickness = 12;

  const sideFrameMargin = 20;
  const slotWidth = Math.max(
    CANVAS_WIDTH - padding * 2 - sideFrameMargin,
    CANVAS_WIDTH * 0.6,
  );
  const slotX = (CANVAS_WIDTH - slotWidth) / 2;

  const slotGap = 40;
  const desiredSlotHeight = 280;
  const maxSlotHeight =
    (CANVAS_HEIGHT - slotGap * (slotCount - 1)) / slotCount;
  const slotHeight = Math.min(desiredSlotHeight, maxSlotHeight);
  const totalSlotsHeight = slotHeight * slotCount + slotGap * (slotCount - 1);
  const topOffset = Math.max((CANVAS_HEIGHT - totalSlotsHeight) / 2, padding);
  const gutter = slotGap;

  const slots: FrameSlot[] = Array.from({ length: slotCount }).map(
    (_, index) => ({
      id: `slot-${index + 1}-${nanoid(5)}`,
      x: slotX,
      y: topOffset + index * (slotHeight + slotGap),
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
      cornerRadius: 0,
      gutter,
      backgroundColor: "#000000",
    },
    bottomText: {
      content: "Happy Birthday!",
      color: "#111111",
      fontSize: 64,
      fontFamily: "var(--font-geist-sans)",
      letterSpacing: 4,
      offsetY: 90,
    },
    slots,
  };
};
