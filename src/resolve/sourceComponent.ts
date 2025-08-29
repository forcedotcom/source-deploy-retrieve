/*
 * Copyright 2025, Salesforce, Inc.
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
import { join, dirname } from 'node:path';
import { SfError } from '@salesforce/core/sfError';
import { Messages } from '@salesforce/core/messages';
import { Lifecycle } from '@salesforce/core/lifecycle';

import { XMLValidator } from 'fast-xml-parser';
import { get, getString, JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { parser } from '../utils/metadata';
import { getXmlElement } from '../utils/decomposed';
import { baseName, baseWithoutSuffixes, parseMetadataXml, calculateRelativePath } from '../utils/path';
import { replacementIterations } from '../convert/replacements';
import { SfdxFileFormat } from '../convert/types';
import { MetadataType } from '../registry/types';
import { DestructiveChangesType } from '../collections/types';
import { filePathsFromMetadataComponent } from '../utils/filePathGenerator';
import { MarkedReplacement } from '../convert/types';
import { MetadataComponent, VirtualDirectory } from './types';

import { NodeFSTreeContainer, TreeContainer, VirtualTreeContainer } from './treeContainers';
import { ForceIgnore } from './forceIgnore';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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
  public replacements?: Record<string, MarkedReplacement[]>;
  private readonly treeContainer: TreeContainer;
  private readonly forceIgnore: ForceIgnore;
  private markedForDelete = false;
  private destructiveChangesType?: DestructiveChangesType;
  private pathContentMap = new Map<string, string>();

  public constructor(
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
    this.treeContainer = tree;
    this.forceIgnore = forceIgnore;
  }

  public get fullName(): string {
    if (this.type.ignoreParsedFullName) {
      return this.type.name;
    }
    if (this.parent && this.type.ignoreParentName) {
      if (!this.name) {
        throw new SfError(`Component was initialized without a name: ${this.xml ?? '<no xml>'} (${this.type.name})`);
      }
      return this.name;
    } else {
      return `${this.parent ? `${this.parent.fullName}.` : ''}${this.name}`;
    }
  }

  /**
   * Gets the metafile path of this component. Not all the types have an XML metafile,
   * e.g., DigitalExperience has a JSON metafile (_meta.json).
   *
   * @deprecated This function should not be used, use "xml" property instead.
   * @returns The metafile path
   */
  public get metaFilePath(): string | undefined {
    if (this.type.id === 'digitalexperience' && this.content && this.type.metaFileSuffix) {
      // metaFileName = metaFileSuffix for DigitalExperience.
      return join(dirname(this.content), this.type.metaFileSuffix);
    }

    return this.xml;
  }

  public get tree(): TreeContainer {
    return this.treeContainer;
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
  public get isAddressable(): boolean {
    return this.type.isAddressable !== false;
  }

  /**
   *
   * @param props component properties (at a minimum, name and type)
   * @param fs VirtualTree.  If not provided, one will be constructed based on the name/type of the props
   * @param forceIgnore
   * @returns SourceComponent
   */
  public static createVirtualComponent(
    props: ComponentProperties,
    fs?: VirtualDirectory[],
    forceIgnore?: ForceIgnore
  ): SourceComponent {
    if (props.name) {
      const tree = fs
        ? new VirtualTreeContainer(fs)
        : VirtualTreeContainer.fromFilePaths(
            filePathsFromMetadataComponent({ fullName: props.name, type: props.type })
          );

      return new SourceComponent(props, tree, forceIgnore);
    }
    throw new SfError(`Virtual Components must be constructed with a name: ${props.type.name}`);
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
  /**
   * returns the children of a parent SourceComponent
   *
   * Ensures that the children of SourceComponent are valid child types.
   * Invalid child types can occur when projects are structured in an atypical way such as having
   * ApexClasses or Layouts within a CustomObject folder.
   *
   * @return SourceComponent[] containing valid children
   */
  public getChildren(): SourceComponent[] {
    if (!this.parent && this.type.children) {
      const validChildTypes = new Set(Object.keys(this.type.children.types));
      const children = this.content ? this.getDecomposedChildren(this.content) : this.getNonDecomposedChildren();

      // Ensure only valid child types are included with the parent.
      children
        .filter((child) => !validChildTypes.has(child.type?.id))
        .map((child) => {
          throw new SfError(
            messages.getMessage('error_unexpected_child_type', [child.xml ?? child.content, this.type.name]),
            'TypeInferenceError'
          );
        });

      return children;
    }
    return [];
  }

  public async parseXml<T extends JsonMap>(xmlFilePath?: string): Promise<T> {
    const xml = xmlFilePath ?? this.xml;
    if (xml) {
      let contents: string;
      if (this.pathContentMap.has(xml)) {
        contents = this.pathContentMap.get(xml) as string;
      } else {
        contents = (await this.tree.readFile(xml)).toString();
        this.pathContentMap.set(xml, contents);
      }

      const replacements = this.replacements?.[xml] ?? this.parent?.replacements?.[xml];
      return this.parseAndValidateXML<T>(
        replacements ? (await replacementIterations(contents, replacements)).output : contents,
        xml
      );
    }
    return {} as T;
  }

  public parseXmlSync<T extends JsonMap>(xmlFilePath?: string): T {
    const xml = xmlFilePath ?? this.xml;
    if (xml) {
      let contents: string;
      if (this.pathContentMap.has(xml)) {
        contents = this.pathContentMap.get(xml) as string;
      } else {
        contents = this.tree.readFileSync(xml).toString();
        this.pathContentMap.set(xml, contents);
      }

      return this.parseAndValidateXML(contents, xml);
    }
    return {} as T;
  }

  /**
   * will return this instance of the forceignore, or will create one if undefined
   *
   * @return ForceIgnore
   */
  public getForceIgnore(): ForceIgnore {
    return this.forceIgnore;
  }

  /**
   * As a performance enhancement, use the already parsed parent xml source
   * to return the child section of xml source. This is useful for non-decomposed
   * transformers where all child source components reference the parent's
   * xml file to prevent re-reading the same file multiple times.
   *
   * @param parentXml parsed parent XMl source as an object
   * @returns child section of the parent's xml
   */
  public parseFromParentXml<T = JsonMap>(parentXml: T): T {
    if (!this.parent) {
      return parentXml;
    }
    const children = ensureArray(get(parentXml, `${this.parent.type.name}.${getXmlElement(this.type)}`)) as T[];
    const uniqueElement = this.type.uniqueIdElement;
    const matched = uniqueElement
      ? children.find((c) => getString(c, uniqueElement) === this.name) ??
        (parentXml[this.parent.type.name as keyof T] as T)
      : (parentXml[this.parent.type.name as keyof T] as T) ?? undefined;
    if (!matched) {
      throw new SfError(
        `Invalid XML tags or unable to find matching parent xml file for ${this.type.name} "${this.name}"`
      );
    }
    return matched;
  }

  public getPackageRelativePath(fsPath: string, format: SfdxFileFormat): string {
    return calculateRelativePath(format)({ self: this.type, parentType: this.parentType })(this.fullName)(fsPath);
  }

  /**
   * @returns whether this component should be part of destructive changes.
   */
  public isMarkedForDelete(): boolean {
    return this.markedForDelete;
  }

  public getDestructiveChangesType(): DestructiveChangesType | undefined {
    return this.destructiveChangesType;
  }

  public setMarkedForDelete(destructiveChangeType?: DestructiveChangesType | boolean): void {
    if (destructiveChangeType === false) {
      this.markedForDelete = false;
      // unset destructiveChangesType if it was already set
      delete this.destructiveChangesType;
    } else {
      this.markedForDelete = true;
      // destructiveChangeType is DestructiveChangeType OR boolean, if it's DestructiveChangesType.PRE => DestructiveChangesType.PRE
      // if it's DestructiveChangesType.POST or 'true' => DestructiveChangesType.POST
      this.destructiveChangesType =
        destructiveChangeType === DestructiveChangesType.PRE ? DestructiveChangesType.PRE : DestructiveChangesType.POST;
    }
  }

  private parse<T extends JsonMap>(contents: string): T {
    const parsed = parser.parse(String(contents)) as T;
    const [firstElement] = Object.keys(parsed);
    if (firstElement === this.type.name) {
      return parsed;
    } else if (this.parent) {
      return this.parseFromParentXml(parsed);
    } else {
      return parsed;
    }
  }

  private parseAndValidateXML<T extends JsonMap>(contents: string, path: string): T {
    try {
      return this.parse<T>(contents);
    } catch (e) {
      // only attempt validating once there's an error to avoid the performance hit of validating every file
      const validation = XMLValidator.validate(contents);
      if (validation !== true) {
        throw new SfError(
          messages.getMessage('invalid_xml_parsing', [
            path,
            validation.err.msg,
            validation.err.line.toString(),
            validation.err.code,
          ]),
          'LibraryError'
        );
      }
      throw e;
    }
  }

  private getDecomposedChildren(dirPath: string): SourceComponent[] {
    const children: SourceComponent[] = [];
    for (const fsPath of this.walk(dirPath)) {
      const childXml = parseMetadataXml(fsPath);
      const fileIsRootXml = childXml?.suffix === this.type.suffix || childXml?.suffix === this.type.legacySuffix;
      if (childXml && !fileIsRootXml && this.type.children && childXml.suffix) {
        const childTypeId = this.type.children?.suffixes[childXml.suffix];
        const childType = this.type.children.types[childTypeId];
        if (!childTypeId || !childType) {
          void Lifecycle.getInstance().emitWarning(
            `${fsPath}: Expected a child type for ${childXml.suffix} in ${this.type.name} but none was found.`
          );
        }
        const childComponent = new SourceComponent(
          {
            name: childType?.suffix ? baseWithoutSuffixes(fsPath, childType) : baseName(fsPath),
            type: this.type.children.types[childTypeId],
            xml: fsPath,
            parent: this,
          },
          this.treeContainer,
          this.forceIgnore
        );
        children.push(childComponent);
      }
    }
    return children;
  }

  // Get the children for non-decomposed types that have an xmlElementName
  // and uniqueIdElement defined in the registry.
  // E.g., CustomLabels, Workflows, SharingRules, AssignmentRules.
  private getNonDecomposedChildren(): SourceComponent[] {
    const parsed = this.parseXmlSync();
    if (!this.type.children) {
      throw new SfError(`There are no child types for ${this.type.name}`);
    }

    return Object.values(this.type.children.types).flatMap((childType) => {
      const { uniqueIdElement, xmlElementName } = childType;

      if (!uniqueIdElement || !xmlElementName) {
        return [];
      }
      const xmlPathToChildren = `${this.type.name}.${xmlElementName}`;
      const elements = ensureArray(get(parsed, xmlPathToChildren, []));
      return elements.map((element) => {
        const name = getString(element, uniqueIdElement);
        if (!name) {
          throw new SfError(`Missing ${uniqueIdElement} on ${childType.name} in ${this.xml ?? '<no xml>'}`);
        }
        return new SourceComponent(
          {
            name,
            type: childType,
            xml: this.xml,
            parent: this,
          },
          this.treeContainer,
          this.forceIgnore
        );
      });
    });
  }

  private *walk(fsPath: string): IterableIterator<string> {
    if (!this.treeContainer.isDirectory(fsPath)) {
      yield fsPath;
    } else {
      for (const child of this.treeContainer.readDirectory(fsPath)) {
        const childPath = join(fsPath, child);
        if (this.forceIgnore.denies(childPath)) {
          continue;
        } else if (this.treeContainer.isDirectory(childPath)) {
          yield* this.walk(childPath);
        } else {
          yield childPath;
        }
      }
    }
  }
}
