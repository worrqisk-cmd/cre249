import { describe, expect, it } from 'vitest';
import { fittedPhoto } from './photo-frame';
describe('photo geometry between a clipped card and a complete photo', () => {
  it('accounts for horizontal cover and object-position instead of shrinking the whole photo', () => {
    const frame = fittedPhoto(
      { left: 0, top: 0, width: 172, height: 215 },
      1078,
      632,
      'cover',
      '50% 50%',
    );
    expect(frame.left).toBeCloseTo((172 - (215 * 1078) / 632) / 2, 8);
    expect(frame.width).toBeCloseTo((215 * 1078) / 632, 8);
    expect(frame.top).toBe(0);
    expect(frame.height).toBe(215);
  });
  it('keeps the whole portrait photo and honors its focus', () => {
    expect(
      fittedPhoto({ left: 10, top: 20, width: 390, height: 520 }, 960, 1280, 'contain', '50% 50%'),
    ).toEqual({ left: 10, top: 20, width: 390, height: 520 });
    expect(
      fittedPhoto({ left: 0, top: 0, width: 200, height: 200 }, 100, 200, 'contain', '100% 0%'),
    ).toEqual({ left: 100, top: 0, width: 100, height: 200 });
  });
});
