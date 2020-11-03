/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet } from './componentSet';
import { MetadataComponent, MetadataType } from './types';

export class ComponentCollection<T extends MetadataComponent> {
  protected map = new Map<string, ComponentSet<T>>();

  constructor(collection?: ComponentCollection<T>) {
    if (collection) {
      for (const [typeName, set] of collection.entries()) {
        this.map.set(typeName, new ComponentSet());
        for (const component of set.values()) {
          this.map.get(typeName).add(component);
        }
      }
    }
  }

  public has(component: T): boolean {
    return this.map.get(component.type.name)?.has(component);
  }

  public entries(): IterableIterator<[string, ComponentSet<T>]> {
    return this.map.entries();
  }

  public getAll(): T[] {
    const components: T[] = [];
    for (const typeSet of this.map.values()) {
      components.push(...typeSet.values());
    }
    return components;
  }

  public getByType(type: MetadataType): T[] {
    return [...this.map.get(type.name)?.values()];
  }

  get size(): number {
    let count = 0;
    for (const set of this.map.values()) {
      count += set.size;
    }
    return count;
  }
}

export class MutableComponentCollection<T extends MetadataComponent> extends ComponentCollection<
  T
> {
  public add(component: T): void {
    const { type } = component;
    if (!this.map.has(type.name)) {
      this.map.set(type.name, new ComponentSet([component]));
    } else {
      this.map.get(type.name).add(component);
    }
  }
}
