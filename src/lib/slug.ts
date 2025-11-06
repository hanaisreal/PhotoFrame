import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

export const createTemplateSlug = () => `frame-${nanoid()}`;
