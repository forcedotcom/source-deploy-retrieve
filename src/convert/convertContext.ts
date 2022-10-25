/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { getString, JsonArray, JsonMap } from '@salesforce/ts-types';
import { SfProject } from '@salesforce/core';
import { ensureArray } from '@salesforce/kit';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../common';
import { ComponentSet } from '../collections';
import { RecompositionStrategy, TransformerStrategy } from '../registry';
import { MetadataComponent, SourceComponent, NodeFSTreeContainer, TreeContainer } from '../resolve';
import { JsToXml } from './streams';
import { WriteInfo, WriterFormat } from './types';

abstract class ConvertTransactionFinalizer<T> {
  protected abstract transactionState: T;

  public get state(): T {
    return this.transactionState;
  }

  public setState(props: (state: T) => void): void {
    props(this.transactionState);
  }

  public abstract finalize(defaultDirectory?: string): Promise<WriterFormat[]>;
}

interface RecompositionState {
  [componentKey: string]: {
    /**
     * Parent component that children are rolled up into
     */
    component?: SourceComponent;
    /**
     * Children to be rolled up into the parent file
     */
    children?: ComponentSet;
  };
}

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 */
class RecompositionFinalizer extends ConvertTransactionFinalizer<RecompositionState> {
  protected transactionState: RecompositionState = {};

  // A cache of SourceComponent xml file paths to parsed contents so that identical child xml
  // files are not read and parsed multiple times.
  private parsedXmlCache = new Map<string, JsonMap>();

  public async finalize(): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];
    for (const { component: parent, children } of Object.values(this.state)) {
      // TODO: can we safely parallelize this?
      // eslint-disable-next-line no-await-in-loop
      const recomposedXmlObj = await this.recompose(children, parent);
      writerData.push({
        component: parent,
        writeInfos: [
          {
            source: new JsToXml(recomposedXmlObj),
            output: join(parent.type.directoryName, `${parent.fullName}.${parent.type.suffix}`),
          },
        ],
      });
    }

    return writerData;
  }

  private async recompose(children: ComponentSet, parent: SourceComponent): Promise<JsonMap> {
    // When recomposing children that are non-decomposed, read and cache the parent XML to prevent
    // reading the parent source file (referenced in all child SourceComponents) multiple times.
    let parentXml: JsonMap;
    if (parent.type.strategies.transformer === TransformerStrategy.NonDecomposed) {
      parentXml = await parent.parseXml();
      this.parsedXmlCache.set(parent.xml, parentXml);
    }

    const parentXmlObj =
      parent.type.strategies.recomposition === RecompositionStrategy.StartEmpty
        ? {}
        : parentXml ?? (await parent.parseXml());

    for (const child of children) {
      const { directoryName: groupName } = child.type;
      const { name: parentName } = child.parent.type;
      const childSourceComponent = child as SourceComponent;

      let xmlObj: JsonMap;
      if (parentXml) {
        // If the xml file for the child is in the cache, use it. Otherwise
        // read and cache the xml file that contains this child and use it.
        if (!this.parsedXmlCache.has(childSourceComponent.xml)) {
          // TODO: can we safely parallelize this?
          // eslint-disable-next-line no-await-in-loop
          this.parsedXmlCache.set(childSourceComponent.xml, await parent.parseXml(childSourceComponent.xml));
        }
        xmlObj = childSourceComponent.parseFromParentXml(this.parsedXmlCache.get(childSourceComponent.xml));
      } else {
        // TODO: can we safely parallelize this?
        // eslint-disable-next-line no-await-in-loop
        xmlObj = await childSourceComponent.parseXml();
      }
      const childContents = xmlObj[child.type.name] || xmlObj;

      if (!parentXmlObj[parentName]) {
        parentXmlObj[parentName] = { [XML_NS_KEY]: XML_NS_URL };
      }

      // type safe way of checking childContents for the key
      if (getString(childContents, XML_NS_KEY)) {
        // child don't need to be written with `xmlns="http://soap.sforce.com/2006/04/metadata"` attribute
        delete (childContents as JsonMap)[XML_NS_KEY];
      }

      const parentObj = parentXmlObj[parentName] as JsonMap;

      if (!parentObj[groupName]) {
        parentObj[groupName] = [];
      }

      // it might be an object and not an array.  Example: custom object with a Field property containing a single field
      const group = ensureArray(parentObj[groupName]) as JsonArray;

      group.push(childContents);
    }
    return parentXmlObj;
  }
}

export interface DecompositionState {
  [componentKey: string]: {
    foundMerge?: boolean;
    writeInfo?: WriteInfo;
    origin?: MetadataComponent;
  };
}

/**
 * Creates write infos for any children that haven't been written yet. Children may
 * delay being written in order to find potential existing children to merge
 * with in the conversion pipeline.
 */
class DecompositionFinalizer extends ConvertTransactionFinalizer<DecompositionState> {
  protected transactionState: DecompositionState = {};

