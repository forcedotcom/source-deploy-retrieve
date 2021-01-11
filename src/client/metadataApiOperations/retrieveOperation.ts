/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Connection } from '@salesforce/core';
import { SourceRetrieveResult } from '..';
import {
  ConvertOutputConfig,
  MetadataConverter,
  MetadataResolver,
  SourceComponent,
  ZipTreeContainer,
} from '../..';
import { MetadataComponent } from '../../common';
import { MetadataPackage } from '../../package';
import { DiagnosticUtil } from '../diagnosticUtil';
import { ComponentRetrieval, RequestStatus, RetrieveResult } from '../types';
import { MetadataApiOperation } from './metadataApiOperation';

interface RetrieveOptions {
  merge?: boolean;
  defaultDirectory?: string;
  // unzip?: boolean;
}

export class RetrieveOperation extends MetadataApiOperation<RetrieveResult, SourceRetrieveResult> {
  private mdp: MetadataPackage;
  private options?: RetrieveOptions;

  constructor(connection: Connection, mdp: MetadataPackage, options?: RetrieveOptions) {
    super(connection);
    this.mdp = mdp;
    this.options = options;
  }

  protected async doCancel(): Promise<boolean> {
    // retrieve doesn't require signaling to the server to stop
    return true;
  }

  protected async pre(): Promise<{ id: string }> {
    // @ts-ignore required callback
    return this.connection.metadata.retrieve({
      apiVersion: this.mdp.apiVersion,
      unpackaged: this.mdp.getObject().Package,
    });
  }

  protected checkStatus(id: string): Promise<RetrieveResult> {
    // Recasting to use the project's RetrieveResult type
    return (this.connection.metadata.checkRetrieveStatus(id) as unknown) as Promise<RetrieveResult>;
  }

  protected async post(result: RetrieveResult): Promise<SourceRetrieveResult> {
    let components: SourceComponent[] = [];
    if (result.status === RequestStatus.Succeeded) {
      components = await this.extract(result);
    }
    return this.createSourceRetrieveResult(result, components);
  }

  private async extract(result: RetrieveResult): Promise<SourceComponent[]> {
    const tree = await ZipTreeContainer.create(Buffer.from(result.zipFile, 'base64'));
    const zipComponents = new MetadataResolver(undefined, tree).getComponentsFromPath('.');
    const converter = new MetadataConverter();

    let outputConfig: ConvertOutputConfig;

    if (this.options?.merge) {
      if (!this.options?.defaultDirectory) {
        throw new Error('needs to be a default directory with the merge flag');
      }
      outputConfig = {
        type: 'merge',
        mergeWith: this.mdp.getSourceComponents()?.getAll() || [],
        defaultDirectory: this.options.defaultDirectory,
      };
    } else {
      outputConfig = {
        type: 'directory',
        outputDirectory: this.options.defaultDirectory,
      };
    }
    const convertResult = await converter.convert(zipComponents, 'source', outputConfig);
    if (this.options?.merge) {
      // TODO: W-8220616: this returns incomplete information about the retrieve
      return zipComponents;
    }
    return new MetadataResolver().getComponentsFromPath(convertResult.packagePath);
  }

  private createSourceRetrieveResult(
    result: RetrieveResult,
    extractedComponents: SourceComponent[]
  ): SourceRetrieveResult {
    const componentRetrievals = extractedComponents.map((component) => {
      return { component, status: result.status } as ComponentRetrieval;
    });
    const success = this.calculateSuccess(result, componentRetrievals);

    const sourceRetrieveResult: SourceRetrieveResult = {
      status: success ? RequestStatus.Succeeded : RequestStatus.Failed,
      id: result.id,
      success,
    };

    sourceRetrieveResult.components = componentRetrievals || [];
    sourceRetrieveResult.messages = [];

    if (result.messages) {
      const diagnosticUtil = new DiagnosticUtil('metadata');
      const messages = Array.isArray(result.messages) ? result.messages : [result.messages];

      for (const retrieveMessage of messages) {
        let existingRetrieval: ComponentRetrieval;
        let failedComponent: MetadataComponent;
        const matches = retrieveMessage.problem.match(/.+'(.+)'.+'(.+)'/);
        if (matches && Array.isArray(matches)) {
          const [fullName] = matches.slice(2);

          existingRetrieval = componentRetrievals.find((retrieval) => {
            return retrieval.component.fullName === fullName;
          });
          failedComponent = this.mdp
            .getComponents()
            .getAll()
            .find((component) => component.fullName === fullName);
        }

        if (existingRetrieval) {
          diagnosticUtil.setRetrieveDiagnostic(retrieveMessage.problem, existingRetrieval);
        } else if (failedComponent) {
          const failedRetrieval: ComponentRetrieval = {
            component: failedComponent as SourceComponent,
            status: sourceRetrieveResult.status,
          };
          diagnosticUtil.setRetrieveDiagnostic(retrieveMessage.problem, failedRetrieval);
          sourceRetrieveResult.components.push(failedRetrieval);
        } else {
          sourceRetrieveResult.messages.push(retrieveMessage);
        }
      }
    }

    return sourceRetrieveResult;
  }

  private calculateSuccess(
    retrieveResult: RetrieveResult,
    components: ComponentRetrieval[]
  ): boolean {
    return (
      (retrieveResult.status === RequestStatus.Succeeded &&
        this.mdp.getComponents().size === components.length &&
        !retrieveResult.hasOwnProperty('messages')) ||
      retrieveResult.status === RequestStatus.InProgress ||
      retrieveResult.status === RequestStatus.Pending
    );
  }
}
