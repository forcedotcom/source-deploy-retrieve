/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Normalize an object to be an array if it isn't one.
 *
 * @param entryOrArray - An object that could be an array of it's type or just its type
 * @returns An array of the input element
 */
export function normalizeToArray<T>(entryOrArray: T | T[] | undefined): T[] {
  if (entryOrArray) {
    return Array.isArray(entryOrArray) ? entryOrArray : [entryOrArray];
  }
  return [];
}

/**
 * Deeply freezes an object, making the entire thing immutable.
 *
 * @param object - Object to deep freeze
 * @returns A deeply frozen version of the object
 */
export function deepFreeze<T>(object: T): Readonly<T> {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const val = object[name];
    if (val && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return Object.freeze(object);
}
