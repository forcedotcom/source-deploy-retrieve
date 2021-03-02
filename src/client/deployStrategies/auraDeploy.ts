/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFileSync } from 'fs';
import { AuraDefinition } from '../../utils/deploy';
import { extName, baseName } from '../../utils';
import { SourcePath } from '../../common';
import {
  ComponentStatus,
  ComponentDeployment,
  ToolingDeployStatus,
  SourceDeployResult,
} from '../types';
import { deployTypes } from '../toolingApi';
import { BaseDeploy } from './baseDeploy';
import { SourceComponent } from '../../metadata-registry';
import { DiagnosticUtil } from '../diagnosticUtil';

export class AuraDeploy extends BaseDeploy {
  private static readonly AURA_DEF_TYPES = ['APPLICATION', 'COMPONENT', 'EVENT', 'INTERFACE'];

  public async deploy(component: SourceComponent, namespace: string): Promise<SourceDeployResult> {
    this.component = component;
    this.namespace = namespace;
    const auraDefinitions = await this.buildDefList();
    const componentDeployment = await this.upsert(auraDefinitions);
    let status = ToolingDeployStatus.Completed;
    if (componentDeployment.diagnostics.length > 0) {
      status =
        componentDeployment.status !== ComponentStatus.Failed
          ? ToolingDeployStatus.CompletedPartial
          : ToolingDeployStatus.Failed;
    }
    return {
      id: undefined,
      status,
      success: status === ToolingDeployStatus.Completed,
      components: [componentDeployment],
    };
  }

  public async buildDefList(): Promise<AuraDefinition[]> {
    const sourceFiles = this.component.walkContent();
    const auraDefinitions: AuraDefinition[] = [];

    const existingDefinitions = await this.findAuraDefinitions();
    const auraBundle = existingDefinitions[0]
      ? await this.upsertBundle(existingDefinitions[0].AuraDefinitionBundleId)
      : await this.upsertBundle();
    const bundleId = auraBundle.id;

    sourceFiles.forEach(async (sourceFile: SourcePath) => {
      const source = readFileSync(sourceFile, 'utf8');
      const suffix = extName(sourceFile);
      const defType = this.getAuraDefType(sourceFile, suffix);
      const format = this.getAuraFormat(suffix);

      let match: AuraDefinition;
      if (existingDefinitions.length > 0) {
        match = existingDefinitions.find((definition) => definition.DefType === defType);
      }

      // If definition exists in org, assign the matching Id
      // else, assign the id of the bundle it's associated with
      const auraDef = {
        FilePath: sourceFile,
        DefType: defType,
        Source: source,
        Format: format,
        ...(match ? { Id: match.Id } : { AuraDefinitionBundleId: bundleId }),
      };

      // This is to ensure we return the correct project path when reporting errors
      // must be the file associated with the specified aura type
      AuraDeploy.AURA_DEF_TYPES.includes(auraDef.DefType)
        ? auraDefinitions.unshift(auraDef)
        : auraDefinitions.push(auraDef);
    });

    return auraDefinitions;
  }

  public async upsert(auraDefinitions: AuraDefinition[]): Promise<ComponentDeployment> {
    const type = this.component.type.name;
    const diagnosticUtil = new DiagnosticUtil('tooling');
    const deployment: ComponentDeployment = {
      status: ComponentStatus.Unchanged,
      component: this.component,
      diagnostics: [],
    };

    let partialSuccess = false;
    let allCreate = true;
    const deployPromises = auraDefinitions.map(
      async (definition): Promise<void> => {
        try {
          if (definition.Id) {
            const formattedDef = {
              Source: definition.Source,
              Id: definition.Id,
            };
            await this.connection.tooling.update(deployTypes.get(type), formattedDef);
            allCreate = false;
            partialSuccess = true;
          } else {
            const formattedDef = {
              AuraDefinitionBundleId: definition.AuraDefinitionBundleId,
              DefType: definition.DefType,
              Format: definition.Format,
              Source: definition.Source,
            };
            await this.toolingCreate(deployTypes.get(type), formattedDef);
            partialSuccess = true;
          }
        } catch (e) {
          const diagnostic = diagnosticUtil.parseDeployDiagnostic(this.component, e.message);
          deployment.diagnostics.push(diagnostic);
        }
      }
    );

    await Promise.all(deployPromises);

    if (deployment.diagnostics.length > 0) {
      deployment.status = partialSuccess ? ComponentStatus.Changed : ComponentStatus.Failed;
    } else if (allCreate) {
      deployment.status = ComponentStatus.Created;
    } else {
      deployment.status = ComponentStatus.Changed;
    }

    return deployment;
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
      `Select AuraDefinitionBundleId, Id, Format, Source, DefType from AuraDefinition where AuraDefinitionBundle.DeveloperName = '${this.component.fullName}' and AuraDefinitionBundle.NamespacePrefix = '${this.namespace}'`
    );
    return auraDefResult.records as AuraDefinition[];
  }
}
