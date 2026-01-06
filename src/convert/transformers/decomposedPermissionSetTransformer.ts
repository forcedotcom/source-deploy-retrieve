/*
 * Copyright 2026, Salesforce, Inc.
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
import { AnyJson, ensureString, JsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import type { PermissionSet } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { calculateRelativePath } from '../../utils/path';
import { unwrapAndOmitNS } from '../../utils/decomposed';
import type { MetadataType } from '../../registry';
import { SourceComponent, type MetadataComponent } from '../../resolve';
import { JsToXml } from '../streams';
import type { ToSourceFormatInput, WriteInfo, XmlObj } from '../types';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL, type SourcePath } from '../../common';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import {
  addChildType,
  forceIgnoreAllowsComponent,
  getOutputFile,
  getWriteInfosWithoutMerge,
  hasChildTypeId,
  tagToChildTypeId,
} from './decomposedMetadataTransformer';
import type { InfoContainer, ComposedMetadata } from './types';

export class DecomposedPermissionSetTransformer extends BaseMetadataTransformer {
  /**
   * Combines a decomposed Permission Set into a singular .permissonset metadata-formatted file
   *
   * @param {SourceComponent} component - either the parent or child of a decomposed permission set to be combined with
   * @returns {Promise<WriteInfo[]>} will be an array with one WriteInfo in it, because they're ending in one file
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    // only need to do this once
    this.context.decomposedPermissionSet.permissionSetType ??= this.registry.getTypeByName('PermissionSet');
    const children = component.getChildren();
    // component is the first (alphabetically) file in the PS dir, if it happens to be the parent (.permissionset) use it,
    const parent =
      // otherwise, build our own
      component.xml?.endsWith('.permissionset-meta.xml')
        ? component
        : new SourceComponent({
            // because the children have the same name as the parent
            name: children[0]?.name,
            xml: children[0]?.xml!.replace(/(\w+\.\w+-meta\.xml)/gm, `${children[0].name}.permissionset-meta.xml`),
            type: this.context.decomposedPermissionSet.permissionSetType,
          });

    [...children, parent].map((c) => {
      // eslint-disable-next-line no-unused-expressions
      this.context.decomposedPermissionSet.transactionState.parentToChild.has(parent.fullName)
        ? this.context.decomposedPermissionSet.transactionState.parentToChild
            .get(parent.fullName)!
            .push(unwrapAndOmitNS('PermissionSet')(c.parseXmlSync()) as PermissionSet)
        : this.context.decomposedPermissionSet.transactionState.parentToChild.set(parent.fullName, [
            unwrapAndOmitNS('PermissionSet')(c.parseXmlSync()) as PermissionSet,
          ]);
    });

    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  /**
   * will decompose a .permissionset into a directory containing files, and an 'objectSettings' folder for object-specific settings
   *
   * @param {SourceComponent} component A SourceComponent representing a metadata-formatted permission set
   * @param {SourceComponent | undefined} mergeWith any existing source-formatted permission sets to be merged with, think existing source merging with new information from a retrieve
   * @returns {Promise<WriteInfo[]>} Will contain file content information, and file paths
   */
  public async toSourceFormat({ component, mergeWith }: ToSourceFormatInput): Promise<WriteInfo[]> {
    const forceIgnore = component.getForceIgnore();

    // if the whole parent is ignored, we won't worry about decomposing things
    // this can happen if the manifest had a *; all the members will be retrieved.
    if (forceIgnore.denies(getOutputFile(component, mergeWith))) {
      return [];
    }
    const composedMetadata = await getComposedMetadataEntries(component);

    const parentXmlObject: XmlObj = {
      [component.type.name]: {
        [XML_NS_KEY]: XML_NS_URL,
        ...Object.fromEntries(
          composedMetadata.filter((v) => v.childTypeId === undefined).map(({ tagKey, tagValue }) => [tagKey, tagValue])
        ),
      },
    };

    const preparedMetadata = composedMetadata
      .filter(hasChildTypeId)
      .map(addChildType)
      .map((child) => toInfoContainer(mergeWith)(component)(child.childType)(child.tagValue as JsonMap))
      .flat()
      .filter(forceIgnoreAllowsComponent(forceIgnore));

    const writeInfosForChildren = combineChildWriteInfos([
      // children whose type don't have a directory assigned will be written to the top level, separate them into individual WriteInfo[] with only one entry
      // a [WriteInfo] with one entry, will result in one file
      ...preparedMetadata.filter((c) => !c.childComponent.type.directoryName).map((c) => [c]),
      // children whose type have a directory name will be grouped accordingly, bundle these together as a WriteInfo[][] with length > 1
      // a [WriteInfo, WriteInfo, ...] will be combined into a [WriteInfo] with combined contents
      preparedMetadata.filter((c) => c.childComponent.type.directoryName),
    ]);

    const writeInfoForParent = mergeWith
      ? [
          {
            output: join(
              ensureString(mergeWith.content),
              `${component.name}.${ensureString(component.type.suffix)}${META_XML_SUFFIX}`
            ),
            source: new JsToXml(parentXmlObject),
          },
        ]
      : getWriteInfosWithoutMerge(this.defaultDirectory)(parentXmlObject)(component);

    return [...writeInfosForChildren, ...writeInfoForParent];
  }
}
/** for a component, parse the xml and create a json object with contents, child typeId, etc */
const getComposedMetadataEntries = async (component: SourceComponent): Promise<ComposedMetadata[]> =>
  // composedMetadata might be undefined if you call toSourceFormat() from a non-source-backed Component
  Object.entries((await component.parseXml())[component.type.name] ?? {}).map(
    ([tagKey, tagValue]: [string, AnyJson]): ComposedMetadata => ({
      tagKey,
      tagValue,
      parentType: component.type,
      childTypeId: tagToChildTypeId({ tagKey, type: component.type }),
    })
  );

