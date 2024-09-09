/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join } from 'node:path';
import { AnyJson, ensureString, JsonMap } from '@salesforce/ts-types';
import { Messages } from '@salesforce/core';
import type { PermissionSet } from '@jsforce/jsforce-node/lib/api/metadata/schema';
import { calculateRelativePath } from '../../utils/path';
import { unwrapAndOmitNS } from '../../utils/decomposed';
import type { MetadataComponent } from '../../resolve/types';
import { type MetadataType } from '../../registry/types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import type { ToSourceFormatInput, WriteInfo, XmlObj } from '../types';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import type { SourcePath } from '../../common/types';
import { ComponentSet } from '../../collections/componentSet';
import type { DecompositionStateValue } from '../convertContext/decompositionFinalizer';
import { BaseMetadataTransformer } from './baseMetadataTransformer';
import {
  addChildType,
  forceIgnoreAllowsComponent,
  getOutputFile,
  getWriteInfosFromMerge,
  getWriteInfosWithoutMerge,
  hasChildTypeId,
  setDecomposedState,
  tagToChildTypeId,
} from './decomposedMetadataTransformer';
import type { InfoContainer, ComposedMetadata } from './types';

type StateSetter = (forComponent: MetadataComponent, props: Partial<Omit<DecompositionStateValue, 'origin'>>) => void;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

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

    [
      ...children,
      // TODO: this feels wrong, I'm not sure why the parent (.permissionset) isn't here child.getChildren() returns children
      new SourceComponent({
        // because the children have the same name as the parent
        name: children[0]?.name,
        xml: children[0]?.xml!.replace(/(\w+\.\w+-meta\.xml)/gm, `${children[0].name}.permissionset-meta.xml`),
        type: this.context.decomposedPermissionSet.permissionSetType,
      }),
    ].map((c) => {
      this.context.decomposedPermissionSet.transactionState.permissionSetChildByPath.set(
        `${c.xml!}:${c.fullName}`,
        unwrapAndOmitNS('PermissionSet')(c.parseXmlSync()) as PermissionSet
      );
    });

    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  /**
   * will decomopse a .permissionset into a directory containing files, and an 'objectSettings' folder for object-specific settings
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
    const stateSetter = setDecomposedState(this.context.decomposition.transactionState);
    const childrenOfMergeComponent = new ComponentSet(mergeWith?.getChildren(), this.registry);
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
      .map((c) => toInfoContainer(mergeWith)(component)(c.childType)(c.tagValue as JsonMap))
      .filter(forceIgnoreAllowsComponent(forceIgnore));

    const writeInfosForChildren = combineChildWriteInfos(
      [
        // children whose type don't have a directory assigned will be written to the top level, separate them into individual WriteInfo[] with only one entry
        // a [WriteInfo] with one entry, will result in one file
        ...preparedMetadata.filter((c) => !c.childComponent.type.directoryName).map((c) => [c]),
        // children whose type have a directory name will be grouped accordingly, bundle these together as a WriteInfo[][] with length > 1
        // a [WriteInfo, WriteInfo, ...] will be combined into a [WriteInfo] with combined contents
        preparedMetadata.filter((c) => c.childComponent.type.directoryName),
      ],
      stateSetter,
      childrenOfMergeComponent
    );

    const writeInfoForParent = mergeWith
      ? getWriteInfosFromMerge(mergeWith)(stateSetter)(parentXmlObject)(component)
      : getWriteInfosWithoutMerge(this.defaultDirectory)(parentXmlObject)(component);

    const childDestinations = new Set(writeInfosForChildren.map((w) => w.output));

    // files that exist in FS (therefore, in mergeWith) but aren't in the component should be deleted by returning a writeInfo
    // only do this if all the children have isAddressable marked false
    const writeInfosForMissingChildrenToDelete: WriteInfo[] = mergeWith
      ? childrenOfMergeComponent
          .getSourceComponents()
          .toArray()
          .filter(hasXml)
          .filter((c) => !childDestinations.has(c.xml))
          .map((c) => ({ shouldDelete: true, output: c.xml, fullName: c.fullName, type: c.type.name }))
      : [];

    return [...writeInfosForChildren, ...writeInfoForParent, ...writeInfosForMissingChildrenToDelete];
  }
}

const hasXml = (c: SourceComponent): c is SourceComponent & { xml: string } => typeof c.xml === 'string';

/** for a component, parse the xml and create an json object with contents, child typeId, etc */
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
const combineChildWriteInfos = (
  containers: InfoContainer[][],
  stateSetter: StateSetter,
  childrenOfMergeComponent: ComponentSet
): WriteInfo[] => {
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
      const source = buildSource(info[0].parentComponent.type.name, info, childDirectories);
      // if there's nothing to merge with, push write operation now to default location
      const childInfo = info[0].childComponent;
      if (!info[0].mergeWith) {
        writeInfos.push({ source, output: getDefaultOutput(childInfo) });
        return;
      }
      // if the merge parent has a child that can be merged with, push write
      // operation now and mark it as merged in the state
      if (childrenOfMergeComponent.has(childInfo)) {
        const mergeChild = childrenOfMergeComponent.getSourceComponents(childInfo).first();
        if (!mergeChild?.xml) {
          throw messages.createError('error_parsing_xml', [childInfo.fullName, childInfo.type.name]);
        }
        stateSetter(childInfo, { foundMerge: true });
        writeInfos.push({ source, output: mergeChild.xml });
        return;
      }
      // If we have a parent and the child is unaddressable without the parent, keep them
      // together on the file system, meaning a new child will not be written to the default dir.
      if (childInfo.type.unaddressableWithoutParent && typeof info[0].mergeWith?.xml === 'string') {
        // get output path from parent
        writeInfos.push({
          source,
          output: join(
            dirname(info[0].mergeWith.xml),
            `${info[0].entryName}.${ensureString(childInfo.type.suffix)}${META_XML_SUFFIX}`
          ),
        });
        return;
      }
      // we didn't find a merge, so we add it to the state for later processing
      stateSetter(childInfo, {
        writeInfo: { source, output: getDefaultOutput(childInfo) },
      });
      return [];
    });
  });
  return writeInfos;
};

/** returns a data structure with lots of context information in it - this is also where the name of the file/component is calculated */
const toInfoContainer =
  (mergeWith: SourceComponent | undefined) =>
  (parent: SourceComponent) =>
  (childType: MetadataType) =>
  (tagValue: JsonMap): InfoContainer => {
    const entryName = childType.directoryName
      ? ((tagValue as unknown as JsonMap[]).at(0)?.[childType.uniqueIdElement!] as string).split('.')[0]
      : parent.name;
    return {
      parentComponent: parent,
      entryName,
      childComponent: {
        fullName: `${parent.fullName}.${entryName}`,
        type: childType,
        parent,
      },
      value: tagValue,
      mergeWith,
    };
  };
