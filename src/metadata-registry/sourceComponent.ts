/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TreeContainer, VirtualDirectory } from './types';
import { join, basename } from 'path';
import { parse } from 'fast-xml-parser';
import { ForceIgnore } from './forceIgnore';
import { parseMetadataXml } from '../utils/registry';
import { baseName } from '../utils';
import { NodeFSTreeContainer, VirtualTreeContainer } from './treeContainers';
import { DEFAULT_PACKAGE_ROOT_SFDX, MetadataType, SourcePath, MetadataComponent } from '../common';
import { JsonMap } from '@salesforce/ts-types';
import { SfdxFileFormat } from '../convert';
import { trimUntil } from '../utils/path';

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
    return this.content && !this.parent && this.type.children
      ? this.getChildrenInternal(this.content)
      : [];
  }

  public async parseXml(): Promise<JsonMap> {
    if (this.xml) {
      const contents = await this.tree.readFile(this.xml);
      return parse(contents.toString(), { ignoreAttributes: false });
    }
    return {};
  }

  public getPackageRelativePath(fsPath: SourcePath, format: SfdxFileFormat): SourcePath {
    const { directoryName, suffix, inFolder } = this.type;
    // if there isn't a suffix, assume this is a mixed content component that must
    // reside in the directoryName of its type. trimUntil maintains the folder structure
    // the file resides in for the new destination.
    let relativePath: SourcePath;
    if (!suffix) {
      relativePath = trimUntil(fsPath, directoryName);
    } else if (inFolder) {
      const folderName = this.fullName.split('/')[0];
      relativePath = join(directoryName, folderName, basename(fsPath));
    } else {
      relativePath = join(directoryName, basename(fsPath));
    }

    if (format === 'source') {
      return join(DEFAULT_PACKAGE_ROOT_SFDX, relativePath);
    }
    return relativePath;
  }

  private getChildrenInternal(dirPath: SourcePath): SourceComponent[] {
    const children: SourceComponent[] = [];
    for (const fsPath of this.walk(dirPath)) {
      const childXml = parseMetadataXml(fsPath);
      const fileIsRootXml = childXml?.suffix === this.type.suffix;
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

  get fullName(): string {
    return `${this.parent ? `${this.parent.fullName}.` : ''}${this.name}`;
  }

  get tree(): TreeContainer {
    return this._tree;
  }
}
