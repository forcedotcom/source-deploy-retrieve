/*
 * Copyright 2026, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Logger } from '@salesforce/core/logger';
import { isString } from '@salesforce/ts-types';

/**
 * This is an extension of the Map class that can match keys whether they are encoded or decoded.
 * Decoding the key can solve some edge cases in component fullNames such as Layouts and Profiles.
 * See: https://github.com/forcedotcom/cli/issues/1683
 *
 * Examples:
 *
 * Given a map with entries:
 * ```javascript
 * 'layout#Layout__Broker__c-v1.1 Broker Layout' : {...}
 * 'layout#Layout__Broker__c-v9%2E2 Broker Layout' : {...}
 * ```
 *
 * `decodeableMap.has('layout#Layout__Broker__c-v1%2E1 Broker Layout')` --> returns `true`
 * `decodeableMap.has('layout#Layout__Broker__c-v9.2 Broker Layout')` --> returns `true`
 *
 * DO NOT PASS VALUES to the Constructor.  Instantiate the class and use the methods.
 */
export class DecodeableMap<K extends string, V> extends Map<string, V> {
  // Internal map of decoded keys to encoded keys.
  // E.g., { 'foo-v1.3 Layout': 'foo-v1%2E3 Layout' }
  // This is initialized in the `keysMap` getter due to the constructor calling
  // `super` before the initialization happens, and it needs to be initialized
  // before `this.set()` is called or `TypeErrors` will be thrown.
  private internalkeysMap!: Map<string, string>;

  private internalLogger!: Logger;

  private get keysMap(): Map<string, string> {
    if (!this.internalkeysMap) {
      this.internalkeysMap = new Map();
    }
    return this.internalkeysMap;
  }

  private get logger(): Logger {
    if (!this.internalLogger) {
      this.internalLogger = Logger.childFromRoot(this.constructor.name);
    }
    return this.internalLogger;
  }

  /**
   * boolean indicating whether an element with the specified key (matching decoded) exists or not.
   */
  public has(key: K): boolean {
    return !!this.getExistingKey(key);
  }

  /**
   * Returns a specified element from the Map object. If the value that is associated to
   * the provided key (matching decoded) is an object, then you will get a reference to
   * that object and any change made to that object will effectively modify it inside the Map.
   */
  public get(key: K): V | undefined {
    const existingKey = this.getExistingKey(key);
    return existingKey ? super.get(existingKey) : undefined;
  }

  /**
   * Adds a new element with a specified key and value to the Map. If an element with the
   * same key (encoded or decoded) already exists, the element will be updated.
   */
  public set(key: K, value: V): this {
    return super.set(this.getExistingKey(key, true) ?? key, value);
  }

  /**
   * true if an element in the Map existed (matching encoded or decoded key) and has been
   * removed, or false if the element does not exist.
   */
  public delete(key: K): boolean {
    const existingKey = this.getExistingKey(key);
    return existingKey ? super.delete(existingKey) : false;
  }

  // Optimistically looks for an existing key. If the key is not found, detect if the
  // key is encoded. If encoded, try using the decoded key. If decoded, look for an
  // encoded entry in the internal map to use for the lookup.
  private getExistingKey(key: K, setInKeysMap = false): string | undefined {
    if (super.has(key)) {
      return key;
    } else {
      try {
        const decodedKey = decodeURIComponent(key);
        if (key !== decodedKey) {
          // The key is encoded; If this is part of a set operation,
          // set the { decodedKey : encodedKey } in the internal map.
          if (setInKeysMap) {
            this.keysMap.set(decodedKey, key);
          }
          if (super.has(decodedKey)) {
            return decodedKey;
          }
        } else {
          const encodedKey = this.keysMap.get(decodedKey);
          if (encodedKey && super.has(encodedKey)) {
            return encodedKey;
          }
        }
      } catch (e: unknown) {
        // Log the error and the key
        const errMsg = e instanceof Error ? e.message : isString(e) ? e : 'unknown';
        this.logger.debug(`Could not decode metadata key: ${key} due to: ${errMsg}`);
      }
    }
  }
}
