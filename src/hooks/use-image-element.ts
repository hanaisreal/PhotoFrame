import { useEffect, useState } from "react";

export const useImageElement = (src: string | null) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!src) {
      queueMicrotask(() => {
        setImage(null);
        setError(null);
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      setError(null);
    };
    img.onerror = () => {
      setError(new Error("이미지를 불러오지 못했습니다."));
      setImage(null);
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { image, error };
};
