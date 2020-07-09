/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { MetadataType, SourcePath, TreeContainer, SourceComponent } from '../types';
import { join, dirname } from 'path';
import { ForceIgnore } from './forceIgnore';
import { parseMetadataXml } from '../utils/registry';
import { baseName } from '../utils';
import { NodeFSTreeContainer } from './treeContainers';

type ComponentProperties = {
  name: string;
  type: MetadataType;
  xml: SourcePath;
  content?: SourcePath;
  parent?: SourceComponent;
};

export class StandardSourceComponent implements SourceComponent {
  public readonly name: string;
  public readonly type: MetadataType;
  public readonly xml: SourcePath;
  public readonly content?: SourcePath;
  public readonly parent?: SourceComponent;
  private tree: TreeContainer;
  private forceIgnore: ForceIgnore;

  constructor(
    props: ComponentProperties,
    tree: TreeContainer = new NodeFSTreeContainer(),
    forceIgnore = new ForceIgnore()
  ) {
    this.name = props.name;
    this.type = props.type;
    this.xml = props.xml;
    this.parent = props.parent;
    this.content = props.content;
    this.tree = tree;
    this.forceIgnore = forceIgnore;
  }

  public walkContent(): SourcePath[] {
    const sources: SourcePath[] = [];
    if (this.content) {
      for (const fsPath of this.walk(this.content)) {
        if (fsPath !== this.xml) {
          sources.push(fsPath);
        }
      }
    }
    return sources;
  }

  public getChildren(): SourceComponent[] {
    const parentPath = dirname(this.xml);
    return this.getChildrenInternal(parentPath);
  }

  private getChildrenInternal(dirPath: SourcePath): SourceComponent[] {
    const children: SourceComponent[] = [];
    for (const fsPath of this.walk(dirPath)) {
      if (this.forceIgnore.denies(fsPath)) {
        continue;
      } else if (this.tree.isDirectory(fsPath)) {
        children.push(...this.getChildrenInternal(fsPath));
      } else {
        const childXml = parseMetadataXml(fsPath);
        const fileIsRootXml = childXml.suffix === this.type.suffix;
        if (childXml && !fileIsRootXml) {
          // TODO: Log warning if missing child type definition
          const childTypeId = this.type.children.suffixes[childXml.suffix];
          const childComponent = new StandardSourceComponent(
            {
              name: baseName(fsPath),
              type: this.type.children.types[childTypeId],
              xml: fsPath,
              parent: this
            },
            this.tree,
            this.forceIgnore
          );
          children.push(childComponent);
        }
      }
    }
    return children;
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
    return `${this.parent ? `${this.parent.fullName}.` : ''}${this.fullName}`;
  }
}
