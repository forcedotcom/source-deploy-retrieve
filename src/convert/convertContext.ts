/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { WriteInfo, WriterFormat } from './types';
import { MetadataComponent, SourceComponent } from '../resolve';
import { basename, dirname, join, resolve, sep } from 'path';
import { JsToXml } from './streams';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../common';
import { getString, JsonArray, JsonMap } from '@salesforce/ts-types';
import { ComponentSet } from '../collections';
import { RecompositionStrategy } from '../registry/types';
import { isEmpty } from '@salesforce/kit';

abstract class ConvertTransactionFinalizer<T> {
  protected abstract _state: T;

  public setState(props: (state: T) => void): void {
    props(this._state);
  }

  get state(): T {
    return this._state;
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
  protected _state: RecompositionState = {};

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
    const parentXmlObj =
      parent.type.strategies.recomposition === RecompositionStrategy.StartEmpty
        ? {}
        : await parent.parseXml();

    for (const child of children) {
      const { directoryName: groupName } = child.type;
      const { name: parentName } = child.parent.type;
      const xmlObj = await (child as SourceComponent).parseXml();
      const childContents = xmlObj[child.type.name] || xmlObj;

      if (!parentXmlObj[parentName]) {
        parentXmlObj[parentName] = { [XML_NS_KEY]: XML_NS_URL };
      }

      const parent = parentXmlObj[parentName] as JsonMap;

      if (!parent[groupName]) {
        parent[groupName] = [];
      }

      const group = parent[groupName] as JsonArray;

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
  protected _state: DecompositionState = {};

  public async finalize(): Promise<WriterFormat[]> {
    const writerData: WriterFormat[] = [];

    for (const toDecompose of Object.values(this._state)) {
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
  claimed: ChildIndex;
  unclaimed: ChildIndex;
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
  protected _state: NonDecompositionState = {
    unclaimed: {},
    claimed: {},
  };

  public async finalize(defaultDirectory: string): Promise<WriterFormat[]> {
    await this.finalizeState(defaultDirectory);

    const writerData: WriterFormat[] = [];
    for (const { parent, children } of Object.values(this.state.claimed)) {
      const recomposedXmlObj = await this.recompose(Object.values(children), parent);

      writerData.push({
        component: parent,
        writeInfos: [{ source: new JsToXml(recomposedXmlObj), output: parent.xml }],
      });
    }

    for (const { parent, children } of Object.values(this.state.unclaimed)) {
      const recomposedXmlObj = await this.recompose(Object.values(children), parent);
      writerData.push({
        component: parent,
        writeInfos: [
          { source: new JsToXml(recomposedXmlObj), output: this.getDefaultOutput(parent) },
        ],
      });
    }

    return writerData;
  }

  /**
   * This method finalizes the state by:
   * - finding any "unprocessed components" (nondecomposed metadata types can exist in multiple locations under the same name
   *   so we have to find all components that could potentially claim children)
   * - removing any children from the unclaimed state that have been claimed by the unprocessed components
   * - removing any children from the unclaimed state that have already been claimed by a prent in the claimed state
   * - merging the remaining unclaimed children into the default parent component (either the component that matches the
   *   defaultDirectory or the first parent component)
   */
  private async finalizeState(defaultDirectory: string): Promise<void> {
    if (isEmpty(this.state.claimed)) {
      return;
    }

    const unprocessedComponents = this.getUnprocessedComponents(defaultDirectory);
    const parentPaths = Object.keys(this.state.claimed).concat(
      unprocessedComponents.map((c) => c.xml)
    );

    const defaultComponentKey =
      parentPaths.find((p) => p.startsWith(defaultDirectory)) || parentPaths[0];

    const claimedChildren = [
      ...this.getClaimedChildrenNames(),
      ...(await this.getChildrenOfUnprocessedComponents(unprocessedComponents)),
    ];

    // merge unclaimed children into default parent component
    for (const [key, childIndex] of Object.entries(this.state.unclaimed)) {
      const pruned = Object.entries(childIndex.children).reduce((result, [childName, childXml]) => {
        return !claimedChildren.includes(childName)
          ? Object.assign(result, { [childName]: childXml })
          : result;
      }, {});
      delete this.state.unclaimed[key];
      if (this.state.claimed[defaultComponentKey]) {
        this.state.claimed[defaultComponentKey].children = Object.assign(
          {},
          this.state.claimed[defaultComponentKey].children,
          pruned
        );
      }
    }
  }

  /**
   * Returns the "unprocessed components"
   *
   * An unprocessed component is a component that was not resolved during component resolution.
   * This typically only happens when a specific source path was resolved. This is problematic for
   * nondecomposed metadata types (like CustomLabels) because we need to know the location of each
   * child type before recomposing the final xml. So in order for each of the children to be properly
   * claimed, we have to create new ComponentSet that will have all the parent components.
   */
  private getUnprocessedComponents(defaultDirectory: string): SourceComponent[] {
    if (isEmpty(this.state.unclaimed)) {
      return [];
    }
    const parents = this.getParentsOfClaimedChildren();
    const filterSet = new ComponentSet(parents);

    const { tree } = parents[0];
    const projectDir = resolve(dirname(defaultDirectory));
    const parentDirs = Object.keys(this.state.claimed).map((k) => {
      const parts = k.split(sep);
      const partIndex = parts.findIndex((p) => basename(projectDir) === p);
      return parts[partIndex + 1];
    });

    const fsPaths = tree
      .readDirectory(projectDir)
      .map((p) => join(projectDir, p))
      .filter((p) => {
        const dirName = basename(p);
        // Only return directories that are likely to be a project directory
        return (
          tree.isDirectory(p) &&
          !dirName.startsWith('.') &&
          dirName !== 'config' &&
          dirName !== 'node_modules' &&
          !parentDirs.includes(dirName)
        );
      });

    const unprocessedComponents = ComponentSet.fromSource({ fsPaths, include: filterSet })
      .getSourceComponents()
      .filter((component) => !this.state.claimed[component.xml]);
    return unprocessedComponents.toArray();
  }

  /**
   * Returns the children of "unprocessed components"
   */
  private async getChildrenOfUnprocessedComponents(
    unprocessedComponents: SourceComponent[]
  ): Promise<string[]> {
    const childrenOfUnprocessed = [];
    for (const component of unprocessedComponents) {
      for (const child of component.getChildren()) {
        const xml = await child.parseXml();
        const childName = getString(xml, child.type.uniqueIdElement);
        childrenOfUnprocessed.push(childName);
      }
    }
    return childrenOfUnprocessed;
  }

  private async recompose(children: JsonMap[], parent: SourceComponent): Promise<JsonMap> {
    const parentXmlObj =
      parent.type.strategies.recomposition === RecompositionStrategy.StartEmpty
        ? {}
        : await parent.parseXml();
    const groupName = parent.type.directoryName;
    const parentName = parent.type.name;
    for (const child of children) {
      if (!parentXmlObj[parentName]) {
        parentXmlObj[parentName] = { [XML_NS_KEY]: XML_NS_URL };
      }

      const parent = parentXmlObj[parentName] as JsonMap;

      if (!parent[groupName]) {
        parent[groupName] = [];
      }

      const group = parent[groupName] as JsonArray;

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

  private getClaimedChildrenNames(): string[] {
    return Object.values(this.state.claimed).reduce(
      (x, y) => x.concat(Object.keys(y.children)),
      []
    );
  }

  private getParentsOfClaimedChildren(): SourceComponent[] {
    return Object.values(this.state.claimed).reduce((x, y) => x.concat([y.parent]), []);
  }
}

/**
 * A state manager over the course of a single metadata conversion call.
 */
export class ConvertContext {
  public readonly decomposition = new DecompositionFinalizer();
  public readonly recomposition = new RecompositionFinalizer();
  public readonly nonDecomposition = new NonDecompositionFinalizer();

  public async *executeFinalizers(defaultDirectory?: string): AsyncIterable<WriterFormat[]> {
    for (const member of Object.values(this)) {
      if (member instanceof ConvertTransactionFinalizer) {
        yield member.finalize(defaultDirectory);
      }
    }
  }
}
