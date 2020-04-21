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
  BundleMetadataObj,
  supportedToolingTypes,
  ToolingCreateResult
} from '../../utils/deploy';
import {
  MetadataComponent,
  DeployResult,
  DeployDetails,
  SourceResult,
  DeployStatusEnum
} from '../../types';
import { extName, baseName } from '../../utils/path';
import { BaseDeploy } from './baseDeploy';

export class BundleDeploy extends BaseDeploy {
  public async deploy(component: MetadataComponent): Promise<DeployResult> {
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
    // const updateResult = await this.updateSources(defToUpdate);
    const createResult = await this.createSources(defToCreate, bundleId);
    const output = this.formatBundleOutput([createResult]);
    return output;
  }

  public buildBundleList(): BundleMetadataObj[] {
    const sourceFiles = this.component.sources;
    const bundleMetadataList: BundleMetadataObj[] = [];

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, 'utf8');
      const suffix = extName(sourceFile);
      const format = this.getAuraFormat(suffix);

      const bundleMetadata = {
        FilePath: sourceFile,
        DefType: this.getAuraDefType(sourceFile, suffix),
        Source: source,
        Format: format
      };

      bundleMetadataList.push(bundleMetadata);
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

    const queryString = ['Format', 'Source', 'DefType'];
    const queryResult = (await this.connection.tooling.query(
      this.buildQuery(
        `${type}Id = '${bundleId}'`,
        supportedToolingTypes.get(type),
        queryString
      )
    )) as { records: BundleMetadataObj[] };
    const existingSources = queryResult.records;

    for (const bundleMetadata of bundleMetadataList) {
      const match = existingSources.find(
        obj => obj.DefType === bundleMetadata.DefType
      );

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

  public async createSources(
    defToCreate: BundleMetadataObj[],
    bundleId: string
  ): Promise<DeployDetails> {
    let successes: SourceResult[] = [];
    const failures: SourceResult[] = [];
    const type = this.component.type.name;
    let filepath: string;

    const promiseArray = defToCreate.map(async def => {
      const formattedDef = {
        [`${type}Id`]: bundleId,
        DefType: def.DefType,
        Format: def.Format,
        Source: def.Source
      };

      await this.toolingCreate(supportedToolingTypes.get(type), formattedDef);
      const createResult = this.createDeployResult(def.FilePath, true, true);
      return createResult;
    });

    try {
      successes = await Promise.all(promiseArray);
    } catch (e) {}

    return { componentSuccesses: successes, componentFailures: failures };
  }

  private getAuraDefType(sourcePath: string, suffix: string): string {
    const fileName = baseName(sourcePath);
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
  ): SourceResult {
    const formattedPaths = this.getFormattedPaths(filepath);
    const result = {
      success,
      deleted: false,
      fileName: formattedPaths[0],
      fullName: formattedPaths[1],
      componentType: this.component.type.name
    } as SourceResult;

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

  private getFormattedPaths(filepath: string): string[] {
    const pathParts = filepath.split(sep);

    const typeFolderIndex = pathParts.findIndex(
      part => part === this.component.type.directoryName
    );

    return [
      pathParts.slice(typeFolderIndex).join(sep),
      pathParts.slice(typeFolderIndex + 1).join(sep)
    ];
  }

  private formatBundleOutput(deployResults: DeployDetails[]): DeployResult {
    const componentSuccesses = deployResults[0].componentSuccesses.concat(
      deployResults[1].componentSuccesses
    );
    const componentFailures = deployResults[0].componentFailures.concat(
      deployResults[1].componentFailures
    );

    const deployDetailsResult = {
      componentSuccesses,
      componentFailures
    } as DeployDetails;

    let toolingDeployResult: DeployResult;

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