/** where the file goes if there's nothing to merge with */
const getDefaultOutput = (component: MetadataComponent): SourcePath => {
  const { parent, fullName, type } = component;
  const [baseName, ...tail] = fullName.split('.');
  // there could be a '.' inside the child name (ex: PermissionSet.FieldPermissions.field uses Obj__c.Field__c)
  const childName = tail.length ? tail.join('.') : undefined;
  const output = join(
    parent?.type.strategies?.decomposition ? type.directoryName : '',
    `${childName ?? baseName}.${ensureString(component.type.suffix)}${META_XML_SUFFIX}`
  );
  return join(calculateRelativePath('source')({ self: parent?.type ?? type })(fullName)(baseName), output);
};

const buildSource = (parentType: string, info: InfoContainer[], childDirectories: Array<[string, string]>): JsToXml =>
  new JsToXml({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    [parentType]: Object.assign(
      {},
      ...info.map((i) => ({
        [childDirectories
          // the child tag values correspond to the parents directories, not the names , classAccess => <classAccesses>
          // find the value that matches, and use the key e[0]=value
          .find((e) => e[1] === i.childComponent.type.name.toLowerCase())
          ?.at(0) ?? '']: i.value,
      }))
    ),
  });
const combineChildWriteInfos = (containers: InfoContainer[][]): WriteInfo[] => {
  // aggregator write info, will be returned at the end
  const writeInfos: WriteInfo[] = [];
  containers.forEach((infoContainers) => {
    // we have multiple InfoContainers, build a map of output file => file content
    // this is how we'll combine multiple children into one file
    const nameWriteInfoMap = new Map<string, InfoContainer[]>();
    infoContainers.map((info) =>
      nameWriteInfoMap.has(info.entryName)
        ? nameWriteInfoMap.get(info.entryName)!.push(info)
        : nameWriteInfoMap.set(info.entryName, [info])
    );

    nameWriteInfoMap.forEach((info) => {
      // all children share the same parent type, grab the first entry for top-level parent name
      const childDirectories = Object.entries(
        info[0].parentComponent.type.children?.directories as Record<string, string>
      );
      // if there's nothing to merge with, push write operation now to default location
      const childInfo = info[0].childComponent;

      writeInfos.push({
        source: buildSource(info[0].parentComponent.type.name, info, childDirectories),
        output: !info[0].mergeWith
          ? getDefaultOutput(childInfo)
          : join(
              ensureString(info[0].mergeWith.content),
              childInfo.type.directoryName,
              `${info[0].entryName}.${ensureString(childInfo.type.suffix)}${META_XML_SUFFIX}`
            ),
      });
      return;
    });
  });
  return writeInfos;
};

/** returns a data structure with lots of context information in it - this is also where the name of the file/component is calculated */
const toInfoContainer =
  (mergeWith: SourceComponent | undefined) =>
  (parent: SourceComponent) =>
  (childType: MetadataType) =>
  (tagValue: JsonMap): InfoContainer[] => {
    const tagEntry: JsonMap[] = Array.isArray(tagValue) ? tagValue : [tagValue];

    const buildInfoContainer = (entryName: string, value: JsonMap): InfoContainer => ({
      parentComponent: parent,
      entryName,
      childComponent: {
        fullName: `${parent.fullName}.${entryName}`,
        type: childType,
        parent,
      },
      value,
      mergeWith,
    });

    // ObjectSettings, ObjectPermission (object), FieldPermission (field),
    // RecordTypeVisibility (recordType), TabSetting (tab)
    if (childType.directoryName) {
      const infoContainers = new Map<string, InfoContainer>();
      tagEntry.map((entry) => {
        let entryName = (entry[childType.uniqueIdElement!] as string).split('.')[0];
        // If the object name starts with `standard-`, we need to remove the prefix
        if (entryName.startsWith('standard-')) {
          entryName = entryName.replace('standard-', '');
        }
        const infoContainer = infoContainers.get(entryName);
        if (infoContainer) {
          // Add to the value of the existing InfoContainer
          // @ts-expect-error this is either JsonMap or JsonArray
          infoContainer.value = ensureArray(infoContainer.value).concat(entry);
        } else {
          infoContainers.set(entryName, buildInfoContainer(entryName, entry));
        }
      });
      return Array.from(infoContainers.values());
    }
    return [buildInfoContainer(parent.name, tagValue)];
  };
