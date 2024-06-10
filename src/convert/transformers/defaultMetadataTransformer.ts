/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { basename, dirname, join } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { Lifecycle } from '@salesforce/core/lifecycle';
import { SourcePath } from '../../common/types';
import { META_XML_SUFFIX } from '../../common/constants';
import { SfdxFileFormat, WriteInfo } from '../types';
import { SourceComponent } from '../../resolve/sourceComponent';
import { extName, trimUntil } from '../../utils/path';
import { getReplacementStreamForReadable } from '../replacements';
import { BaseMetadataTransformer } from './baseMetadataTransformer';

const ORIGINAL_SUFFIX_REGEX = new RegExp('(.)([a-zA-Z]+)(' + META_XML_SUFFIX + ')$');

/**
 * The default metadata transformer.
 *
 * If a metadata type doesn't have a transformer assigned to it, this one is used
 * during the conversion process. It leaves the component's metadata xml and source
 * files as-is.
 */
export class DefaultMetadataTransformer extends BaseMetadataTransformer {
  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toMetadataFormat(component: SourceComponent): Promise<WriteInfo[]> {
    return getWriteInfos(component, 'metadata');
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  public async toSourceFormat(component: SourceComponent, mergeWith?: SourceComponent): Promise<WriteInfo[]> {
    return getWriteInfos(component, 'source', mergeWith);
  }
}

const getWriteInfos = (
  component: SourceComponent,
  targetFormat: SfdxFileFormat,
  mergeWith?: SourceComponent
): WriteInfo[] =>
  component
    .walkContent()
    .map((path) => ({
      source: getReplacementStreamForReadable(component, path),
      output: getContentSourceDestination(path, targetFormat, component, mergeWith),
    }))
    .concat(
      component.xml
        ? [
            {
              source: getReplacementStreamForReadable(component, component.xml),
              output: getXmlDestination(targetFormat, component, mergeWith),
            },
          ]
        : []
    );

// assumes component has content
const getContentSourceDestination = (
  source: SourcePath,
  targetFormat: SfdxFileFormat,
  component: SourceComponent,
  mergeWith?: SourceComponent
): SourcePath => {
  if (mergeWith?.content) {
    if (component.content && component.tree.isDirectory(component.content)) {
      const relative = trimUntil(source, basename(component.content));
      return join(dirname(mergeWith.content), relative);
    }
    return mergeWith.content;
  }
  return component.getPackageRelativePath(source, targetFormat);
};

// assumes component has xml
const getXmlDestination = (
  targetFormat: SfdxFileFormat,
  component: SourceComponent,
  mergeWith?: SourceComponent
): SourcePath => {
  if (mergeWith?.xml && targetFormat === 'source') {
    return mergeWith.xml;
  }

  const { folderContentType, suffix, legacySuffix } = component.type;
  if (!component.xml) {
    Messages.importMessagesDirectory(__dirname);
    const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');
    throw messages.createError('error_parsing_xml', [component.fullName, component.type.name]);
  }
  let xmlDestination = component.getPackageRelativePath(component.xml, targetFormat);

  // quirks:
  // - append or strip the -meta.xml suffix to the path if there's no content and if it's not DigitalExperienceBundle
  //  for folder components:
  //    - remove file extension but preserve -meta.xml suffix if folder type and to 'metadata format'
  //    - insert file extension behind the -meta.xml suffix if folder type and to 'source format'
  if (!component.content && !['digitalexperiencebundle'].includes(component.type.id)) {
    if (targetFormat === 'metadata') {
      if (folderContentType) {
        xmlDestination = xmlDestination.replace(`.${suffix}`, '');
      } else if (xmlDestination.includes(META_XML_SUFFIX)) {
        xmlDestination = xmlDestination.slice(0, xmlDestination.lastIndexOf(META_XML_SUFFIX));
      } else {
        void Lifecycle.getInstance().emitWarning(
          `Found a file (${xmlDestination}) that appears to be in metadata format, but the directory it's in is for source formatted files.`
        );
      }
    } else {
      xmlDestination = folderContentType
        ? xmlDestination.replace(META_XML_SUFFIX, `.${suffix}${META_XML_SUFFIX}`)
        : `${xmlDestination}${META_XML_SUFFIX}`;
    }
  } else if (suffix) {
    if (component.type.name === 'Document' && targetFormat === 'metadata' && component.content) {
      xmlDestination = xmlDestination.replace(
        new RegExp('.' + suffix + META_XML_SUFFIX + '$'),
        '.' + extName(component.content) + META_XML_SUFFIX
      );
    } else {
      xmlDestination = xmlDestination.replace(ORIGINAL_SUFFIX_REGEX, '.' + suffix + META_XML_SUFFIX);
    }
  }
  if (legacySuffix && suffix && xmlDestination.includes(legacySuffix)) {
    void Lifecycle.getInstance().emitWarning(
      `The ${component.type.name} component ${component.fullName} uses the legacy suffix ${legacySuffix}. This suffix is deprecated and will be removed in a future release.`
    );
    xmlDestination = xmlDestination.replace(legacySuffix, suffix);
  }
  return xmlDestination;
};
