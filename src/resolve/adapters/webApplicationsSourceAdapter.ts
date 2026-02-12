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
import { join, sep } from 'node:path';
import { Messages } from '@salesforce/core/messages';
import { SfError } from '@salesforce/core/sfError';
import { SourcePath } from '../../common/types';
import { SourceComponent } from '../sourceComponent';
import { baseName } from '../../utils/path';
import { BundleSourceAdapter } from './bundleSourceAdapter';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

type WebApplicationConfig = {
  outputDir: string;
  routing: {
    trailingSlash: string;
    fallback: string;
    rewrites?: Array<{ route: string; rewrite: string }>;
  };
};

/**
 * Source adapter for WebApplication bundles.
 *
 * If `webapplication.json` is present (and not force-ignored) we validate its
 * required fields and check that the files it references exist on disk.
 * Otherwise we require a non-empty `dist/index.html`.
 */
export class WebApplicationsSourceAdapter extends BundleSourceAdapter {
  protected populate(
    trigger: SourcePath,
    component?: SourceComponent,
    isResolvingSource = true
  ): SourceComponent | undefined {
    const source = super.populate(trigger, component);
    if (!source?.content) {
      return source;
    }

    const contentPath = source.content;
    const appName = baseName(contentPath);
    const expectedXmlPath = join(contentPath, `${appName}.webapplication-meta.xml`);
    if (!this.tree.exists(expectedXmlPath)) {
      this.expectedSourceError(expectedXmlPath);
    }

    const resolvedSource =
      source.xml === expectedXmlPath
        ? source
        : new SourceComponent(
            {
              name: source.name,
              type: source.type,
              content: source.content,
              xml: expectedXmlPath,
              parent: source.parent,
              parentType: source.parentType,
            },
            this.tree,
            this.forceIgnore
          );

    if (isResolvingSource) {
      const descriptorPath = join(contentPath, 'webapplication.json');
      const hasDescriptor = this.tree.exists(descriptorPath) && !this.forceIgnore.denies(descriptorPath);

      if (hasDescriptor) {
        this.validateDescriptor(descriptorPath, contentPath);
      } else {
        this.validateDistFolder(contentPath);
      }
    }

    return resolvedSource;
  }

  private validateDistFolder(contentPath: SourcePath): void {
    const distPath = join(contentPath, 'dist');
    const indexPath = join(distPath, 'index.html');

    if (!this.tree.exists(distPath) || !this.tree.isDirectory(distPath)) {
      throw new SfError(
        "When webapplication.json is not present, a 'dist' folder containing 'index.html' is required. The 'dist' folder was not found.",
        'ExpectedSourceFilesError'
      );
    }
    if (!this.tree.exists(indexPath)) {
      throw new SfError(
        "When webapplication.json is not present, a 'dist/index.html' file is required as the entry point. The file was not found.",
        'ExpectedSourceFilesError'
      );
    }
    if (this.tree.readFileSync(indexPath).length === 0) {
      throw new SfError(
        "When webapplication.json is not present, 'dist/index.html' must exist and be non-empty. The file was found but is empty.",
        'ExpectedSourceFilesError'
      );
    }
  }

  private validateDescriptor(descriptorPath: SourcePath, contentPath: SourcePath): void {
    const raw = this.tree.readFileSync(descriptorPath);
    let config: WebApplicationConfig;

    try {
      config = JSON.parse(raw.toString('utf8')) as WebApplicationConfig;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new SfError(`Invalid JSON in webapplication.json: ${detail}`, 'InvalidJsonError');
    }

    if (!config.outputDir || typeof config.outputDir !== 'string') {
      throw new SfError(
        "webapplication.json is missing required field 'outputDir'",
        'InvalidWebApplicationConfigError'
      );
    }
    const outputDirPath = join(contentPath, config.outputDir);
    if (!this.tree.exists(outputDirPath) || !this.tree.isDirectory(outputDirPath)) {
      this.expectedSourceError(outputDirPath);
    }

    if (!config.routing || typeof config.routing !== 'object') {
      throw new SfError("webapplication.json is missing required field 'routing'", 'InvalidWebApplicationConfigError');
    }
    if (!config.routing.trailingSlash || typeof config.routing.trailingSlash !== 'string') {
      throw new SfError(
        "webapplication.json is missing required field 'routing.trailingSlash'",
        'InvalidWebApplicationConfigError'
      );
    }
    if (!config.routing.fallback || typeof config.routing.fallback !== 'string') {
      throw new SfError(
        "webapplication.json is missing required field 'routing.fallback'",
        'InvalidWebApplicationConfigError'
      );
    }

    // Strip leading path separator (path.sep and / for URL-style paths)
    const sepChar = sep.replace(/\\/g, '\\\\');
    const stripLeadingSep = (p: string) => p.replace(new RegExp(`^[${sepChar}/]`), '');
    const fallbackPath = join(outputDirPath, stripLeadingSep(config.routing.fallback));
    if (!this.tree.exists(fallbackPath)) {
      throw new SfError(
        "The filepath defined in the webapplication.json -> routing.fallback was not found. Ensure this file exists at the location defined.",
        'ExpectedSourceFilesError'
      );
    }

    // rewrites are optional, but every target must resolve
    if (Array.isArray(config.routing.rewrites)) {
      for (const { rewrite } of config.routing.rewrites) {
        if (rewrite) {
          const rewritePath = join(outputDirPath, stripLeadingSep(rewrite));
          if (!this.tree.exists(rewritePath)) {
            this.expectedSourceError(rewritePath);
          }
        }
      }
    }
  }

  private expectedSourceError(path: SourcePath): never {
    throw new SfError(
      messages.getMessage('error_expected_source_files', [path, this.type.name]),
      'ExpectedSourceFilesError'
    );
  }
}
