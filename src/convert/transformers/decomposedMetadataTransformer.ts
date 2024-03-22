/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { dirname, join } from 'node:path';
import { AnyJson, JsonMap, ensureString, isJsonMap } from '@salesforce/ts-types';
import { ensureArray } from '@salesforce/kit';
import { Messages } from '@salesforce/core';
import { calculateRelativePath } from '../../utils/path';
import { ForceIgnore } from '../../resolve/forceIgnore';
import { extractUniqueElementValue } from '../../utils/decomposed';
import type { MetadataComponent } from '../../resolve/types';
import { DecompositionStrategy, type MetadataType } from '../../registry/types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { JsToXml } from '../streams';
import type { WriteInfo } from '../types';
import { META_XML_SUFFIX, XML_NS_KEY, XML_NS_URL } from '../../common/constants';
import type { SourcePath } from '../../common/types';
import { ComponentSet } from '../../collections/componentSet';
import type { DecompositionState, DecompositionStateValue } from '../convertContext/decompositionFinalizer';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

type XmlObj = { [index: string]: { [XML_NS_KEY]: typeof XML_NS_URL } & JsonMap };
type StateSetter = (forComponent: MetadataComponent, props: Partial<Omit<DecompositionStateValue, 'origin'>>) => void;

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

export class DecomposedMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    if (component.parent) {
      const { fullName: parentName } = component.parent;
      const stateForParent = this.context.recomposition.transactionState.get(parentName) ?? {
        component: component.parent,
        children: new ComponentSet([], this.registry),
      };
      stateForParent.children?.add(component);
      this.context.recomposition.transactionState.set(parentName, stateForParent);
    } else {
      const { fullName } = component;
      const existing = this.context.recomposition.transactionState.get(fullName) ?? {
        component,
        children: new ComponentSet([], this.registry),
      };
      (component.getChildren() ?? []).map((child) => {
        existing.children?.add(child);
      });
      this.context.recomposition.transactionState.set(fullName, existing);
    }
    // noop since the finalizer will push the writes to the component writer
    return [];
  }

  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    const forceIgnore = component.getForceIgnore();

    // if the whole parent is ignored, we won't worry about decomposing things
    // this can happen if the manifest had a *; all the members will be retrieved.
    if (forceIgnore.denies(getOutputFile(component, mergeWith))) {
      return [];
    }

    const childrenOfMergeComponent = new ComponentSet(mergeWith?.getChildren(), this.registry);
    const composedMetadata = await getComposedMetadataEntries(component);
    const parentXmlObject = buildParentXml(component.type)(composedMetadata);
    const stateSetter = setDecomposedState(this.context.decomposition.transactionState);

    const writeInfosForChildren = composedMetadata
      .filter(hasChildTypeId)
      .map(addChildType)
      .flatMap(({ tagValue, childType }) =>
        // iterate each array member if it's Object-like (ex: customField of a CustomObject)
        ensureArray(tagValue)
          .filter(isJsonMap)
          .map(toInfoContainer(mergeWith)(component)(childType))
          .filter(forceIgnoreAllowsComponent(forceIgnore)) // only process child types that aren't forceignored
          .map(handleUnaddressableChildAlone(composedMetadata.length)(parentXmlObject)(stateSetter))
          .flatMap(getChildWriteInfos(stateSetter)(childrenOfMergeComponent))
      );

    const writeInfoForParent = mergeWith
      ? getWriteInfosFromMerge(mergeWith)(stateSetter)(parentXmlObject)(component)
      : [{ source: new JsToXml(parentXmlObject), output: getOutputFile(component) }];

    const childDestinations = new Set(writeInfosForChildren.map((w) => w.output));

    // files that exist in FS (therefore, in mergeWith) but aren't in the component should be deleted by returning a writeInfo
    // only do this if all the children have isAddressable marked false
    const writeInfosForMissingChildrenToDelete: WriteInfo[] =
      mergeWith && allChildrenAreUnaddressable(component.type)
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

