/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '../common';
import { SourceComponent } from './sourceComponent';

export class ComponentSet {
  private map = new Map<string, SourceComponent>();

  constructor(components: Iterable<SourceComponent>) {
    for (const component of components) {
      const key = `${component.type.id}.${component.fullName}`;
      this.map.set(key, component);
    }
  }

  public get(component: MetadataComponent): SourceComponent | undefined {
    return this.map.get(this.key(component));
  }

  public has(component: MetadataComponent): boolean {
    return this.map.has(this.key(component));
  }

  public values(): Iterable<MetadataComponent> {
    return this.map.values();
  }

  private key(component: MetadataComponent): string {
    return `${component.type.id}.${component.fullName}`;
  }
}
