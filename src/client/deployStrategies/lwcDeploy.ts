/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { BaseDeploy } from './baseDeploy';
import { SourceComponent } from '../..';
import {
  SourceDeployResult,
  ToolingDeployStatus,
  ComponentDeployment,
  ComponentStatus,
} from '../types';
import { LightningComponentResource } from '../../utils/deploy';
import { readFileSync } from 'fs';
import { extName } from '../../utils';
import { normalize } from 'path';
import { deployTypes } from '../toolingApi';
import { DiagnosticUtil } from '../diagnosticUtil';

export class LwcDeploy extends BaseDeploy {
  public async deploy(component: SourceComponent, namespace: string): Promise<SourceDeployResult> {
    this.component = component;
    this.namespace = namespace;

    const lwcResources = await this.buildResourceList();
    const componentDeployment = await this.upsert(lwcResources);
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
  public async buildResourceList(): Promise<LightningComponentResource[]> {
    const sourceFiles = this.component.walkContent();
    sourceFiles.push(this.component.xml);
    const lightningResources: LightningComponentResource[] = [];
    const existingResources = await this.findLightningResources();
    const lightningBundle = existingResources[0]
      ? await this.upsertBundle(existingResources[0].LightningComponentBundleId)
      : await this.upsertBundle();
    const bundleId = lightningBundle.id;
    sourceFiles.forEach(async (sourceFile) => {
      const source = readFileSync(sourceFile, 'utf8');
      const isMetaSource = sourceFile === this.component.xml;
      const format = isMetaSource ? 'js' : extName(sourceFile);
      let match: LightningComponentResource;
      if (existingResources.length > 0) {
        match = existingResources.find((resource) =>
          sourceFile.endsWith(normalize(resource.FilePath))
        );
      }
      // If resource exists in org, assign the matching Id
      // else, assign the id of the bundle it's associated with
      const lightningResource = {
        FilePath: sourceFile,
        Source: source,
        Format: format,
        ...(match ? { Id: match.Id } : { LightningComponentBundleId: bundleId }),
      };
      // This is to ensure that the base file is deployed first for lwc
      // otherwise there is a `no base file found` error
      lightningResource.Format === 'js' && !isMetaSource
        ? lightningResources.unshift(lightningResource)
        : lightningResources.push(lightningResource);
    });
    return lightningResources;
  }
  public async upsert(
    lightningResources: LightningComponentResource[]
  ): Promise<ComponentDeployment> {
    const type = this.component.type.name;
    const deployment: ComponentDeployment = {
      status: ComponentStatus.Unchanged,
      component: this.component,
      diagnostics: [],
    };

    const diagnosticUtil = new DiagnosticUtil('tooling');

    let partialSuccess = false;
    let allCreate = true;
    // first resource needs to be created first, so force sync
    for (const resource of lightningResources) {
      try {
        if (resource.Id) {
          const formattedDef = {
            Source: resource.Source,
            Id: resource.Id,
          };
          await this.connection.tooling.update(deployTypes.get(type), formattedDef);
          allCreate = false;
          partialSuccess = true;
        } else {
          const formattedDef = {
            LightningComponentBundleId: resource.LightningComponentBundleId,
            Format: resource.Format,
            Source: resource.Source,
            FilePath: this.getFormattedPaths(resource.FilePath)[0],
          };
          await this.toolingCreate(deployTypes.get(type), formattedDef);
        }
      } catch (e) {
        const diagnostic = diagnosticUtil.parseDeployDiagnostic(this.component, e.message);
        deployment.diagnostics.push(diagnostic);
      }
    }

    if (deployment.diagnostics.length > 0) {
      deployment.status = partialSuccess ? ComponentStatus.Changed : ComponentStatus.Failed;
    } else if (allCreate) {
      deployment.status = ComponentStatus.Created;
    } else {
      deployment.status = ComponentStatus.Changed;
    }

    return deployment;
  }

  private async findLightningResources(): Promise<LightningComponentResource[]> {
    const lightningResourceResult = await this.connection.tooling.query(
      `Select LightningComponentBundleId, Id, Format, Source, FilePath from LightningComponentResource where LightningComponentBundle.DeveloperName = '${this.component.fullName}' and LightningComponentBundle.NamespacePrefix = '${this.namespace}'`
    );
    return lightningResourceResult.records as LightningComponentResource[];
  }
}