const allChildrenAreUnaddressable = (type: MetadataType): boolean =>
  Object.values(type.children?.types ?? {}).every(
    // exclude the COFT (unaddressableWithoutParent) from being deleted because its absence *might* not mean it was deleted from the org
    (c) => c.isAddressable === false && c.unaddressableWithoutParent !== true
  );

/**
 * composedMetadata is a representation of the parent's xml
 *
 * if there is no CustomObjectTranslation in the org, the composedMetadata will be 2 entries
 * the xml declaration, and a fields attribute, which points to the child CustomObjectFieldTranslation
 *
 * because CustomObjectFieldTranslation is the only metadata type with 'requiresParent' = true we can
 * calculate if a CustomObjectTranslation was retrieved from the org (composedMetadata.length > 2), or,
 * if we'll have to write an empty CustomObjectTranslation file (composedMetadata.length <=2).
 *
 * CustomObjectFieldTranslations are only addressable through their parent, and require a
 * CustomObjectTranslation file to be present
 */
const handleUnaddressableChildAlone =
  (composedMetadataLength: number) =>
  (parentXmlObject: XmlObj) =>
  (stateSetter: StateSetter) =>
  (v: InfoContainer): InfoContainer => {
    if (v.childComponent.type.unaddressableWithoutParent && composedMetadataLength <= 2) {
      stateSetter(v.childComponent, {
        writeInfo: {
          source: new JsToXml(parentXmlObject),
          output: getDefaultOutput(v.parentComponent),
        },
      });
    }
    return v;
  };

const getChildWriteInfos =
  (stateSetter: StateSetter) =>
  (childrenOfMergeComponent: ComponentSet) =>
  ({ mergeWith, childComponent, value, entryName }: InfoContainer): WriteInfo[] => {
    const source = objectToSource(childComponent.type.name)(value);
    // if there's nothing to merge with, push write operation now to default location
    if (!mergeWith) {
      return [{ source, output: getDefaultOutput(childComponent) }];
    }
    // if the merge parent has a child that can be merged with, push write
    // operation now and mark it as merged in the state
    if (childrenOfMergeComponent.has(childComponent)) {
      const mergeChild = childrenOfMergeComponent.getSourceComponents(childComponent).first();
      if (!mergeChild?.xml) {
        throw messages.createError('error_parsing_xml', [childComponent.fullName, childComponent.type.name]);
      }
      stateSetter(childComponent, { foundMerge: true });
      return [{ source, output: mergeChild.xml }];
    }
    // If we have a parent and the child is unaddressable without the parent, keep them
    // together on the file system, meaning a new child will not be written to the default dir.
    if (childComponent.type.unaddressableWithoutParent && typeof mergeWith?.xml === 'string') {
      // get output path from parent
      return [
        {
          source,
          output: join(dirname(mergeWith.xml), `${entryName}.${childComponent.type.suffix}${META_XML_SUFFIX}`),
        },
      ];
    }
    // we didn't find a merge, so we add it to the state for later processing
    stateSetter(childComponent, {
      writeInfo: { source, output: getDefaultOutput(childComponent) },
    });
    return [];
  };

const getWriteInfosFromMerge =
  (mergeWith: SourceComponent) =>
  (stateSetter: StateSetter) =>
  (parentXmlObject: XmlObj) =>
  (parentComponent: SourceComponent): WriteInfo[] => {
    const writeInfo = { source: new JsToXml(parentXmlObject), output: getOutputFile(parentComponent, mergeWith) };

    if (mergeWith?.xml) {
      // mark the component as found
      stateSetter(parentComponent, { foundMerge: true });
    } else if (objectHasSomeRealValues(parentComponent.type)(parentXmlObject)) {
      // set the state but don't return any writeInfo to avoid writing "empty" (ns-only) parent files
      stateSetter(parentComponent, { writeInfo });
    }
    return mergeWith.xml ? [writeInfo] : [];
  };

