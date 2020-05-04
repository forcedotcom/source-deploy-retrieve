/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { AuraDefinition } from '../../utils/deploy';
import { extName, baseName } from '../../utils';
import { MetadataComponent, DeployResult, SourceResult } from '../../types';
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
        this.parseAuraError(e.message, auraDefinitions[0].FilePath)
      ];
      return this.formatBundleOutput(failures, true);
    }
  }

  public async buildDefList(): Promise<AuraDefinition[]> {
    const sourceFiles = this.component.sources;
    const auraDefinitions: AuraDefinition[] = [];

    const existingDefinitions = await this.findAuraDefinitions();
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

  private getAuraFormat(suffix: string): string {
    switch (suffix) {
      case 'js':
        return 'JS';
      case 'css':
        return 'CSS';
      case 'svg':
        return 'SVG';
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

  private async findAuraDefinitions(): Promise<AuraDefinition[]> {
    const auraDefResult = await this.connection.tooling.query(
      `Select AuraDefinitionBundleId, Id, Format, Source, DefType from AuraDefinition where AuraDefinitionBundle.DeveloperName = '${
        this.component.fullName
      }'`
    );
    return auraDefResult.records as AuraDefinition[];
  }

  private parseAuraError(error: string, defaultPath: string): SourceResult {
    try {
      const errLocation = error.slice(
        error.lastIndexOf('[') + 1,
        error.lastIndexOf(']')
      );

      const errorParts = error.split(' ');
      const fileType = errorParts.find(part => {
        part = part.toLowerCase();
        return (
          part.includes('controller') ||
          part.includes('renderer') ||
          part.includes('helper')
        );
      });
      let fileName: string;
      if (fileType) {
        fileName = this.component.sources.find(s =>
          s.toLowerCase().includes(fileType.toLowerCase())
        );
      } else {
        fileName = defaultPath;
      }

      const errObj = {
        ...(errLocation ? { lineNumber: errLocation.split(',')[0] } : {}),
        ...(errLocation ? { columnNumber: errLocation.split(',')[1] } : {}),
        problem: error,
        fileName: fileName,
        fullName: this.getFormattedPaths(fileName)[1],
        componentType: this.component.type.name,
        success: false,
        changed: false,
        created: false,
        deleted: false
      } as SourceResult;
      return errObj;
    } catch (e) {
      // log error with parsing error message
      const errObj = {
        problem: error,
        fileName: defaultPath,
        fullName: this.getFormattedPaths(defaultPath)[1],
        componentType: this.component.type.name,
        success: false,
        changed: false,
        created: false,
        deleted: false
      } as SourceResult;
      return errObj;
    }
  }
}
