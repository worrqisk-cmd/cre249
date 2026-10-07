export interface PhotoBox {
  left: number;
  top: number;
  width: number;
  height: number;
}
export interface PhotoFrame {
  clip: PhotoBox;
  photo: PhotoBox;
  radius: number;
}

/** Painted bitmap coordinates, including the crop caused by cover/object-position. */
export function fittedPhoto(
  box: PhotoBox,
  width: number,
  height: number,
  fit: string,
  position: string,
): PhotoBox {
  const scale = (fit === "cover" ? Math.max : Math.min)(
    box.width / width,
    box.height / height,
  );
  const w = width * scale,
    h = height * scale;
  const [x = "50%", y = "50%"] = position.split(" ");
  return {
    left: box.left + ((box.width - w) * parseFloat(x)) / 100,
    top: box.top + ((box.height - h) * parseFloat(y)) / 100,
    width: w,
    height: h,
  };
}

export function photoFrame(
  image: HTMLImageElement,
  resting = false,
): PhotoFrame {
  const style = getComputedStyle(image);
  const container =
    image.closest(".product-image, .dialog-image-link") || image;
  const visible = image.getBoundingClientRect();
  // Hover zoom uses a centered transform. Return to the resting card, then let hover resume.
  const width = resting ? parseFloat(style.width) : visible.width;
  const height = resting ? parseFloat(style.height) : visible.height;
  const rect = {
    left: visible.left + (visible.width - width) / 2,
    top: visible.top + (visible.height - height) / 2,
    width,
    height,
  };
  const clip = container.getBoundingClientRect();
  return {
    clip: {
      left: clip.left,
      top: clip.top,
      width: clip.width,
      height: clip.height,
    },
    photo: fittedPhoto(
      rect,
      image.naturalWidth || rect.width,
      image.naturalHeight || rect.height,
      style.objectFit,
      style.objectPosition,
    ),
    radius: parseFloat(getComputedStyle(container).borderTopLeftRadius) || 0,
  };
}
