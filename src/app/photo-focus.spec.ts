import { describe, it, expect } from 'vitest';
import { productToForm, emptyProductModel } from './admin-forms';
import { focusPoint, focusValue } from './photo-focus';
import { fittedPhoto } from './photo-frame';
import { catalogPresentation as catalogPhotoFrame } from './product-presentation';

describe('photo focus contract', () => {
  it('preserves existing positions and defaults missing focus to center', () => {
    expect(focusPoint('25% 75%')).toEqual([25, 75]);
    expect(focusPoint('')).toEqual([50, 50]);
    expect(focusValue(-20, 110)).toBe('0% 100%');
  });
  it('opens legacy photos without focus at center while preserving explicit positions', () => {
    const row = {
      ...emptyProductModel(),
      price: null,
      price_unit: null,
      fillings: [],
      photos: [
        { static: 'photos/01_hero_medovik.jpg', desktop: '', mobile: '' },
        { static: 'photos/archive_025_medovik.jpg', desktop: '25% 75%', mobile: '55.5% 40%' },
      ],
    };
    const model = productToForm(row);
    expect(model.photos[0]).toMatchObject({ desktop: '50% 50%', mobile: '50% 50%' });
    expect(model.photos[1]).toEqual(row.photos[1]);
    expect(row.photos[0].desktop).toBe('');
  });
  it('keeps the chosen point inside a cover crop, including edges, for portrait and landscape photos', () => {
    for (const [width, height] of [
      [1600, 900],
      [900, 1600],
    ]) {
      for (const [x, y] of [
        [0, 0],
        [25, 75],
        [50, 50],
        [100, 100],
      ]) {
        for (const cardWidth of [160, 290]) {
          const box = {
            left: 0,
            top: 0,
            width: cardWidth,
            height: (cardWidth * 5) / 4,
          };
          const painted = fittedPhoto(box, width, height, 'cover', focusValue(x, y));
          // CSS aligns the selected bitmap fraction to the same fraction of the card.
          expect(painted.left + (painted.width * x) / 100).toBeCloseTo((box.width * x) / 100);
          expect(painted.top + (painted.height * y) / 100).toBeCloseTo((box.height * y) / 100);
        }
      }
    }
  });
  it('shares the unchanged catalog exceptions with the preview', () => {
    expect(catalogPhotoFrame({ slug: 'kuraga-oreh', photos: [] })).toMatchObject({
      fit: 'contain',
      ratio: 1078 / 632,
    });
    expect(
      catalogPhotoFrame({
        slug: 'slivochno-karamelny',
        photos: ['photos/archive_085_slivochno-karamelny.jpg'],
      }),
    ).toMatchObject({
      fit: 'contain',
      ratio: 1,
      photo: 'photos/archive_085_slivochno-karamelny.jpg',
    });
    expect(catalogPhotoFrame({ slug: 'medovik', photos: [] })).toBeUndefined();
  });
});
