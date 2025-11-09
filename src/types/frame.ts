export type FrameOrientation = "portrait" | "landscape";

export interface FrameSlot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface FrameLayout {
  orientation: FrameOrientation;
  canvas: {
    width: number;
    height: number;
    padding: number;
  };
  frame: {
    color: string;
    thickness: number;
    cornerRadius: number;
    gutter: number;
    backgroundColor: string;
  };
  bottomText: {
    content: string;
    color: string;
    fontSize: number;
    fontFamily: string;
    letterSpacing: number;
    offsetY: number;
  };
  slots: FrameSlot[];
}

export interface ImageElement {
  id: string;
  slotId: string | null;
  dataUrl: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  width: number;
  height: number;
  clipToSlot: boolean;
  backgroundRemoved: boolean;
}

export interface StickerElement {
  id: string;
  name: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export interface TextElement {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  align: "left" | "center" | "right";
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
}

export interface FrameTemplate {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  layout: FrameLayout;
  images: ImageElement[];
  stickers: StickerElement[];
  texts: TextElement[];
  overlayDataUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplatePersistencePayload {
  slug: string;
  templateName: string;
  templateDescription?: string;
  layout: FrameLayout;
  images: ImageElement[];
  stickers: StickerElement[];
  texts: TextElement[];
  overlayDataUrl: string;
  createdAt?: string;
  updatedAt?: string;
}
