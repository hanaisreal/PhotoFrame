import { customAlphabet } from "nanoid";
import { create } from "zustand";

import { createDefaultVerticalLayout } from "@/lib/layouts";
import type {
  FrameLayout,
  ImageElement,
  StickerElement,
} from "@/types/frame";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export type EditorElementKind = "image" | "sticker" | "slot" | null;

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
  setBottomText: (bottomText: Partial<FrameLayout["bottomText"]>) => void;
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
  addSticker: (input: Omit<StickerElement, "id"> & { id?: string }) => string;
  updateSticker: (
    id: string,
    input: Partial<Omit<StickerElement, "id">>,
  ) => void;
  removeSticker: (id: string) => void;
  setOverlayDataUrl: (dataUrl: string | undefined) => void;
  reset: () => void;
  loadTemplate: (params: {
    templateName: string;
    templateDescription?: string;
    layout: FrameLayout;
    images: ImageElement[];
    stickers: StickerElement[];
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
    setBottomText: (bottomText) =>
      set((state) => ({
        layout: {
          ...state.layout,
          bottomText: { ...state.layout.bottomText, ...bottomText },
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
      set({
        layout: nextLayout,
        slotCount: count,
        images: currentImages,
        stickers: currentStickers,
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
    setOverlayDataUrl: (overlayDataUrl) =>
      set({ overlayDataUrl, isDirty: true }),
    reset: () => set(initialState),
    loadTemplate: ({
      templateName,
      templateDescription,
      layout,
      images,
      stickers,
      overlayDataUrl,
    }) =>
      set({
        templateName,
        templateDescription: templateDescription ?? "",
        layout,
        images,
        stickers,
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
