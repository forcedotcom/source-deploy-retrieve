/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from 'fs/promises';
import { Transform } from 'stream';
import { SfProject } from '@salesforce/core';
import * as minimatch from 'minimatch';
import { MarkedReplacement, ReplacementConfig } from '../resolve/types';
import { SourceComponent } from '../resolve/sourceComponent';

const fileContentsCache = new Map<string, string>();

export const readReplacementsFromProject = async (): Promise<ReplacementConfig[]> => {
  const proj = await SfProject.resolve();
  const projJson = (await proj.resolveProjectConfig()) as { replacements?: ReplacementConfig[] };
  return projJson.replacements;
};

export const getReplacementStream = async (): Promise<ReplacementMarkingStream | undefined> => {
  // remove any that don't agree with current env
  const filteredReplacements = envFilter(await readReplacementsFromProject());
  if (filteredReplacements.length) {
    return new ReplacementMarkingStream(filteredReplacements);
  }
};
/**
 * Stream for marking replacements on a component.
 * Returns a mutated component with a `replacements` property if replacements are found.
 */
export class ReplacementMarkingStream extends Transform {
  public constructor(private readonly replacementConfigs: ReplacementConfig[]) {
    super({ objectMode: true });
  }

  public async _transform(
    chunk: SourceComponent,
    encoding: string,
    callback: (err: Error, data: SourceComponent) => void
  ): Promise<void> {
    let err: Error;
    // if deleting, or no configs, just pass through
    if (!chunk.isMarkedForDelete() && this.replacementConfigs?.length) {
      try {
        chunk.replacements = await getReplacements(chunk, this.replacementConfigs);
      } catch (e) {
        if (!(e instanceof Error)) {
          throw e;
        }
        err = e;
      }
    }
    callback(err, chunk);
  }
}

export const getContents = async (path: string): Promise<string> => {
  if (!fileContentsCache.has(path)) {
    fileContentsCache.set(path, await readFile(path, 'utf8'));
  }
  return fileContentsCache.get(path);
};

/**
 * Regardless of any components, return the ReplacementConfig that are valid with the current env.
 * These can be checked globally and don't need to be checked per component.
 */
export const envFilter = (replacementConfigs: ReplacementConfig[] = []): ReplacementConfig[] =>
  replacementConfigs.filter(
    (replacement) =>
      !replacement.replaceWhenEnv ||
      replacement.replaceWhenEnv.every((envConditional) => process.env[envConditional.env] === envConditional.value)
  );

/**
 * Build the replacements property for a sourceComponent
 */
export const getReplacements = async (
  cmp: SourceComponent,
  replacementConfigs: ReplacementConfig[] = []
): Promise<SourceComponent['replacements']> => {
  // all possible filenames for this component
  const filenames = [cmp.xml, ...cmp.walkContent()].filter(Boolean);
  // eslint-disable-next-line no-console
  const replacementsForComponent = (
    await Promise.all(
      filenames.map(
        async (f): Promise<[string, MarkedReplacement[]]> => [
          f,
          await Promise.all(
            replacementConfigs
              .filter((r) => matchesFile(f, r))
              .map(async (r) => ({
                toReplace: r.stringToReplace ?? new RegExp(r.regexToReplace),
                replaceWith: r.replaceWithEnv ? process.env[r.replaceWithEnv] : await getContents(r.replaceWithFile),
              }))
          ),
        ]
      )
    )
  ).filter(([, replacements]) => replacements.length > 0);

  if (replacementsForComponent.length) {
    return Object.fromEntries(replacementsForComponent);
  }
};

export const matchesFile = (f: string, r: ReplacementConfig): boolean =>
  r.filename === f || (r.glob && minimatch(f, r.glob));
