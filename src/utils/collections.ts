/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Deeply freezes an object, making the entire thing immutable.
 *
 * @param object - Object to deep freeze
 * @returns A deeply frozen version of the object
 */
export function deepFreeze<T>(object: T): Readonly<T> {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const val = object[name];
    if (val && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return Object.freeze(object);
}
