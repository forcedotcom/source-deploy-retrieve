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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { MetadataResolver, NodeFSTreeContainer, RegistryAccess, SourceComponent, registry } from '../../../src';
import { ComputeAppMetadataTransformer } from '../../../src/convert/transformers/computeAppMetadataTransformer';

const registryAccess = new RegistryAccess();
const type = registry.types.computeapp;
const xmlData = '<ComputeApp xmlns="http://soap.sforce.com/2006/04/metadata"/>';

describe('ComputeApp conversion', () => {
  let tmpDir: string;
  let sourceRoot: string;
  let sourceDir: string;
  let sourceXml: string;
  let mdapiRoot: string;
  let mdapiXml: string;
  const tree = new NodeFSTreeContainer();

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'computeapp-transformer-'));

    sourceRoot = join(tmpDir, 'force-app');
    sourceDir = join(sourceRoot, 'main', 'default', 'computeApps', 'MyApp');
    sourceXml = join(sourceDir, 'MyApp.computeApp-meta.xml');
    mkdirSync(join(sourceDir, 'src'), { recursive: true });
    writeFileSync(sourceXml, xmlData);
    writeFileSync(join(sourceDir, 'package.json'), '{}');
    writeFileSync(join(sourceDir, 'src', 'app.js'), '');

    mdapiRoot = join(tmpDir, 'unpackaged');
    mdapiXml = join(mdapiRoot, 'computeApps', 'MyApp.computeApp');
    mkdirSync(join(mdapiRoot, 'computeApps'), { recursive: true });
    writeFileSync(mdapiXml, xmlData);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves the source bundle folder with the app files as content', () => {
    const components = new MetadataResolver(registryAccess, tree).getComponentsFromPath(sourceRoot);
    expect(components).to.have.lengthOf(1);
    expect(components[0].fullName).to.equal('MyApp');
    expect(components[0].xml).to.equal(sourceXml);
    expect(components[0].content).to.equal(sourceDir);
  });

  it('resolves the flat metadata-format file the org returns', () => {
    const components = new MetadataResolver(registryAccess, tree).getComponentsFromPath(mdapiRoot);
    expect(components).to.have.lengthOf(1);
    expect(components[0].type.name).to.equal('ComputeApp');
    expect(components[0].fullName).to.equal('MyApp');
    expect(components[0].xml).to.equal(mdapiXml);
    expect(components[0].content).to.be.undefined;
  });

  it('deploys only the flat xml, leaving app files to the transport', async () => {
    const component = new SourceComponent({ name: 'MyApp', type, xml: sourceXml, content: sourceDir }, tree);
    const infos = await new ComputeAppMetadataTransformer(registryAccess).toMetadataFormat(component);
    expect(infos.map((info) => info.output)).to.deep.equal([join('computeApps', 'MyApp.computeApp')]);
  });

  it('retrieves the flat xml into the bundle folder as -meta.xml', async () => {
    const component = new SourceComponent({ name: 'MyApp', type, xml: mdapiXml }, tree);
    const infos = await new ComputeAppMetadataTransformer(registryAccess).toSourceFormat({ component });
    expect(infos.map((info) => info.output)).to.deep.equal([
      join('main', 'default', 'computeApps', 'MyApp', 'MyApp.computeApp-meta.xml'),
    ]);
  });

  it('retrieves into the existing local meta file when merging', async () => {
    const component = new SourceComponent({ name: 'MyApp', type, xml: mdapiXml }, tree);
    const mergeWith = new SourceComponent({ name: 'MyApp', type, xml: sourceXml, content: sourceDir }, tree);
    const infos = await new ComputeAppMetadataTransformer(registryAccess).toSourceFormat({ component, mergeWith });
    expect(infos.map((info) => info.output)).to.deep.equal([sourceXml]);
  });
});
