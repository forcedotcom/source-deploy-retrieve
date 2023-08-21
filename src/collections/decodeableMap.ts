/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This is an extension of the Map class that treats keys as the same by matching first normally,
 * then decoded. Decoding the key before comparing can solve some edge cases in component fullNames
 * such as Layouts. See: https://github.com/forcedotcom/cli/issues/1683
 *
 * Examples:
 *
 * Given a map with entries:
 * ```javascript
 * 'layout#Layout__Broker__c-v1%2E1 Broker Layout' : {...}
 * 'layout#Layout__Broker__c-v9.2 Broker Layout' : {...}
 * ```
 *
 * `decodeableMap.has('layout#Layout__Broker__c-v1.1 Broker Layout')` --> returns `true`
 * `decodeableMap.has('layout#Layout__Broker__c-v9%2E2 Broker Layout')` --> returns `true`
 */
export class DecodeableMap<K extends string, V> extends Map<string, V> {
  /**
   * boolean indicating whether an element with the specified key (matching decoded) exists or not.
   */
  public has(key: K): boolean {
    return super.has(key) || this.hasDecoded(key);
  }

  /**
   * Returns a specified element from the Map object. If the value that is associated to
   * the provided key (matching decoded) is an object, then you will get a reference to
   * that object and any change made to that object will effectively modify it inside the Map.
   */
  public get(key: K): V | undefined {
    return super.get(key) ?? this.getDecoded(key);
  }

  /**
   * Adds a new element with a specified key and value to the Map. If an element with the
   * same key (matching decoded) already exists, the element will be updated.
   */
  public set(key: K, value: V): this {
    const sKey = this.getExistingKey(key) ?? key;
    return super.set(sKey, value);
  }

  /**
   * true if an element in the Map existed (matching decoded) and has been removed, or false
   * if the element does not exist.
   */
  public delete(key: K): boolean {
    const sKey = this.getExistingKey(key) ?? key;
    return super.delete(sKey);
  }

  // Returns true if the passed `key` matches an existing key entry when both keys are decoded.
  private hasDecoded(key: string): boolean {
    return !!this.getExistingKey(key);
  }

  // Returns the value of an entry matching on decoded keys.
  private getDecoded(key: string): V | undefined {
    const existingKey = this.getExistingKey(key);
    return existingKey ? super.get(existingKey) : undefined;
  }

  // Returns the key as it is in the map, matching on decoded keys.
  private getExistingKey(key: string): string | undefined {
    for (const compKey of this.keys()) {
      if (decodeURIComponent(compKey) === decodeURIComponent(key)) {
        return compKey;
      }
    }
  }
}
