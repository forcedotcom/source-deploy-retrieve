/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MetadataComponent } from '../../../metadata-registry/index';
import * as fs from 'fs';
import * as path from 'path';
import { BaseDeploy } from './baseDeploy';
import {
  BundleMetadataObj,
  supportedToolingTypes,
  ToolingDeployResult
} from './deployUtil';
import { ToolingCreateResult } from './index';

export class BundleDeploy extends BaseDeploy {
  public async deploy(
    component: MetadataComponent
  ): Promise<ToolingDeployResult> {
    this.metadataType = component.type.name;
    const bundleMetadataList = this.buildBundleList(component);
    const defToUpdate: BundleMetadataObj[] = [];
    let defToCreate: BundleMetadataObj[] = [];
    let bundleId: string;

    const existingBundle = (await this.toolingFind(this.metadataType, {
      DeveloperName: component.fullName
    }))[0];

    if (existingBundle) {
      bundleId = existingBundle.Id;
      await this.filterExistingSources(
        bundleId,
        bundleMetadataList,
        defToUpdate,
        defToCreate
      );
    } else {
      defToCreate = bundleMetadataList;
      const newBundle = await this.createBundle(component);
      bundleId = newBundle.id;
    }
    await this.updateSources(defToUpdate);
    await this.createSources(defToCreate, bundleId);

    // TODO: format output
    return {} as ToolingDeployResult;
  }

  private async toolingFind(
    type: string,
    record: object
  ): Promise<{ Id: string }[]> {
    return await this.connection.tooling.sobject(type).find(record);
  }

  public async filterExistingSources(
    bundleId: string,
    bundleMetadataList: BundleMetadataObj[],
    defToUpdate: BundleMetadataObj[],
    defToCreate: BundleMetadataObj[]
  ): Promise<void> {
    const bundleSources = (await this.toolingFind(
      supportedToolingTypes.get(this.metadataType),
      { [`${this.metadataType}Id`]: bundleId }
    )) as BundleMetadataObj[];

    for (const bundleMetadata of bundleMetadataList) {
      let match: BundleMetadataObj | undefined;
      if (this.metadataType === 'AuraDefinitionBundle') {
        match = bundleSources.find(
          obj => obj.DefType === bundleMetadata.DefType
        );
      } else {
        match = bundleSources.find(obj =>
          bundleMetadata.FilePath.includes(obj.FilePath)
        );
      }
      if (match) {
        defToUpdate.push(Object.assign(bundleMetadata, { Id: match.Id }));
      } else {
        defToCreate.push(bundleMetadata);
      }
    }
  }

  public async createBundle(
    component: MetadataComponent
  ): Promise<ToolingCreateResult> {
    const metadataContent = fs.readFileSync(component.xml, 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const bundleObject = {
      FullName: component.fullName,
      Metadata: metadataField
    };
    const newBundle = await this.toolingCreate(
      component.type.name,
      bundleObject
    );
    if (!newBundle.success) {
      const deployFailed = new Error();
      // deployFailed.message = nls.localize('beta_tapi_mdcontainer_error');
      deployFailed.name = `${this.metadataType}CreationFailed`;
      throw deployFailed;
    }
    return newBundle;
  }

  public async createSources(
    defToCreate: BundleMetadataObj[],
    bundleId: string
  ): Promise<void> {
    for (const resource of defToCreate) {
      const bundleObject = {
        [`${this.metadataType}Id`]: bundleId,
        ...(this.metadataType === 'AuraDefinitionBundle'
          ? { DefType: resource.DefType }
          : {}),
        FilePath: resource.FilePath,
        Format: resource.Format,
        Source: resource.Source
      };
      const createdResource = await this.toolingCreate(
        supportedToolingTypes.get(this.metadataType),
        bundleObject
      );

      if (!createdResource.success) {
        const deployFailed = new Error();
        // deployFailed.message = nls.localize('beta_tapi_mdcontainer_error');
        deployFailed.name = `${supportedToolingTypes.get(
          this.metadataType
        )}CreationFailed`;
        throw deployFailed;
      }
    }
  }

  public async updateSources(defToUpdate: BundleMetadataObj[]): Promise<void> {
    for (const resource of defToUpdate) {
      const auraDef = {
        Source: resource.Source,
        Id: resource.Id
      };
      const updatedResource = (await this.connection.tooling.update(
        supportedToolingTypes.get(this.metadataType),
        auraDef
      )) as ToolingCreateResult;

      if (!updatedResource.success) {
        const deployFailed = new Error();
        // deployFailed.message = nls.localize('beta_tapi_mdcontainer_error');
        deployFailed.name = `${supportedToolingTypes.get(
          this.metadataType
        )}UpdateFailed`;
        throw deployFailed;
      }
    }
  }

  public buildBundleList(component: MetadataComponent): BundleMetadataObj[] {
    const sourceFiles = component.sources;
    const bundleMetadataList: BundleMetadataObj[] = [];
    for (const sourceFile of sourceFiles) {
      const source = fs.readFileSync(sourceFile, 'utf8');
      const suffix = path.extname(sourceFile).split('.')[1];
      const format =
        this.metadataType === 'AuraDefinitionBundle'
          ? this.getAuraFormat(suffix)
          : suffix;
      const bundleMetadata = {
        FilePath: sourceFile,
        ...(this.metadataType === 'AuraDefinitionBundle'
          ? { DefType: this.getAuraDefType(sourceFile) }
          : {}),
        Source: source,
        Format: format
      };
      bundleMetadataList.push(bundleMetadata);
    }
    return bundleMetadataList;
  }

  private getAuraDefType(sourcePath: string): string {
    const suffix = path.extname(sourcePath).split('.')[1];
    const fileName = path.basename(sourcePath, suffix).split('.')[0];
    switch (suffix) {
      case 'app':
        return 'APPLICATION';
      case 'cmp':
        return 'COMPONENT';
      case 'auradoc':
        return 'DOCUMENTATION';
      case 'css':
        return 'STYLE';
      case 'evt':
        return 'EVENT';
      case 'design':
        return 'DESIGN';
      case 'svg':
        return 'SVG';
      case 'js':
        if (fileName.endsWith('Controller')) {
          return 'CONTROLLER';
        } else if (fileName.endsWith('Helper')) {
          return 'HELPER';
        } else if (fileName.endsWith('Renderer')) {
          return 'RENDERER';
        }
        break;
      case 'tokens':
        return 'TOKENS';
      case 'intf':
        return 'INTERFACE';
      default:
        return '';
    }
  }

  private getAuraFormat(suffix: string): string {
    switch (suffix) {
      case 'js':
        return 'JS';
      case 'css':
        return 'CSS';
      default:
        return 'XML';
    }
  }
}
