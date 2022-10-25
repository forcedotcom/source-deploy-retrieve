/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { join } from 'path';
import { readFile } from 'fs/promises';
import { Transform, Readable } from 'stream';
import { Lifecycle, SfError, SfProject } from '@salesforce/core';
import * as minimatch from 'minimatch';
import { SourcePath } from '../common';
import { SourceComponent } from '../resolve/sourceComponent';
import { MarkedReplacement, ReplacementConfig } from './types';

const fileContentsCache = new Map<string, string>();

/** If a component has replacements, you get it piped through the replacementStream
 * Otherwise, you'll get the original readable stream
 */
export const getReplacementStreamForReadable = (
  component: SourceComponent,
  path: SourcePath
): Readable | ReplacementStream =>
  component.replacements?.[path]
    ? component.tree.stream(path).pipe(new ReplacementStream(component.replacements?.[path]))
    : component.tree.stream(path);

/**
 * A stream for replacing the contents of a single SourceComponent.
 *
 */
class ReplacementStream extends Transform {
  public constructor(private readonly replacements: MarkedReplacement[]) {
    super({ objectMode: true });
  }

  public async _transform(
    chunk: Buffer,
    encoding: string,
    callback: (error?: Error, data?: Buffer) => void
  ): Promise<void> {
    let error: Error;
    // read and do the various replacements
    callback(error, Buffer.from(await replacementIterations(chunk.toString(), this.replacements)));
  }
}

/**
 * perform an array of replacements on a string
 * emits warnings when an expected replacement target isn't found
 */
export const replacementIterations = async (input: string, replacements: MarkedReplacement[]): Promise<string> => {
  let output = input;
  for (const replacement of replacements) {
    // TODO: node 16+ has String.replaceAll for non-regex scenarios
    const regex =
      typeof replacement.toReplace === 'string' ? new RegExp(replacement.toReplace, 'g') : replacement.toReplace;
    const replaced = output.replace(regex, replacement.replaceWith);
    if (replaced === output) {
      // replacements need to be done sequentially
      // eslint-disable-next-line no-await-in-loop
      await Lifecycle.getInstance().emitWarning(
        `Your sfdx-project.json specifies that ${replacement.toReplace.toString()} should be replaced, but it was not found.`
      );
    }
    output = replaced;
  }
  return output;
};

/**
 * Read the `replacement` property from sfdx-project.json
 */
const readReplacementsFromProject = async (): Promise<ReplacementConfig[]> => {
  const proj = await SfProject.resolve();
  const projJson = (await proj.resolveProjectConfig()) as { replacements?: ReplacementConfig[] };
  return projJson.replacements;
};

/**
 * Reads the project, gets replacements, removes an that aren't applicable due ot environment conditionals, and returns an instance of the ReplacementMarkingStream
 */
export const getReplacementMarkingStream = async (): Promise<ReplacementMarkingStream | undefined> => {
  // remove any that don't agree with current env
  const filteredReplacements = envFilter(await readReplacementsFromProject());
  if (filteredReplacements.length) {
    return new ReplacementMarkingStream(filteredReplacements);
  }
};

/**
 * Stream for marking replacements on a component.
 * Returns a mutated component with a `replacements` property if any replacements are found.
 * Throws if any replacements reference a file or env that does not exist
 */
class ReplacementMarkingStream extends Transform {
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
    try {
      fileContentsCache.set(path, await readFile(path, 'utf8'));
    } catch (e) {
      throw new SfError(
        `The file "${path}" specified in the "replacements" property of sfdx-project.json could not be read.`
      );
    }
  }
  return fileContentsCache.get(path);
};

/**
 * Regardless of any components, return the ReplacementConfig that are valid with the current env.
 * These can be checked globally and don't need to be checked per component.
 */
const envFilter = (replacementConfigs: ReplacementConfig[] = []): ReplacementConfig[] =>
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
                toReplace: r.stringToReplace ?? new RegExp(r.regexToReplace, 'g'),
                replaceWith: r.replaceWithEnv ? getEnvValue(r.replaceWithEnv) : await getContents(r.replaceWithFile),
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
  // filenames will be absolute.  We don't have convenient access to the pkgDirs,
  // so we need to be more open than an exact match
  f.endsWith(r.filename) || (r.glob && minimatch(f, join('**', r.glob)));

const getEnvValue = (env: string): string => {
  if (process.env[env]) {
    return process.env[env];
  }
  throw new SfError(
    `"${env}" is in sfdx-project.json as a value for "replaceWithEnv" property, but it's not set in your environment.`
  );
};
