import { customAlphabet } from "nanoid";
import { create } from "zustand";

import { createDefaultVerticalLayout } from "@/lib/layouts";
import type {
  FrameLayout,
  ImageElement,
  StickerElement,
  TextElement,
} from "@/types/frame";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export type EditorElementKind = "image" | "sticker" | "text" | "slot" | null;

export interface SelectionState {
  id: string | null;
  kind: EditorElementKind;
}

interface EditorState {
  templateName: string;
  templateDescription: string;
  layout: FrameLayout;
  images: ImageElement[];
  stickers: StickerElement[];
  texts: TextElement[];
  overlayDataUrl?: string;
  selection: SelectionState;
  slotCount: number;
  isDirty: boolean;
}

interface EditorActions {
  setTemplateName: (name: string) => void;
  setTemplateDescription: (description: string) => void;
  setLayout: (layout: FrameLayout) => void;
  setFrameOptions: (
    frame: Partial<FrameLayout["frame"]>,
  ) => void;
  setSlotCount: (count: number) => void;
  setSelection: (selection: SelectionState) => void;
  addImage: (input: Omit<ImageElement, "id"> & { id?: string }) => string;
  updateImage: (
    id: string,
    input: Partial<Omit<ImageElement, "id" | "slotId">> & {
      slotId?: ImageElement["slotId"];
    },
  ) => void;
  removeImage: (id: string) => void;
  removeImageBackground: (id: string) => Promise<boolean>;
  addSticker: (input: Omit<StickerElement, "id"> & { id?: string }) => string;
  updateSticker: (
    id: string,
    input: Partial<Omit<StickerElement, "id">>,
  ) => void;
  removeSticker: (id: string) => void;
  addText: (input?: Partial<Omit<TextElement, "id">> & { id?: string }) => string;
  updateText: (id: string, input: Partial<TextElement>) => void;
  removeText: (id: string) => void;
  setOverlayDataUrl: (dataUrl: string | undefined) => void;
  reset: () => void;
  loadTemplate: (params: {
    templateName: string;
    templateDescription?: string;
    layout: FrameLayout;
    images: ImageElement[];
    stickers: StickerElement[];
    texts: TextElement[];
    overlayDataUrl?: string;
  }) => void;
}

const initialLayout = createDefaultVerticalLayout(4);

const initialState: EditorState = {
  templateName: "생일 축하 포토부스",
  templateDescription: "",
  layout: initialLayout,
  images: [],
  stickers: [],
  texts: [],
  overlayDataUrl: undefined,
  selection: { id: null, kind: null },
  slotCount: 4,
  isDirty: false,
};

