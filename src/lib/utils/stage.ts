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

  const overlayBackgroundNodes = stage.find(".overlay-background");
  const overlayHiddenTargets = overlayBackgroundNodes;
  const originalVisibility = overlayHiddenTargets.map((node) => ({
    node,
    visible: node.visible(),
    opacity: node.opacity(),
  }));

  try {
    slotNodes.forEach((node) => {
      node.setAttr("fill", "rgba(0,0,0,0)");
    });

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
