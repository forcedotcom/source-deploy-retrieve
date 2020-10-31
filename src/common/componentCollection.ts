/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ComponentSet, MetadataComponent, MetadataType } from '.';

export class ComponentCollection<T extends MetadataComponent> {
  private map = new Map<string, ComponentSet<T>>();

  constructor(components?: Iterable<T>) {
    if (components) {
      for (const component of components) {
        this.add(component);
      }
    }
  }

  public add(component: T): void {
    const { type } = component;
    if (!this.map.has(type.name)) {
      this.map.set(type.name, new ComponentSet([component]));
    } else {
      this.map.get(type.name).add(component);
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
}
