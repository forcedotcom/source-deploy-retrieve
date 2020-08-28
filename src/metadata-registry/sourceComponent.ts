/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TreeContainer, VirtualDirectory } from './types';
import { join, dirname, sep, basename } from 'path';
import { ForceIgnore } from './forceIgnore';
import { parseMetadataXml } from '../utils/registry';
import { baseName } from '../utils';
import { NodeFSTreeContainer, VirtualTreeContainer } from './treeContainers';
import { MetadataType, SourcePath, MetadataComponent } from '../common';

export type ComponentProperties = {
  name: string;
  type: MetadataType;
  xml?: SourcePath;
  content?: SourcePath;
  parent?: SourceComponent;
};

/**
 * Representation of a MetadataComponent in a file tree.
 */
export class SourceComponent implements MetadataComponent {
  public readonly name: string;
  public readonly type: MetadataType;
  public readonly xml?: SourcePath;
  public readonly parent?: SourceComponent;
  public content?: SourcePath;
  private _tree: TreeContainer;
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
    this._tree = tree;
    this.forceIgnore = forceIgnore;
  }

  public static createVirtualComponent(
    props: ComponentProperties,
    fs: VirtualDirectory[],
    forceIgnore?: ForceIgnore
  ): SourceComponent {
    const tree = new VirtualTreeContainer(fs);
    return new SourceComponent(props, tree, forceIgnore);
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
    return this.xml && !this.parent && this.type.children
      ? this.getChildrenInternal(dirname(this.xml))
      : [];
  }

  public getPackageRelativePath(fsPath: SourcePath): SourcePath {
    const { directoryName, suffix, inFolder } = this.type;
    // if there isn't a suffix, assume this is a mixed content component that must
    // reside in the directoryName of its type. trimUntil maintains the folder structure
    // the file resides in for the new destination.
    if (!suffix) {
      return this.trimUntil(fsPath, directoryName);
    } else if (inFolder) {
      const folderName = this.fullName.split('/')[0];
      return join(directoryName, folderName, basename(fsPath));
    }
    return join(directoryName, basename(fsPath));
  }

  private getChildrenInternal(dirPath: SourcePath): SourceComponent[] {
    const children: SourceComponent[] = [];
    for (const fsPath of this.walk(dirPath)) {
      const childXml = parseMetadataXml(fsPath);
      const fileIsRootXml = childXml && childXml.suffix === this.type.suffix;
      if (childXml && !fileIsRootXml) {
        // TODO: Log warning if missing child type definition
        const childTypeId = this.type.children.suffixes[childXml.suffix];
        const childComponent = new SourceComponent(
          {
            name: baseName(fsPath),
            type: this.type.children.types[childTypeId],
            xml: fsPath,
            parent: this,
          },
          this._tree,
          this.forceIgnore
        );
        children.push(childComponent);
      }
    }
    return children;
  }

  private *walk(fsPath: SourcePath): IterableIterator<SourcePath> {
    if (!this._tree.isDirectory(fsPath)) {
      yield fsPath;
    } else {
      for (const child of this._tree.readDirectory(fsPath)) {
        const childPath = join(fsPath, child);
        if (this.forceIgnore.denies(childPath)) {
          continue;
        } else if (this._tree.isDirectory(childPath)) {
          yield* this.walk(childPath);
        } else {
          yield childPath;
        }
      }
    }
  }

  private trimUntil(fsPath: string, name: string): string {
    const parts = fsPath.split(sep);
    const index = parts.findIndex((part) => name === part);
    return parts.slice(index).join(sep);
  }

  get fullName(): string {
    return `${this.parent ? `${this.parent.fullName}.` : ''}${this.name}`;
  }
}
