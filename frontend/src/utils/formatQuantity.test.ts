import { describe, expect, it } from 'vitest';

import { formatQuantity } from './formatQuantity';

describe('formatQuantity', () => {
  it.each([
    ['1.00', 'tank', '1 tank'],
    ['1.50', 'tonnes', '1.5 tonnes'],
    ['6.00', 'goats', '6 goats'],
    ['60.00', 'sheets', '60 sheets']
  ])('formats %s %s as %s', (quantity, unit, expected) => {
    expect(formatQuantity(quantity, unit)).toBe(expected);
  });

  it('uses the provided fallback when quantity is missing', () => {
    expect(formatQuantity(undefined, 'tank', 'Quantity not recorded')).toBe('Quantity not recorded');
  });
});
