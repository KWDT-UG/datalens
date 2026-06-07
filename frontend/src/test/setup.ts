import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const objectWithHasOwn = Object as typeof Object & {
  hasOwn?: (object: object, property: PropertyKey) => boolean;
};

if (!objectWithHasOwn.hasOwn) {
  objectWithHasOwn.hasOwn = (object, property) =>
    Object.prototype.hasOwnProperty.call(object, property);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
