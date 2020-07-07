/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  MetadataComponent,
  MetadataType,
  SourcePath,
  TreeContainer,
  MetadataRegistry,
  SourceComponent
} from '../types';
import { join, dirname } from 'path';
import { ForceIgnore } from './forceIgnore';
import { parseMetadataXml } from '../utils/registry';
import { baseName } from '../utils';

export class DefaultSourceComponent implements SourceComponent {
  public readonly name: string;
  public readonly type: MetadataType;
  public readonly parent?: SourceComponent;

  public xml: SourcePath;
  public content?: SourcePath;

  private tree: TreeContainer;
  private registry: MetadataRegistry;
  private forceIgnore: ForceIgnore;

  constructor(
    tree: TreeContainer,
    registry: MetadataRegistry,
    forceIgnore: ForceIgnore,
    component: MetadataComponent,
    parent?: SourceComponent
  ) {
    // can this use expansion?
    this.tree = tree;
    this.registry = registry;
    this.forceIgnore = forceIgnore;
    this.name = component.fullName;
    this.type = component.type;
    this.parent = parent;
  }

  public *walkContent(): IterableIterator<SourcePath> {
    for (const fsPath of this.walk(this.content)) {
      if (fsPath !== this.xml) {
        yield* fsPath;
      }
    }
  }

  public *getChildren(): IterableIterator<DefaultSourceComponent> {
    const parentPath = dirname(this.xml);
    yield* this.getChildrenInternal(parentPath);
  }

  private *getChildrenInternal(dirPath: SourcePath): IterableIterator<DefaultSourceComponent> {
    for (const fsPath of this.walk(dirPath)) {
      if (this.forceIgnore.denies(fsPath)) {
        continue;
      } else if (this.tree.isDirectory(fsPath)) {
        yield* this.getChildrenInternal(fsPath);
      } else {
        const childXml = parseMetadataXml(fsPath);
        const fileIsRootXml = childXml.suffix === this.type.suffix;
        if (childXml && !fileIsRootXml) {
          // TODO: Log warning if missing child type definition
          const childTypeId = this.type.children.suffixes[childXml.suffix];
          const childComponent = new DefaultSourceComponent(
            this.tree,
            this.registry,
            this.forceIgnore,
            {
              fullName: baseName(fsPath),
              type: this.type.children.types[childTypeId]
            },
            this
          );
          childComponent.xml = fsPath;
          yield childComponent;
        }
      }
    }
  }

  private *walk(fsPath: SourcePath): IterableIterator<SourcePath> {
    if (!this.tree.isDirectory(fsPath)) {
      yield fsPath;
    } else {
      for (const child of this.tree.readDirectory(fsPath)) {
        const childPath = join(fsPath, child);
        if (this.tree.isDirectory(childPath)) {
          yield* this.walk(childPath);
        } else {
          yield childPath;
        }
      }
    }
  }

  get fullName(): string {
    return `${this.parent ? `${this.parent.fullName}.` : ''}${this.name}`;
  }
}
