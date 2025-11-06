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
  const overlayHiddenTargets = [
    ...stage.find(".template-image"),
    ...stage.find(".template-sticker"),
  ];
  const originalVisibility = overlayHiddenTargets.map((node) => ({
    node,
    visible: node.visible(),
    opacity: node.opacity(),
  }));

  const originalBaseFills = frameBaseNodes.map((node) => node.getAttr("fill"));

  try {
    slotNodes.forEach((node) => {
      node.setAttr("fill", "rgba(0,0,0,0)");
    });
    frameBaseNodes.forEach((node) => {
      node.setAttr("fill", "rgba(0,0,0,0)");
    });
    overlayHiddenTargets.forEach((node) => {
      node.visible(false);
    });
    stage.draw();

    return stage.toDataURL({ pixelRatio, mimeType });
  } finally {
    slotNodes.forEach((node, index) => {
      node.setAttr("fill", originalFills[index]);
    });
    frameBaseNodes.forEach((node, index) => {
      node.setAttr("fill", originalBaseFills[index]);
    });
    originalVisibility.forEach(({ node, visible, opacity }) => {
      node.visible(visible);
      node.opacity(opacity);
    });
    stage.draw();
  }
};
