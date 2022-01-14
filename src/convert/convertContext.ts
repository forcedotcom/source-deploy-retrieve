/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { dirname, join, resolve } from 'path';
import { getString, JsonArray, JsonMap } from '@salesforce/ts-types';
import { isEmpty } from '@salesforce/kit';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../common';
import { ComponentSet } from '../collections';
import { normalizeToArray } from '../utils';
import { RecompositionStrategy, TransformerStrategy } from '../registry';
import { MetadataComponent, SourceComponent } from '../resolve';
import { JsToXml } from './streams';
import { WriteInfo, WriterFormat } from './types';

abstract class ConvertTransactionFinalizer<T> {
  protected abstract transactionState: T;

  public setState(props: (state: T) => void): void {
    props(this.transactionState);
  }

  public get state(): T {
    return this.transactionState;
  }

  public abstract finalize(defaultDirectory?: string): Promise<WriterFormat[]>;
}

export interface RecompositionState {
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
          this.parsedXmlCache.set(childSourceComponent.xml, await parent.parseXml(childSourceComponent.xml));
        }
        xmlObj = childSourceComponent.parseFromParentXml(this.parsedXmlCache.get(childSourceComponent.xml));
      } else {
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
      const group = normalizeToArray(parentObj[groupName]) as JsonArray;

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

export interface NonDecompositionState {
  incomingMatches: ChildIndex;
  incomingNonMatches: ChildIndex;
}

type ChildIndex = {
  [componentKey: string]: {
    parent: SourceComponent;
    children: {
      [childName: string]: JsonMap;
    };
  };
};

/**
 * Merges child components that share the same parent in the conversion pipeline
 * into a single file.
 *
 * Inserts unclaimed child components into the parent that belongs to the default package
 */
class NonDecompositionFinalizer extends ConvertTransactionFinalizer<NonDecompositionState> {
  protected transactionState: NonDecompositionState = {
    incomingNonMatches: {},
    incomingMatches: {},
  };

  protected mergeMap = new Map<string, Map<string, JsonMap>>();
  protected parentComponentMap = new Map<string, SourceComponent>();

  public async finalize(defaultDirectory: string): Promise<WriterFormat[]> {
    await this.finalizeState(defaultDirectory);

    const writerData: WriterFormat[] = [];

    this.mergeMap.forEach((children, parentKey) => {
      const parentSourceComponent = this.parentComponentMap.get(parentKey);
      const recomposedXmlObj = this.recompose(children, parentSourceComponent);
      writerData.push({
        component: parentSourceComponent,
        writeInfos: [{ source: new JsToXml(recomposedXmlObj), output: parentKey }],
      });
    });

    return writerData;
  }

  /**
   * This method finalizes the state by:
   * - finding all "parent components" (nondecomposed metadata types can exist in multiple locations under the same name so we have to find all components that could potentially match inbound components)
   * - add all their children to the class's merge map
   * - init the parentComponentMap
   * - overwrite the existing children with their incoming, matching child components
   * - merging the remaining unmatched inbound children into the default parent component (either the component that matches the defaultDirectory or the first parent component)
   */
  private async finalizeState(defaultDirectory: string): Promise<void> {
    if (isEmpty(this.state.incomingMatches) && isEmpty(this.state.incomingNonMatches)) {
      return;
    }

    // we just need some source component to derive the default place to store it.
    // could have just hardcoded CustomLabels as the type.
    const firstComponentAvailable =
      Object.values(this.state.incomingNonMatches)?.[0]?.parent ??
      Object.values(this.state.incomingMatches)?.[0]?.parent;

    // handle all existing instances of the type across the project
    const allNonDecomposed = this.getAllComponentsOfType(defaultDirectory, firstComponentAvailable.type.name);
    await this.mapAllChildren(allNonDecomposed);
    this.parentComponentMap = new Map(allNonDecomposed.map((c) => [c.xml, c]));

    // merge the new incoming nonMatches into the default location
    const defaultKey = join(defaultDirectory, this.getDefaultOutput(firstComponentAvailable));
    // there always has to be a default key map.  If you never had any files of this type,
    // there won't be anything from allNonDecomposed.
    if (!this.mergeMap.has(defaultKey)) {
      this.mergeMap.set(defaultKey, new Map<string, JsonMap>());
    }
    if (!this.parentComponentMap.has(defaultKey)) {
      // it's possible to get here if there are no files of this type in the project.
      // we don't have any SourceComponent to reference except the new incoming ones
      this.parentComponentMap.set(defaultKey, {
        ...Object.values(this.state.incomingNonMatches)?.[0]?.parent,
        xml: defaultKey,
      } as SourceComponent);
    }

    // merge any found matches into their proper file
    const matchedChildNames = Object.values(this.state.incomingMatches).flatMap(({ parent, children }) => {
      const keyItemMap = this.mergeMap.get(parent.xml);
      return Object.entries(children).map(([childName, child]) => {
        keyItemMap.set(childName, child);
        // we'll keep track of the names and get them out of nonMatched on the next step
        return childName;
      });
    });

    // it's also possible that some nonMatches are children of something in mergeMap that's already been matched
    this.mergeMap.forEach((children) => {
      children.forEach((child, childName) => {
        matchedChildNames.push(childName);
      });
    });

    // there may be things in incomingNonMatches that could have matched but weren't done in the lucky order
    // overwrite anything done so far with the new incoming matches
    const defaultKeyItemMap = this.mergeMap.get(defaultKey);
    Object.values(this.state.incomingNonMatches)
      .flatMap((c) => Object.entries(c.children))
      .filter(([childName]) => !matchedChildNames.includes(childName))
      .map(([childName, child]) => {
        defaultKeyItemMap.set(childName, child);
      });
  }

  /**
   * Returns all the components of that type
   *
   * Some components are not resolved during component resolution.
   * This typically only happens when a specific source path was resolved. This is problematic for
   * nondecomposed metadata types (like CustomLabels) because we need to know the location of each
   * child type before recomposing the final xml. So in order for each of the children to be properly
   * claimed, we have to create new ComponentSet that will have all the parent components.
   */
  private getAllComponentsOfType(defaultDirectory: string, componentType: string): SourceComponent[] {
    if (isEmpty(this.state.incomingNonMatches) && isEmpty(this.state.incomingMatches)) {
      return [];
    }

    // assumes that defaultDir is one level below project dir
    const projectDir = resolve(dirname(defaultDirectory));
    const filterSet = new ComponentSet();
    filterSet.add({ fullName: '*', type: componentType });

    const unprocessedComponents = ComponentSet.fromSource({
      fsPaths: [projectDir],
      include: filterSet,
    }).getSourceComponents();
    return unprocessedComponents.toArray();
  }

  /**
   * Populates the mergeMap with all the children of all the components
   */
  private async mapAllChildren(allComponentsOfType: SourceComponent[]): Promise<void> {
    const result = await Promise.all(
      allComponentsOfType.map(
        async (c): Promise<[string, Map<string, JsonMap>]> => [c.xml, await this.getMappedChildren(c)]
      )
    );

    this.mergeMap = new Map(result);
  }

  private async getMappedChildren(component: SourceComponent): Promise<Map<string, JsonMap>> {
    const results = await Promise.all(
      component.getChildren().map(async (child): Promise<[string, JsonMap]> => {
        const childXml = await child.parseXml();
        return [getString(childXml, child.type.uniqueIdElement), childXml];
      })
    );
    return new Map(results);
  }

  /**
   * Return a json object that's built up from the mergeMap children
   */
  private recompose(children: Map<string, JsonMap>, parentSourceComponent: SourceComponent): JsonMap {
    const groupName = parentSourceComponent.type.directoryName;
    const parentName = parentSourceComponent.type.name;
    const parentXmlObj = {};

    for (const child of children.values()) {
      if (!parentXmlObj[parentName]) {
        parentXmlObj[parentName] = { [XML_NS_KEY]: XML_NS_URL };
      }

      const parent = parentXmlObj[parentName] as JsonMap;

      if (!parent[groupName]) {
        parent[groupName] = [];
      }

      const group = normalizeToArray(parent[groupName]) as JsonArray;
      group.push(child);
    }

    return parentXmlObj;
  }

  private getDefaultOutput(component: SourceComponent): string {
    const { fullName } = component;
    const [baseName] = fullName.split('.');
    const output = `${baseName}.${component.type.suffix}${META_XML_SUFFIX}`;

    return join(component.getPackageRelativePath('', 'source'), output);
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
