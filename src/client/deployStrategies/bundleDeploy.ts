/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { sep } from 'path';
import { DeployError } from '../../errors';
import {
  MetadataComponent,
  ToolingDeployResult,
  DeployDetailsResult,
  DeployResult,
  DeployStatusEnum
} from '../../types';
import { getSuffix, parseBaseName } from '../../utils';
import {
  AURA_DEF_BUNDLE,
  BundleMetadataObj,
  supportedToolingTypes,
  ToolingCreateResult
} from './index';
import { BaseDeploy } from './baseDeploy';

export class BundleDeploy extends BaseDeploy {
  public async deploy(
    component: MetadataComponent
  ): Promise<ToolingDeployResult> {
    this.component = component;
    const bundleMetadataList = this.buildBundleList();
    const defToUpdate: BundleMetadataObj[] = [];
    let defToCreate: BundleMetadataObj[] = [];
    let bundleId: string;

    const queryResult = await this.connection.tooling.query(
      this.buildQuery(
        `DeveloperName = '${component.fullName}'`,
        this.component.type.name
      )
    );
    // tslint:disable-next-line:array-type
    const existingBundle = queryResult.records as { Id: string }[];

    if (existingBundle.length > 0) {
      bundleId = existingBundle[0].Id;
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
    const updateResult = await this.updateSources(defToUpdate);
    const createResult = await this.createSources(defToCreate, bundleId);
    const output = this.formatBundleOutput(updateResult, createResult);
    return output;
  }

  public buildBundleList(): BundleMetadataObj[] {
    const sourceFiles = this.component.sources;
    const bundleMetadataList: BundleMetadataObj[] = [];
    const auraType = this.component.type.name === AURA_DEF_BUNDLE;

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, 'utf8');
      const suffix = getSuffix(sourceFile);
      const format = auraType ? this.getAuraFormat(suffix) : suffix;

      const bundleMetadata = {
        FilePath: sourceFile,
        ...(auraType
          ? { DefType: this.getAuraDefType(sourceFile, suffix) }
          : {}),
        Source: source,
        Format: format
      };

      !auraType && bundleMetadata.Format === 'js'
        ? bundleMetadataList.unshift(bundleMetadata)
        : bundleMetadataList.push(bundleMetadata);
    }
    return bundleMetadataList;
  }

  public async filterExistingSources(
    bundleId: string,
    bundleMetadataList: BundleMetadataObj[],
    defToUpdate: BundleMetadataObj[],
    defToCreate: BundleMetadataObj[]
  ): Promise<void> {
    const type = this.component.type.name;

    const queryString = ['Format, Source'];
    type === AURA_DEF_BUNDLE
      ? queryString.push('DefType')
      : queryString.push('FilePath');

    const queryResult = (await this.connection.tooling.query(
      this.buildQuery(
        `${type}Id = '${bundleId}'`,
        supportedToolingTypes.get(type),
        queryString
      )
    )) as { records: BundleMetadataObj[] };
    const existingSources = queryResult.records;

    for (const bundleMetadata of bundleMetadataList) {
      let match: BundleMetadataObj | undefined;
      if (type === AURA_DEF_BUNDLE) {
        match = existingSources.find(
          obj => obj.DefType === bundleMetadata.DefType
        );
      } else {
        match = existingSources.find(obj =>
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
    const metadataContent = readFileSync(component.xml, 'utf8');
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
      throw new DeployError(
        'error_creating_metadata_type',
        this.component.type.name
      );
    }
    return newBundle;
  }

  public async updateSources(
    defToUpdate: BundleMetadataObj[]
  ): Promise<DeployDetailsResult> {
    const successes: DeployResult[] = [];
    const failures: DeployResult[] = [];
    let filepath: string;
    try {
      for (const resource of defToUpdate) {
        filepath = resource.FilePath;
        const auraDef = {
          Source: resource.Source,
          Id: resource.Id
        };
        const resourceType = supportedToolingTypes.get(
          this.component.type.name
        );

        await this.connection.tooling.update(resourceType, auraDef);

        const updateResult = this.createDeployResult(filepath, true, false);
        successes.push(updateResult);
      }
    } catch (e) {
      const failureResult = this.createDeployResult(
        filepath,
        false,
        false,
        e.message
      );
      failures.push(failureResult);
    }
    return { componentSuccesses: successes, componentFailures: failures };
  }

  public async createSources(
    defToCreate: BundleMetadataObj[],
    bundleId: string
  ): Promise<DeployDetailsResult> {
    const successes: DeployResult[] = [];
    const failures: DeployResult[] = [];
    let filepath: string;
    try {
      for (const resource of defToCreate) {
        console.log(resource.FilePath);
        filepath = resource.FilePath;
        const type = this.component.type.name;
        const bundlePath = this.getBundlePath(filepath);

        const bundleObject = {
          [`${type}Id`]: bundleId,
          ...(type === AURA_DEF_BUNDLE
            ? { DefType: resource.DefType }
            : { FilePath: bundlePath }),
          Format: resource.Format,
          Source: resource.Source
        };
        const resourceType = supportedToolingTypes.get(type);

        await this.toolingCreate(resourceType, bundleObject);

        const createResult = this.createDeployResult(filepath, true, true);
        successes.push(createResult);
      }
    } catch (e) {
      const failureResult = this.createDeployResult(
        filepath,
        false,
        false,
        e.message
      );
      failures.push(failureResult);
    }
    return { componentSuccesses: successes, componentFailures: failures };
  }

  private getAuraDefType(sourcePath: string, suffix: string): string {
    const fileName = parseBaseName(sourcePath);
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

  private buildQuery(
    filter: string,
    typeName: string,
    expectedData?: string[]
  ): string {
    const criteria = expectedData ? `, ${expectedData.join()}` : '';
    return `Select Id${criteria} from ${typeName} where ${filter}`;
  }

  private createDeployResult(
    filepath: string,
    success: boolean,
    created: boolean,
    problem?: string
  ): DeployResult {
    const bundlePath = this.getBundlePath(filepath);
    const result = {
      success,
      deleted: false,
      fileName: bundlePath[0],
      fullName: bundlePath[1],
      componentType: this.component.type.name
    } as DeployResult;

    if (success) {
      result['created'] = created;
      result['changed'] = !created;
    } else {
      result['problem'] = problem;
      result['changed'] = false;
      result['created'] = false;
    }
    return result;
  }

  private getBundlePath(filepath: string): string[] {
    const pathParts = filepath.split(sep);

    const typeFolderIndex = pathParts.findIndex(
      part => part === this.component.type.directoryName
    );
    console.log('this is the index of the type' + typeFolderIndex);
    console.log('this is what is at the index ' + pathParts[typeFolderIndex]);
    return [
      pathParts.slice(typeFolderIndex).join(sep),
      pathParts.slice(typeFolderIndex + 1).join(sep)
    ];
  }

  private formatBundleOutput(
    updateResult: DeployDetailsResult,
    createResult: DeployDetailsResult
  ): ToolingDeployResult {
    const componentSuccesses = updateResult.componentSuccesses.concat(
      createResult.componentSuccesses
    );
    const componentFailures = updateResult.componentFailures.concat(
      createResult.componentFailures
    );

    const deployDetailsResult = {
      componentSuccesses,
      componentFailures
    } as DeployDetailsResult;

    let toolingDeployResult: ToolingDeployResult;

    if (componentFailures.length > 0) {
      toolingDeployResult = {
        State: DeployStatusEnum.Failed,
        ErrorMsg: componentFailures[0].problem,
        DeployDetails: deployDetailsResult,
        isDeleted: false
      };
    } else {
      toolingDeployResult = {
        State: DeployStatusEnum.Completed,
        DeployDetails: deployDetailsResult,
        isDeleted: false,
        outboundFiles: this.component.sources,
        ErrorMsg: null
      };
    }

    return toolingDeployResult;
  }
}
