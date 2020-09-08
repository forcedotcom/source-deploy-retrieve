/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { simon, kathy, gene } from '../../mock/registry';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { WriteInfo } from '../../../src/convert';
import { join, basename } from 'path';
import { createSandbox } from 'sinon';
import { TestReadable } from '../../mock/convert/readables';
import * as fs from 'fs';
import { expect } from 'chai';
import { META_XML_SUFFIX } from '../../../src/utils';

const env = createSandbox();

describe('DefaultMetadataTransformer', () => {
  beforeEach(() =>
    // @ts-ignore mock readable isn't an fs readable specifically
    env.stub(fs, 'createReadStream').callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should create a WriteInfo for each file in the component', () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultMetadataTransformer(component);
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(simon.SIMON_BUNDLE_PATH));
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          relativeDestination: join(relativeBundle, basename(source)),
          source: fs.createReadStream(source),
        });
      }
      expectedInfos.push({
        relativeDestination: join(relativeBundle, simon.SIMON_XML_NAME),
        source: fs.createReadStream(component.xml),
      });

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should strip the -meta.xml suffix for components with no content', () => {
      const component = gene.GENE_COMPONENT;
      const transformer = new DefaultMetadataTransformer(component);
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}`;
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(directoryName, fileName),
          source: fs.createReadStream(component.xml),
        },
      ];

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should handle folder type components with no content', () => {
      const component = kathy.KATHY_COMPONENTS[0];
      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const transformer = new DefaultMetadataTransformer(component);
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}`
          ),
          source: fs.createReadStream(component.xml),
        },
      ];

      expect(transformer.toMetadataFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should create a WriteInfo for each file in the component', () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultMetadataTransformer(component);
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(simon.SIMON_BUNDLE_PATH));
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          relativeDestination: join(relativeBundle, basename(source)),
          source: fs.createReadStream(source),
        });
      }
      expectedInfos.push({
        relativeDestination: join(relativeBundle, simon.SIMON_XML_NAME),
        source: fs.createReadStream(component.xml),
      });

      expect(transformer.toSourceFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should add in the -meta.xml suffix for components with no content', () => {
      const component = gene.GENE_MD_FORMAT_COMPONENT;
      const transformer = new DefaultMetadataTransformer(component);
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}${META_XML_SUFFIX}`;
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(directoryName, fileName),
          source: fs.createReadStream(component.xml),
        },
      ];

      expect(transformer.toSourceFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should handle folder type components with no content', () => {
      const component = kathy.KATHY_MD_FORMAT_COMPONENTS[0];
      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const transformer = new DefaultMetadataTransformer(component);
      const expectedInfos: WriteInfo[] = [
        {
          relativeDestination: join(
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}${META_XML_SUFFIX}`
          ),
          source: fs.createReadStream(component.xml),
        },
      ];

      expect(transformer.toSourceFormat()).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });
});
