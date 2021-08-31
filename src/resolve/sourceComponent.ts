/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join, basename, sep } from 'path';
import { parse } from 'fast-xml-parser';
import { ForceIgnore } from './forceIgnore';
import { NodeFSTreeContainer, TreeContainer, VirtualTreeContainer } from './treeContainers';
import { MetadataComponent, VirtualDirectory } from './types';
import { baseName, normalizeToArray, parseMetadataXml } from '../utils';
import { DEFAULT_PACKAGE_ROOT_SFDX } from '../common';
import { get, getString, JsonMap } from '@salesforce/ts-types';
import { SfdxFileFormat } from '../convert';
import { trimUntil } from '../utils/path';
import { MetadataType } from '../registry';

export type ComponentProperties = {
  name: string;
  type: MetadataType;
  xml?: string;
  content?: string;
  parent?: SourceComponent;
  parentType?: MetadataType;
};

/**
 * Representation of a MetadataComponent in a file tree.
 */
export class SourceComponent implements MetadataComponent {
  public readonly name: string;
  public readonly type: MetadataType;
  public readonly xml?: string;
  public readonly parent?: SourceComponent;
  public parentType?: MetadataType;
  public content?: string;
  private _tree: TreeContainer;
  private forceIgnore: ForceIgnore;
  private markedForDelete = false;

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
    this.parentType = props.parentType;
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

  public walkContent(): string[] {
    const sources: string[] = [];
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
    if (!this.parent && this.type.children) {
      return this.content
        ? this.getDecomposedChildren(this.content)
        : this.getNonDecomposedChildren();
    }
    return [];
  }

  public async parseXml<T = JsonMap>(): Promise<T> {
    if (this.xml) {
      const contents = await this.tree.readFile(this.xml);
      return this.parse<T>(contents.toString());
    }
    return {} as T;
  }

  public parseXmlSync<T = JsonMap>(): T {
    if (this.xml) {
      const contents = this.tree.readFileSync(this.xml);
      return this.parse<T>(contents.toString());
    }
    return {} as T;
  }

  public getPackageRelativePath(fsPath: string, format: SfdxFileFormat): string {
    return format === 'source'
      ? join(DEFAULT_PACKAGE_ROOT_SFDX, this.calculateRelativePath(fsPath))
      : this.calculateRelativePath(fsPath);
  }

  /**
   * @returns whether this component should be part of destructive changes.
   */
  public isMarkedForDelete(): boolean {
    return this.markedForDelete;
  }

  public setMarkedForDelete(asDeletion: boolean): void {
    this.markedForDelete = asDeletion;
  }

  private calculateRelativePath(fsPath: string): string {
    const { directoryName, suffix, inFolder, folderType } = this.type;
    // if there isn't a suffix, assume this is a mixed content component that must
    // reside in the directoryName of its type. trimUntil maintains the folder structure
    // the file resides in for the new destination.
    if (!suffix) {
      return trimUntil(fsPath, directoryName);
    }
    // legacy version of folderType
    if (inFolder) {
      return join(directoryName, this.fullName.split('/')[0], basename(fsPath));
    }
    if (folderType) {
      // types like Territory2Model have child types inside them.  We have to preserve those folder structures
      if (this.parentType?.folderType && this.parentType?.folderType !== this.type.id) {
        const fsPathSplits = fsPath.split(sep);
        return fsPathSplits.slice(fsPathSplits.indexOf(this.parentType.directoryName)).join(sep);
      }
      return join(directoryName, this.fullName.split('/')[0], basename(fsPath));
    }
    return join(directoryName, basename(fsPath));
  }

  private parse<T = JsonMap>(contents: string): T {
    // include tag attributes and don't parse text node as number
    const parsed = parse(contents.toString(), {
      ignoreAttributes: false,
      parseNodeValue: false,
    }) as T;
    const [firstElement] = Object.keys(parsed);
    if (firstElement === this.type.name) {
      return parsed;
    } else if (this.parent) {
      const children = normalizeToArray(
        get(parsed, `${this.parent.type.name}.${this.type.directoryName}`)
      ) as T[];
      return children.find((c) => getString(c, this.type.uniqueIdElement) === this.name);
    } else {
      return parsed;
    }
  }

  private getDecomposedChildren(dirPath: string): SourceComponent[] {
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

  private getNonDecomposedChildren(): SourceComponent[] {
    // this method only applies to customlabels type
    const parsed = this.parseXmlSync();
    const xmlPathToChildren = `${this.type.name}.${this.type.directoryName}`;
    const children: SourceComponent[] = [];
    for (const childTypeId of Object.keys(this.type.children.types)) {
      const childType = this.type.children.types[childTypeId];
      const uniqueIdElement = childType.uniqueIdElement;
      if (uniqueIdElement) {
        const elements = normalizeToArray(get(parsed, xmlPathToChildren, []));
        const childComponents = elements.map((element) => {
          return new SourceComponent(
            {
              name: getString(element, uniqueIdElement),
              type: childType,
              xml: this.xml,
              parent: this,
            },
            this._tree,
            this.forceIgnore
          );
        });
        children.push(...childComponents);
      }
    }
    return children;
  }

  private *walk(fsPath: string): IterableIterator<string> {
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
    if (this.type.ignoreParsedFullName) {
      return this.type.name;
    }
    if (this.parent && this.type.ignoreParentName) {
      return this.name;
    } else {
      return `${this.parent ? `${this.parent.fullName}.` : ''}${this.name}`;
    }
  }

  get tree(): TreeContainer {
    return this._tree;
  }

  /**
   * Returns whether this component type is supported by the Metadata API
   * and therefore should have an entry added to the manifest.
   *
   * This is defined on the type in the registry. The type is required to
   * be in the registry for proper classification and for possible use in
   * decomposition/recomposition.
   *
   * Default value is true, so the only way to return false is to explicitly
   * set it in the registry as false.
   *
   * E.g., CustomFieldTranslation.
   */
  get isAddressable(): boolean {
    return this.type.isAddressable !== false;
  }
}
