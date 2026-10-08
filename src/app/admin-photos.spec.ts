import { describe, expect, it } from 'vitest';
import { ProductPhoto } from './data';
import { primaryPhotoIndex } from './admin-photos';
const photo = (path: string, focus = '50% 50%'): ProductPhoto => ({
  path,
  desktop: focus,
  mobile: focus,
});
describe('cover identity after photo removal', () => {
  const photos = [photo('A'), photo('B'), photo('C')];
  it('keeps B when A is removed, including serialized copies of the remaining files', () => {
    expect(primaryPhotoIndex(structuredClone(photos.slice(1)), photos[1])).toBe(0);
  });
  it('keeps B when C is removed', () => {
    expect(primaryPhotoIndex(photos.slice(0, 2), photos[1])).toBe(1);
  });
  it('falls back to the first photo when the cover is removed, or index zero when none remain', () => {
    expect(primaryPhotoIndex([photos[0], photos[2]], photos[1])).toBe(0);
    expect(primaryPhotoIndex([], photos[0])).toBe(0);
    expect(primaryPhotoIndex([], undefined)).toBe(0);
  });
  it('keeps static photo identity independently of focus changes', () => {
    const original = { static: 'photos/cover.jpg', desktop: '50% 50%', mobile: '50% 50%' };
    expect(primaryPhotoIndex([{ ...original, desktop: '25% 75%' }], original)).toBe(0);
  });
});
