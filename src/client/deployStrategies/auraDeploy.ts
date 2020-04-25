/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { sep } from 'path';
import { DeployError } from '../../errors';
import { AuraDefinition, ToolingCreateResult } from '../../utils/deploy';
import { extName, baseName } from '../../utils';
import {
  MetadataComponent,
  DeployResult,
  SourceResult,
  DeployStatusEnum
} from '../../types';
import { deployTypes } from '../toolingApi';
import { BaseDeploy } from './baseDeploy';
import { AURA_TYPES } from './index';

export class AuraDeploy extends BaseDeploy {
  public async deploy(component: MetadataComponent): Promise<DeployResult> {
    this.component = component;
    const auraDefinitions = await this.buildDefList();

    try {
      const promiseArray = auraDefinitions.map(async def => this.upsert(def));
      const results = await Promise.all(promiseArray);
      return this.formatBundleOutput(results);
    } catch (e) {
      const failures = [
        this.createDeployResult(
          auraDefinitions[0].FilePath,
          false,
          false,
          e.message
        )
      ];
      return this.formatBundleOutput(failures, true);
    }
  }

  public async buildDefList(): Promise<AuraDefinition[]> {
    const sourceFiles = this.component.sources;
    const auraDefinitions: AuraDefinition[] = [];

    const existingDefinitions = await this.findExistingDefinitions();
    let bundleId: string;
    if (existingDefinitions.length > 0) {
      bundleId = existingDefinitions[0].AuraDefinitionBundleId;
    } else {
      const newBundle = await this.createBundle();
      bundleId = newBundle.id;
    }

    sourceFiles.forEach(async sourceFile => {
      const source = readFileSync(sourceFile, 'utf8');
      const suffix = extName(sourceFile);
      const defType = this.getAuraDefType(sourceFile, suffix);
      const format = this.getAuraFormat(suffix);

      let match: AuraDefinition;
      if (existingDefinitions.length > 0) {
        match = existingDefinitions.find(
          definition => definition.DefType === defType
        );
      }

      const auraDef = {
        FilePath: sourceFile,
        DefType: defType,
        Source: source,
        Format: format,
        ...(match ? { Id: match.Id } : { AuraDefinitionBundleId: bundleId })
      };

      // This is to ensure we return the correct project path when reporting errors
      // must be the file associated with the specified aura type
      AURA_TYPES.includes(auraDef.DefType)
        ? auraDefinitions.unshift(auraDef)
        : auraDefinitions.push(auraDef);
    });

    return auraDefinitions;
  }

  public async createBundle(): Promise<ToolingCreateResult> {
    const metadataContent = readFileSync(this.component.xml, 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const bundleObject = {
      FullName: this.component.fullName,
      Metadata: metadataField
    };

    const newBundle = await this.toolingCreate(
      this.component.type.name,
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

  public async upsert(auraDef: AuraDefinition): Promise<SourceResult> {
    const type = this.component.type.name;

    if (auraDef.Id) {
      const formattedDef = {
        Source: auraDef.Source,
        Id: auraDef.Id
      };

      await this.connection.tooling.update(deployTypes.get(type), formattedDef);
      return this.createDeployResult(auraDef.FilePath, true, false);
    } else {
      const formattedDef = {
        AuraDefinitionBundleId: auraDef.AuraDefinitionBundleId,
        DefType: auraDef.DefType,
        Format: auraDef.Format,
        Source: auraDef.Source
      };

      await this.toolingCreate(deployTypes.get(type), formattedDef);
      return this.createDeployResult(auraDef.FilePath, true, true);
    }
  }

  public formatBundleOutput(
    deployResults: SourceResult[],
    failure?: boolean
  ): DeployResult {
    let toolingDeployResult: DeployResult;
    if (failure) {
      toolingDeployResult = {
        State: DeployStatusEnum.Failed,
        ErrorMsg: deployResults[0].problem,
        DeployDetails: {
          componentSuccesses: [],
          componentFailures: deployResults
        },
        isDeleted: false,
        metadataFile: this.component.xml
      };
    } else {
      toolingDeployResult = {
        State: DeployStatusEnum.Completed,
        DeployDetails: {
          componentSuccesses: deployResults,
          componentFailures: []
        },
        isDeleted: false,
        outboundFiles: this.component.sources,
        ErrorMsg: null,
        metadataFile: this.component.xml
      };
    }
    return toolingDeployResult;
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

  private async findExistingDefinitions(): Promise<AuraDefinition[]> {
    const auraDefResult = await this.connection.tooling.query(
      `Select AuraDefinitionBundleId, Id, Format, Source, DefType from AuraDefinition where AuraDefinitionBundle.DeveloperName = '${
        this.component.fullName
      }'`
    );
    return auraDefResult.records as AuraDefinition[];
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
}