/**
 * Helper for setting the decomposed transaction state
 *
 * @param forComponent
 * @param props
 */
const setDecomposedState =
  (state: DecompositionState) =>
  (forComponent: MetadataComponent, props: Partial<Omit<DecompositionStateValue, 'origin'>>): void => {
    const key = getKey(forComponent);
    state.set(key, {
      // origin gets set the first time
      ...(state.get(key) ?? { origin: forComponent.parent ?? forComponent }),
      ...(props ?? {}),
    });
  };

const getKey = (component: MetadataComponent): string => `${component.type.name}#${component.fullName}`;

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
    parent?.type.strategies?.decomposition === DecompositionStrategy.FolderPerType ? type.directoryName : '',
    `${childName ?? baseName}.${component.type.suffix}${META_XML_SUFFIX}`
  );
  return join(calculateRelativePath('source')({ self: parent?.type ?? type })(fullName)(baseName), output);
};

/** use the given xmlElementName name if it exists, otherwise use see if one matches the directories */
const tagToChildTypeId = ({ tagKey, type }: { tagKey: string; type: MetadataType }): string | undefined =>
  Object.values(type.children?.types ?? {}).find((c) => c.xmlElementName === tagKey)?.id ??
  type.children?.directories?.[tagKey];

/** Ex: CustomObject: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' } has no real values */
const objectHasSomeRealValues =
  (type: MetadataType) =>
  (obj: XmlObj): boolean =>
    Object.keys(obj[type.name]).length > 1;

const hasChildTypeId = (cm: ComposedMetadata): cm is Required<ComposedMetadata> => !!cm.childTypeId;

const addChildType = (cm: Required<ComposedMetadata>): ComposedMetadataWithChildType => {
  const childType = cm.parentType.children?.types[cm.childTypeId];
  if (childType) {
    return { ...cm, childType };
  }
  throw messages.createError('error_missing_child_type_definition', [cm.parentType.name, cm.childTypeId]);
};

type ComposedMetadata = { tagKey: string; tagValue: AnyJson; parentType: MetadataType; childTypeId?: string };
type ComposedMetadataWithChildType = ComposedMetadata & { childType: MetadataType };

type InfoContainer = {
  entryName?: string;
  childComponent: MetadataComponent;
  value: JsonMap;
  parentComponent: SourceComponent;
  mergeWith?: SourceComponent;
};

/** returns an data structure with lots of context information in it */
const toInfoContainer =
  (mergeWith: SourceComponent | undefined) =>
  (parent: SourceComponent) =>
  (childType: MetadataType) =>
  (tagValue: JsonMap): InfoContainer => {
    const entryName = ensureString(extractUniqueElementValue(tagValue, childType.uniqueIdElement));
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

const forceIgnoreAllowsComponent =
  (forceIgnore: ForceIgnore) =>
  (ic: InfoContainer): boolean =>
    forceIgnore.accepts(getDefaultOutput(ic.childComponent));

/** wrap some xml in the Metadata type and add the NS stuff */
const objectToSource =
  (childTypeName: string) =>
  (obj: JsonMap): JsToXml =>
    new JsToXml({ [childTypeName]: { [XML_NS_KEY]: XML_NS_URL, ...obj } });

/** filter out the children and create the remaining parentXml */
const buildParentXml =
  (parentType: MetadataType) =>
  (c: ComposedMetadata[]): XmlObj => ({
    [parentType.name]: {
      [XML_NS_KEY]: XML_NS_URL,
      ...Object.fromEntries(
        c.filter((v) => v.childTypeId === undefined).map(({ tagKey, tagValue }) => [tagKey, tagValue])
      ),
    },
  });

const getOutputFile = (component: SourceComponent, mergeWith?: SourceComponent): string =>
  mergeWith?.xml ?? getDefaultOutput(component);
