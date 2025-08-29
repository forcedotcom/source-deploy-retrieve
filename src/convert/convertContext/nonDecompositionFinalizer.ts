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
import { join } from 'node:path';
import { ensureString, getString, JsonMap } from '@salesforce/ts-types';
import { SfProject } from '@salesforce/core/project';
import { getXmlElement } from '../../utils/decomposed';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import { ComponentSet } from '../../collections/componentSet';
import { NodeFSTreeContainer, TreeContainer } from '../../resolve/treeContainers';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import { WriterFormat } from '../types';
import { ConvertTransactionFinalizer } from './transactionFinalizer';

type NonDecompositionState = {
  /*
   * Incoming child xml (ex CustomLabel) keyed by uniqueId (label name).
   */
  childrenByUniqueElement: Map<string, JsonMap>;
  exampleComponent?: SourceComponent;
};

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
export class NonDecompositionFinalizer extends ConvertTransactionFinalizer<NonDecompositionState> {
  public transactionState: NonDecompositionState = {
    childrenByUniqueElement: new Map(),
    exampleComponent: undefined,
  };

  // filename => (childName => childXml)
  protected mergeMap = new Map<string, Map<string, JsonMap>>();

  // filename => sourceComponent
  protected parentComponentMap = new Map<string, SourceComponent>();
  protected tree: TreeContainer | undefined;

  public async finalize(defaultDirectory: string, tree = new NodeFSTreeContainer()): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    if (this.transactionState.childrenByUniqueElement.size === 0) {
      return writerData;
    }
    this.tree = tree;

    const packageDirectories = SfProject.getInstance(defaultDirectory).getPackageDirectories();
    const pkgPaths = packageDirectories.map((pkg) => pkg.fullPath);

    // nondecomposed metadata types can exist in multiple locations under the same name
    // so we have to find all components that could potentially match inbound components
    if (!this.transactionState.exampleComponent) {
      throw new Error('No example component exists in the transaction state for nondecomposed metadata');
    }
    const allNonDecomposed = pkgPaths.includes(defaultDirectory)
      ? this.getAllComponentsOfType(pkgPaths, this.transactionState.exampleComponent.type.name)
      : // defaultDirectory isn't a package, assume it's the target output dir for conversion so don't scan folder
        [];

    // prepare 3 maps to simplify component merging
    await this.initMergeMap(allNonDecomposed);
    this.parentComponentMap = new Map(
      allNonDecomposed.map((c) => [ensureString(c.xml, `no xml file path for ${c.fullName}`), c])
    );
    const childNameToParentFilePath = this.initChildMapping();

    // we'll merge any new labels into the default location
    const defaultKey = join(defaultDirectory, getDefaultOutput(this.transactionState.exampleComponent));
    this.ensureDefaults(defaultKey);

    // put the incoming components into the mergeMap.  Keep track of any files we need to write
    const filesToWrite = new Set<string>();
    this.transactionState.childrenByUniqueElement.forEach((child, childUniqueElement) => {
      const parentKey = childNameToParentFilePath.get(childUniqueElement) ?? defaultKey;
      const parentItemMap = this.mergeMap.get(parentKey);
      parentItemMap?.set(childUniqueElement, child);
      filesToWrite.add(parentKey);
    });

    // use the mergeMap to return the writables
    this.mergeMap.forEach((children, parentKey) => {
      if (filesToWrite.has(parentKey)) {
        const parentSourceComponent = this.parentComponentMap.get(parentKey);
        if (!parentSourceComponent) {
          throw new Error(`No source component found for ${parentKey}`);
        }
        const recomposedXmlObj = recompose(children, parentSourceComponent);
        writerData.push({
          component: parentSourceComponent,
          writeInfos: [{ source: new JsToXml(recomposedXmlObj), output: parentKey }],
        });
      }
    });

    return writerData;
  }

  private initChildMapping(): Map<string, string> {
    const output = new Map<string, string>();
    this.mergeMap.forEach((children, parentKey) => {
      children.forEach((child, childName) => {
        output.set(childName, parentKey);
      });
    });
    return output;
  }

  /**
   * check both top-level maps and make sure there are defaults
   */
  private ensureDefaults(defaultKey: string): void {
    if (!this.mergeMap.has(defaultKey)) {
      // If project has no files of this type, there won't be anything from allNonDecomposed.
      this.mergeMap.set(defaultKey, new Map<string, JsonMap>());
    }
    if (!this.parentComponentMap.has(defaultKey)) {
      // it's possible to get here if there are no files of this type in the project.
      // we don't have any SourceComponent to reference except the new incoming ones
      // so this creates a "default" component with the correct path for the xml file
      this.parentComponentMap.set(defaultKey, {
        ...this.transactionState.exampleComponent,
        xml: defaultKey,
      } as SourceComponent);
    }
  }

  /**
   * Returns all the components of the incoming type in the project.
   *
   * Some components are not resolved during component resolution.
   * This typically only happens when a specific source path was resolved. This is problematic for
   * nondecomposed metadata types (like CustomLabels) because we need to know the location of each
   * child type before recomposing the final xml.
   * The labels could belong in any of the files OR need to go in the default location which already contains labels
   */
  private getAllComponentsOfType(pkgDirs: string[], componentType: string): SourceComponent[] {
    const unprocessedComponents = ComponentSet.fromSource({
      fsPaths: pkgDirs,
      include: new ComponentSet([{ fullName: '*', type: componentType }]),
      tree: this.tree,
    }).getSourceComponents();
    return unprocessedComponents.toArray();
  }

  /**
   * Populate the mergeMap with all the children of all the local components
   */
  private async initMergeMap(allComponentsOfType: SourceComponent[]): Promise<void> {
    // A function we can parallelize since we have to parseXml for each local file
    const getMappedChildren = async (component: SourceComponent): Promise<Map<string, JsonMap>> => {
      const results = await Promise.all(
        component.getChildren().map(async (child): Promise<[string, JsonMap]> => {
          const childXml = await child.parseXml();
          return [
            getString(
              childXml,
              ensureString(child.type.uniqueIdElement),
              `No uniqueIdElement exists in the registry for ${child.type.name}`
            ),
            childXml,
          ];
        })
      );
      return new Map(results);
    };

    const result = await Promise.all(
      allComponentsOfType.map(
        async (c): Promise<[string, Map<string, JsonMap>]> => [
          ensureString(c.xml, `Missing xml file for ${c.type.name}`),
          await getMappedChildren(c),
        ]
      )
    );

    this.mergeMap = new Map(result);
  }
}

/** Return a json object that's built up from the mergeMap children */
const recompose = (children: Map<string, JsonMap>, parentSourceComponent: SourceComponent): JsonMap => ({
  [parentSourceComponent.type.name]: {
    [XML_NS_KEY]: XML_NS_URL,
    // for CustomLabels, that's `labels`
    [getXmlElement(parentSourceComponent.type)]: Array.from(children.values()),
  },
});

/** Return the default filepath for new metadata of this type */
const getDefaultOutput = (component: SourceComponent): string => {
  const { fullName } = component;
  const [baseName] = fullName.split('.');
  const output = `${baseName}.${component.type.suffix ?? ''}${META_XML_SUFFIX}`;

  return join(component.getPackageRelativePath('', 'source'), output);
};
