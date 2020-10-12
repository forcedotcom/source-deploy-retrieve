/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { simon, kathy, gene, mockRegistry } from '../../mock/registry';
import { DefaultMetadataTransformer } from '../../../src/convert/transformers/defaultMetadataTransformer';
import { WriteInfo } from '../../../src/convert';
import { join, basename } from 'path';
import { createSandbox } from 'sinon';
import { TestReadable } from '../../mock/convert/readables';
import { expect } from 'chai';
import { META_XML_SUFFIX } from '../../../src/utils';
import { SourceComponent, VirtualTreeContainer } from '../../../src';

const env = createSandbox();

describe('DefaultMetadataTransformer', () => {
  beforeEach(() =>
    env
      .stub(VirtualTreeContainer.prototype, 'stream')
      .callsFake((fsPath: string) => new TestReadable(fsPath))
  );

  afterEach(() => env.restore());

  describe('toMetadataFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const { directoryName } = component.type;
      const relativeBundle = join(directoryName, basename(simon.SIMON_BUNDLE_PATH));
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          source: component.tree.stream(source),
          output: join(relativeBundle, basename(source)),
        });
      }
      expectedInfos.push({
        source: component.tree.stream(component.xml),
        output: join(relativeBundle, simon.SIMON_XML_NAME),
      });

      const result = await transformer.toMetadataFormat(component);
      expect(result).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should strip the -meta.xml suffix for components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(gene.GENE_COMPONENT, []);
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}`;
      const expectedInfos: WriteInfo[] = [
        {
          output: join(directoryName, fileName),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should handle folder type components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(kathy.KATHY_COMPONENTS[0], []);
      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toMetadataFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });

  describe('toSourceFormat', () => {
    it('should create a WriteInfo for each file in the component', async () => {
      const component = simon.SIMON_COMPONENT;
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const { directoryName } = component.type;
      const relativeBundle = join(
        'main',
        'default',
        directoryName,
        basename(simon.SIMON_BUNDLE_PATH)
      );
      const expectedInfos: WriteInfo[] = [];
      for (const source of component.walkContent()) {
        expectedInfos.push({
          output: join(relativeBundle, basename(source)),
          source: component.tree.stream(source),
        });
      }
      expectedInfos.push({
        output: join(relativeBundle, simon.SIMON_XML_NAME),
        source: component.tree.stream(component.xml),
      });

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should add in the -meta.xml suffix for components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(gene.GENE_MD_FORMAT_COMPONENT, []);
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const { directoryName } = component.type;
      const fileName = `${component.fullName}.${component.type.suffix}${META_XML_SUFFIX}`;
      const expectedInfos: WriteInfo[] = [
        {
          output: join('main', 'default', directoryName, fileName),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });

    it('should handle folder type components with no content', async () => {
      const component = SourceComponent.createVirtualComponent(
        kathy.KATHY_MD_FORMAT_COMPONENTS[0],
        []
      );
      const fullNameParts = component.fullName.split('/');
      const { directoryName } = component.type;
      const transformer = new DefaultMetadataTransformer(mockRegistry);
      const expectedInfos: WriteInfo[] = [
        {
          output: join(
            'main',
            'default',
            directoryName,
            fullNameParts[0],
            `${fullNameParts[1]}.${component.type.suffix}${META_XML_SUFFIX}`
          ),
          source: component.tree.stream(component.xml),
        },
      ];

      expect(await transformer.toSourceFormat(component)).to.deep.equal({
        component,
        writeInfos: expectedInfos,
      });
    });
  });
});
