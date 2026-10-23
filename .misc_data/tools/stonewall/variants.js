// The two wall sizes: Small Oriental Wall 1404004850 and Large Oriental Wall 1404004851 (3x as tall).
// Shared: thickness 2*TH, free ends at E with the top set back by CH, the ground decals (in the small wall's maps).
module.exports = {
  TH: 0.05, E: 0.45, CH: 0.07,
  GROUND_REL: 'data/graphics/buildings/orient/stonewall',
  small: { prefix: 'stonewall', dir: 'stonewall', H: 0.24, layout: 'layout.json' },
  large: { prefix: 'stonewall_large', dir: 'stonewall_large', H: 0.72, layout: 'layout_large.json' },
};