  // eslint-disable-next-line @typescript-eslint/require-await
  public async finalize(): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const toDecompose of Object.values(this.transactionState)) {
      if (!toDecompose.foundMerge) {
        writerData.push({
          component: toDecompose.origin.parent ?? toDecompose.origin,
          writeInfos: [toDecompose.writeInfo],
        });
      }
    }
    return writerData;
  }
}

interface NonDecompositionState {
  /*
   * Incoming child xml (ex CustomLabel) keyed by uniqueId (label name).
   */
  childrenByUniqueElement: Map<string, JsonMap>;
  exampleComponent: SourceComponent;
}

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
class NonDecompositionFinalizer extends ConvertTransactionFinalizer<NonDecompositionState> {
  protected transactionState: NonDecompositionState = {
    childrenByUniqueElement: new Map(),
    exampleComponent: undefined,
  };

  // filename => (childName => childXml)
  protected mergeMap = new Map<string, Map<string, JsonMap>>();

  // filename => sourceComponent
  protected parentComponentMap = new Map<string, SourceComponent>();
  protected tree: TreeContainer;

  public async finalize(defaultDirectory: string, tree = new NodeFSTreeContainer()): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    if (this.transactionState.childrenByUniqueElement.size === 0) {
      return writerData;
    }
    this.tree = tree;

    const packageDirectories = SfProject.getInstance().getPackageDirectories();
    const pkgPaths = packageDirectories.map((pkg) => pkg.fullPath);

    // nondecomposed metadata types can exist in multiple locations under the same name
    // so we have to find all components that could potentially match inbound components
    let allNonDecomposed: SourceComponent[];

    if (pkgPaths.includes(defaultDirectory)) {
      allNonDecomposed = this.getAllComponentsOfType(pkgPaths, this.transactionState.exampleComponent.type.name);
    } else {
      // defaultDirectory isn't a package, assumes it's the target output dir for conversion
      // so no need to scan this folder
      allNonDecomposed = [];
    }

    // prepare 3 maps to simplify component merging
    await this.initMergeMap(allNonDecomposed);
    this.parentComponentMap = new Map(allNonDecomposed.map((c) => [c.xml, c]));
    const childNameToParentFilePath = this.initChildMapping();

    // we'll merge any new labels into the default location
    const defaultKey = join(defaultDirectory, getDefaultOutput(this.transactionState.exampleComponent));
    this.ensureDefaults(defaultKey);

    // put the incoming components into the mergeMap.  Keep track of any files we need to write
    const filesToWrite = new Set<string>();
    this.state.childrenByUniqueElement.forEach((child, childUniqueElement) => {
      const parentKey = childNameToParentFilePath.get(childUniqueElement) ?? defaultKey;
      const parentItemMap = this.mergeMap.get(parentKey);
      parentItemMap.set(childUniqueElement, child);
      filesToWrite.add(parentKey);
    });

    // use the mergeMap to return the writables
    this.mergeMap.forEach((children, parentKey) => {
      if (filesToWrite.has(parentKey)) {
        const parentSourceComponent = this.parentComponentMap.get(parentKey);
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
          return [getString(childXml, child.type.uniqueIdElement), childXml];
        })
      );
      return new Map(results);
    };

    const result = await Promise.all(
      allComponentsOfType.map(async (c): Promise<[string, Map<string, JsonMap>]> => [c.xml, await getMappedChildren(c)])
    );

    this.mergeMap = new Map(result);
  }
}

/**
 * A state manager over the course of a single metadata conversion call.
 */
export class ConvertContext {
  public readonly decomposition = new DecompositionFinalizer();
  public readonly recomposition = new RecompositionFinalizer();
  public readonly nonDecomposition = new NonDecompositionFinalizer();

  // eslint-disable-next-line @typescript-eslint/require-await
  public async *executeFinalizers(defaultDirectory?: string): AsyncIterable<WriterFormat[]> {
    for (const member of Object.values(this)) {
      if (member instanceof ConvertTransactionFinalizer) {
        yield member.finalize(defaultDirectory);
      }
    }
  }
}

/**
 * Return a json object that's built up from the mergeMap children
 */
const recompose = (children: Map<string, JsonMap>, parentSourceComponent: SourceComponent): JsonMap => {
  // for CustomLabels, that's `labels`
  const groupName = parentSourceComponent.type.directoryName;
  return {
    [parentSourceComponent.type.name]: {
      [XML_NS_KEY]: XML_NS_URL,
      [groupName]: Array.from(children.values()),
    },
  };
};

/**
 * Return the default filepath for new metadata of this type
 */
const getDefaultOutput = (component: SourceComponent): string => {
  const { fullName } = component;
  const [baseName] = fullName.split('.');
  const output = `${baseName}.${component.type.suffix}${META_XML_SUFFIX}`;

  return join(component.getPackageRelativePath('', 'source'), output);
};
