import type Konva from "konva";

interface ExportOptions {
  pixelRatio?: number;
  mimeType?: string;
}

export const exportStageWithTransparentSlots = (
  stage: Konva.Stage,
  { pixelRatio = 2, mimeType = "image/png" }: ExportOptions = {},
) => {
  const slotNodes = stage.find(".slot-background");
  const originalFills = slotNodes.map((node) => node.getAttr("fill"));

  const frameBaseNodes = stage.find(".frame-base");
  const overlayBackgroundNodes = stage.find(".overlay-background");
  const templateImages = stage.find(".template-image");
  const templateStickers = stage.find(".template-sticker");
  const frameBottomText = stage.find(".frame-bottom-text");
  const editableText = stage.find(".editable-text");

  // Log what we're preserving vs hiding
  console.log("Overlay export - preserving styling, hiding only photos");

  // Only hide template images (photos), but keep stickers and text for styling
  const overlayHiddenTargets = [
    ...templateImages, // Hide photos but keep styling elements
    ...overlayBackgroundNodes, // Hide existing overlay when generating new one
  ];
  const originalVisibility = overlayHiddenTargets.map((node) => ({
    node,
    visible: node.visible(),
    opacity: node.opacity(),
  }));

  // Don't change frame base fills - keep the background color as part of styling

  try {
    // Only make slot backgrounds transparent, keep everything else
    slotNodes.forEach((node) => {
      node.setAttr("fill", "rgba(0,0,0,0)");
    });

    // Hide only template images (photos), keep all other styling
    overlayHiddenTargets.forEach((node) => {
      node.visible(false);
    });

    stage.draw();

    return stage.toDataURL({ pixelRatio, mimeType });
  } finally {
    // Restore original slot fills
    slotNodes.forEach((node, index) => {
      node.setAttr("fill", originalFills[index]);
    });

    // Restore hidden elements visibility
    originalVisibility.forEach(({ node, visible, opacity }) => {
      node.visible(visible);
      node.opacity(opacity);
    });

    stage.draw();
  }
};
