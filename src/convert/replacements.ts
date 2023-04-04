/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { readFile } from 'fs/promises';
import { Transform, Readable } from 'stream';
import { Lifecycle, SfError, SfProject } from '@salesforce/core';
import * as minimatch from 'minimatch';
import { Env } from '@salesforce/kit';
import { ensureString, isString } from '@salesforce/ts-types';
import { SourcePath } from '../common';
import { SourceComponent } from '../resolve/sourceComponent';
import { MarkedReplacement, ReplacementConfig, ReplacementEvent } from './types';

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
    let error: Error | undefined;
    // read and do the various replacements
    callback(error, Buffer.from(await replacementIterations(chunk.toString(), this.replacements)));
  }
}

/**
 * perform an array of replacements on a string
 * emits warnings when an expected replacement target isn't found
 */
export const replacementIterations = async (input: string, replacements: MarkedReplacement[]): Promise<string> => {
  const lifecycleInstance = Lifecycle.getInstance();
  let output = input;
  for (const replacement of replacements) {
    // TODO: node 16+ has String.replaceAll for non-regex scenarios
    const regex =
      typeof replacement.toReplace === 'string' ? new RegExp(replacement.toReplace, 'g') : replacement.toReplace;
    const replaced = output.replace(regex, replacement.replaceWith);

    if (replaced !== output) {
      output = replaced;
      // eslint-disable-next-line no-await-in-loop
      await lifecycleInstance.emit('replacement', {
        filename: replacement.matchedFilename,
        replaced: replacement.toReplace.toString(),
      } as ReplacementEvent);
    } else if (replacement.singleFile) {
      // replacements need to be done sequentially
      // eslint-disable-next-line no-await-in-loop
      await lifecycleInstance.emitWarning(
        `Your sfdx-project.json specifies that ${replacement.toReplace.toString()} should be replaced in ${
          replacement.matchedFilename
        }, but it was not found.`
      );
    }
  }
  return output;
};

/**
 * Reads the project, gets replacements, removes any that aren't applicable due to environment conditionals, and returns an instance of the ReplacementMarkingStream
 */
export const getReplacementMarkingStream = async (
  projectDir?: string
): Promise<ReplacementMarkingStream | undefined> => {
  // remove any that don't agree with current env
  const filteredReplacements = envFilter(await readReplacementsFromProject(projectDir));
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
    callback: (err: Error | undefined, data: SourceComponent) => void
  ): Promise<void> {
    let err: Error | undefined;
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

export const getContentsOfReplacementFile = async (path: string): Promise<string> => {
  if (!fileContentsCache.has(path)) {
    try {
      fileContentsCache.set(path, (await readFile(path, 'utf8')).trim());
    } catch (e) {
      throw new SfError(
        `The file "${path}" specified in the "replacements" property of sfdx-project.json could not be read.`
      );
    }
  }
  const output = fileContentsCache.get(path);
  if (!output) {
    throw new SfError(
      `The file "${path}" specified in the "replacements" property of sfdx-project.json could not be read.`
    );
  }
  return output;
};

/**
 * Build the replacements property for a sourceComponent
 */
export const getReplacements = async (
  cmp: SourceComponent,
  replacementConfigs: ReplacementConfig[] = []
): Promise<SourceComponent['replacements'] | undefined> => {
  // all possible filenames for this component
  const filenames = [cmp.xml, ...cmp.walkContent()].filter(isString);
  const replacementsForComponent = (
    await Promise.all(
      // build a nested array that can be run through Object.fromEntries
      // one MarkedReplacement[] for each file in the component
      filenames.map(
        async (f): Promise<[string, MarkedReplacement[]]> => [
          f,
          await Promise.all(
            replacementConfigs
              // filter out any that don't match the current file
              .filter((r) => matchesFile(f, r))
              .map(async (r) => ({
                matchedFilename: f,
                // used during replacement stream to limit warnings to explicit filenames, not globs
                singleFile: Boolean(r.filename),
                // Config is json which might use the regex.  If so, turn it into an actual regex
                toReplace:
                  typeof r.stringToReplace === 'string'
                    ? stringToRegex(r.stringToReplace)
                    : new RegExp(r.regexToReplace, 'g'),
                // get the literal replacement (either from env or file contents)
                replaceWith:
                  typeof r.replaceWithEnv === 'string'
                    ? getEnvValue(r.replaceWithEnv)
                    : await getContentsOfReplacementFile(r.replaceWithFile),
              }))
          ),
        ]
      )
    )
  )
    // filter out any that don't have any replacements
    .filter(([, replacements]) => replacements.length > 0);

  if (replacementsForComponent.length) {
    // turn into a Dictionary-style object so it's easier to lookup by filename
    return Object.fromEntries(replacementsForComponent);
  }
};

export const matchesFile = (f: string, r: ReplacementConfig): boolean =>
  // filenames will be absolute.  We don't have convenient access to the pkgDirs,
  // so we need to be more open than an exact match
  Boolean((r.filename && f.endsWith(r.filename)) || (r.glob && minimatch(f, `**/${r.glob}`)));

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

/** A "getter" for envs to throw an error when an expected env is not present */
const getEnvValue = (env: string): string =>
  ensureString(
    new Env().getString(env),
    `"${env}" is in sfdx-project.json as a value for "replaceWithEnv" property, but it's not set in your environment.`
  );

/**
 * Read the `replacement` property from sfdx-project.json
 */
const readReplacementsFromProject = async (projectDir?: string): Promise<ReplacementConfig[]> => {
  const proj = await SfProject.resolve(projectDir);
  const projJson = (await proj.resolveProjectConfig()) as { replacements?: ReplacementConfig[] };
  return projJson.replacements ?? [];
};

/** escape any special characters used in the string so it can be used as a regex */
export const stringToRegex = (input: string): RegExp =>
  // being overly conservative
  // eslint-disable-next-line no-useless-escape
  new RegExp(input.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
