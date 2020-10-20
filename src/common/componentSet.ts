/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataComponent } from './types';

/**
 * A collection that contains no duplicate MetadataComponents. Components are hashed
 * by their FullName and metadata type id.
 */
export class ComponentSet<T extends MetadataComponent> {
  private map = new Map<string, T>();

  constructor(components?: Iterable<T>) {
    if (components) {
      for (const component of components) {
        this.map.set(this.key(component), component);
      }
    }
  }

  public add(component: T): void {
    this.map.set(this.key(component), component);
  }

  public get(component: MetadataComponent): T | undefined {
    return this.map.get(this.key(component));
  }

  public has(component: MetadataComponent): boolean {
    return this.map.has(this.key(component));
  }

  public values(): IterableIterator<T> {
    return this.map.values();
  }

  private key(component: MetadataComponent): string {
    return `${component.type.id}.${component.fullName}`;
  }
}
