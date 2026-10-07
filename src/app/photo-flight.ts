import { animate } from 'animejs';
import { PhotoBox, PhotoFrame, fittedPhoto } from './photo-frame';

/** Animate the clipping window and the bitmap separately; object-fit cannot interpolate. */
export class PhotoFlight {
  readonly element = document.createElement('div');
  readonly image = new Image();
  private animation?: ReturnType<typeof animate>;
  private frame: PhotoFrame;
  constructor(src: string, start: PhotoFrame) {
    this.frame = start;
    this.element.className = 'photo-flight';
    this.element.setAttribute('aria-hidden', 'true');
    Object.assign(this.element.style, {
      position: 'fixed',
      zIndex: '100',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    this.image.src = src;
    this.image.alt = '';
    Object.assign(this.image.style, {
      position: 'absolute',
      maxWidth: 'none',
      objectFit: 'fill',
    });
    this.element.append(this.image);
    this.draw(start);
    document.body.append(this.element);
  }
  private draw(frame: PhotoFrame) {
    this.frame = frame;
    const { clip, photo } = frame;
    Object.assign(this.element.style, {
      left: `${clip.left}px`,
      top: `${clip.top}px`,
      width: `${clip.width}px`,
      height: `${clip.height}px`,
      borderRadius: `${frame.radius}px`,
    });
    Object.assign(this.image.style, {
      left: `${photo.left - clip.left}px`,
      top: `${photo.top - clip.top}px`,
      width: `${photo.width}px`,
      height: `${photo.height}px`,
    });
  }
  move(end: PhotoFrame, duration: number, done: () => void, destinationSrc?: string) {
    this.animation?.cancel();
    const start = this.frame;
    // A different selected gallery photo returns through a crossfade, at matching geometry.
    const next = destinationSrc && destinationSrc !== this.image.src ? new Image() : null;
    if (next) {
      next.src = destinationSrc!;
      next.alt = '';
      Object.assign(next.style, {
        position: 'absolute',
        maxWidth: 'none',
        objectFit: 'fill',
        opacity: '0',
      });
      this.element.append(next);
    }
    const outgoingEnd = next
      ? fittedPhoto(
          end.clip,
          this.image.naturalWidth || start.photo.width,
          this.image.naturalHeight || start.photo.height,
          'contain',
          '50% 50%',
        )
      : end.photo;
    const nextStart = next
      ? fittedPhoto(start.clip, end.photo.width, end.photo.height, 'contain', '50% 50%')
      : start.photo;
    const progress = { value: 0 };
    const mix = (a: number, b: number) => a + (b - a) * progress.value;
    const box = (a: PhotoBox, b: PhotoBox): PhotoBox => ({
      left: mix(a.left, b.left),
      top: mix(a.top, b.top),
      width: mix(a.width, b.width),
      height: mix(a.height, b.height),
    });
    this.animation = animate(progress, {
      value: 1,
      duration,
      ease: 'inOut(2)',
      onUpdate: () => {
        this.draw({
          clip: box(start.clip, end.clip),
          photo: box(start.photo, outgoingEnd),
          radius: mix(start.radius, end.radius),
        });
        if (next) {
          const incoming = box(nextStart, end.photo);
          const clip = this.frame.clip;
          Object.assign(next.style, {
            left: `${incoming.left - clip.left}px`,
            top: `${incoming.top - clip.top}px`,
            width: `${incoming.width}px`,
            height: `${incoming.height}px`,
          });
          next.style.opacity = `${progress.value}`;
          this.image.style.opacity = `${1 - progress.value}`;
        }
      },
      onComplete: () => {
        this.draw({ ...end, photo: outgoingEnd });
        if (next) {
          Object.assign(next.style, {
            left: `${end.photo.left - end.clip.left}px`,
            top: `${end.photo.top - end.clip.top}px`,
            width: `${end.photo.width}px`,
            height: `${end.photo.height}px`,
            opacity: '1',
          });
          this.image.style.opacity = '0';
        }
        done();
      },
    });
  }
  cancel() {
    this.animation?.cancel();
  }
  remove() {
    this.cancel();
    this.element.remove();
  }
}