export const useEditorStore = create<EditorState & EditorActions>(
  (set, get) => ({
    ...initialState,
    setTemplateName: (templateName) =>
      set({ templateName, isDirty: true }),
    setTemplateDescription: (templateDescription) =>
      set({ templateDescription, isDirty: true }),
    setLayout: (layout) =>
      set({
        layout,
        slotCount: layout.slots.length,
        isDirty: true,
      }),
    setFrameOptions: (frame) =>
      set((state) => ({
        layout: {
          ...state.layout,
          frame: { ...state.layout.frame, ...frame },
        },
        isDirty: true,
      })),
    setSlotCount: (count) => {
      const nextLayout = createDefaultVerticalLayout(count);
      const currentImages = get().images.filter((image) => {
        if (!image.slotId) {
          return true;
        }
        return nextLayout.slots.some((slot) => slot.id === image.slotId);
      });

      const currentStickers = get().stickers;
      const currentTexts = get().texts;
      set({
        layout: nextLayout,
        slotCount: count,
        images: currentImages,
        stickers: currentStickers,
        texts: currentTexts,
        selection: { id: null, kind: null },
        isDirty: true,
      });
    },
    setSelection: (selection) => set({ selection }),
    addImage: (input) => {
      const id = input.id ?? `img-${nanoid(8)}`;
      set((state) => ({
        images: [
          ...state.images,
          {
            ...input,
            id,
          },
        ],
        selection: { id, kind: "image" },
        isDirty: true,
      }));
      return id;
    },
    updateImage: (id, input) =>
      set((state) => ({
        images: state.images.map((image) =>
          image.id === id
            ? {
                ...image,
                ...input,
              }
            : image,
        ),
        isDirty: true,
      })),
    removeImage: (id) =>
      set((state) => ({
        images: state.images.filter((image) => image.id !== id),
        selection:
          state.selection.id === id && state.selection.kind === "image"
            ? { id: null, kind: null }
            : state.selection,
        isDirty: true,
      })),
    removeImageBackground: async (id) => {
      const state = get();
      const image = state.images.find((img) => img.id === id);
      if (!image) return false;

      try {
        // Import the client-side background removal utility
        const { removeBackgroundClient, isBackgroundRemovalSupported } = await import('@/lib/background-removal');

        // Check if background removal is supported in the current environment
        if (!isBackgroundRemovalSupported()) {
          console.error("Background removal is not supported in this browser environment");
          return false;
        }

        // Process the image client-side
        const processedImageDataUrl = await removeBackgroundClient(image.dataUrl);

        const slot = image.slotId
          ? state.layout.slots.find((item) => item.id === image.slotId) ?? null
          : null;

        const absoluteX = slot ? slot.x + image.x : image.x;
        const absoluteY = slot ? slot.y + image.y : image.y;

        set((state) => ({
          images: state.images.map((img) =>
            img.id === id
              ? {
                  ...img,
                  dataUrl: processedImageDataUrl,
                  slotId: null, // Convert to floating image for easier manipulation
                  clipToSlot: false,
                  x: absoluteX,
                  y: absoluteY,
                  backgroundRemoved: true,
                }
              : img,
          ),
          isDirty: true,
        }));

        return true;
      } catch (error) {
        console.error("Background removal error:", error);
        return false;
      }
    },
    addSticker: (input) => {
      const id = input.id ?? `st-${nanoid(8)}`;
      set((state) => ({
        stickers: [
          ...state.stickers,
          {
            ...input,
            id,
          },
        ],
        selection: { id, kind: "sticker" },
        isDirty: true,
      }));
      return id;
    },
    updateSticker: (id, input) =>
      set((state) => ({
        stickers: state.stickers.map((sticker) =>
          sticker.id === id
            ? {
                ...sticker,
                ...input,
              }
            : sticker,
        ),
        isDirty: true,
      })),
    removeSticker: (id) =>
      set((state) => ({
        stickers: state.stickers.filter((sticker) => sticker.id !== id),
        selection:
          state.selection.id === id && state.selection.kind === "sticker"
            ? { id: null, kind: null }
            : state.selection,
        isDirty: true,
      })),
    addText: (input) => {
      const id = input?.id ?? `txt-${nanoid(8)}`;
      const defaults: Omit<TextElement, "id"> = {
        content: "새 텍스트", // This will be translated in the UI components
        x: 40,
        y: 40,
        width: 400,
        align: "center",
        fontSize: 48,
        fontFamily: "var(--font-geist-sans)",
        color: "#111111",
        rotation: 0,
        isLocked: false,
        isVisible: true,
      };
      set((state) => ({
        texts: [
          ...state.texts,
          {
            ...defaults,
            ...input,
            id,
          },
        ],
        selection: { id, kind: "text" },
        isDirty: true,
      }));
      return id;
    },
    updateText: (id, input) =>
      set((state) => ({
        texts: state.texts.map((text) =>
          text.id === id
            ? {
                ...text,
                ...input,
              }
            : text,
        ),
        isDirty: true,
      })),
    removeText: (id) =>
      set((state) => ({
        texts: state.texts.filter((text) => text.id !== id),
        selection:
          state.selection.id === id && state.selection.kind === "text"
            ? { id: null, kind: null }
            : state.selection,
        isDirty: true,
      })),
    setOverlayDataUrl: (overlayDataUrl) =>
      set({ overlayDataUrl, isDirty: true }),
    reset: () => set(initialState),
    loadTemplate: ({
      templateName,
      templateDescription,
      layout,
      images,
      stickers,
      texts,
      overlayDataUrl,
    }) =>
      set({
        templateName,
        templateDescription: templateDescription ?? "",
        layout,
        images,
        stickers,
        texts,
        overlayDataUrl,
        selection: { id: null, kind: null },
        slotCount: layout.slots.length,
        isDirty: false,
      }),
  }),
);

export const selectCurrentLayout = (state: EditorState) => state.layout;
export const selectImages = (state: EditorState) => state.images;
export const selectStickers = (state: EditorState) => state.stickers;
export const selectTexts = (state: EditorState) => state.texts;
