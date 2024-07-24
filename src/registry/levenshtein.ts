/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core/messages';
import * as Levenshtein from 'fast-levenshtein';
import { MetadataRegistry } from './types';

Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('@salesforce/source-deploy-retrieve', 'sdr');

/** "did you mean" for Metadata type names */
export const getTypeSuggestions = (registry: MetadataRegistry, typeName: string): string[] => {
  const scores = getScores(
    Object.values(registry.types).map((t) => t.name),
    typeName
  );

  const guesses = getLowestScores(scores);
  return guesses.length
    ? [
        'Did you mean one of the following types?',
        ...guesses.map((guess) => guess.registryKey),
        ...messages.getMessages('type_name_suggestions'),
      ]
    : messages.getMessages('type_name_suggestions');
};

export const getSuffixGuesses = (suffixes: string[], input: string): string[] => {
  const scores = getScores(suffixes, input);
  return getLowestScores(scores).map((g) => g.registryKey);
};

type LevenshteinScore = {
  registryKey: string;
  score: number;
};

const getScores = (choices: string[], input: string): LevenshteinScore[] =>
  choices.map((registryKey) => ({
    registryKey,
    score: Levenshtein.get(input, registryKey, { useCollator: true }),
  }));

/** Levenshtein uses positive integers for scores, find all scores that match the lowest score */
const getLowestScores = (scores: LevenshteinScore[]): LevenshteinScore[] => {
  const sortedScores = scores.sort(levenshteinSorter);
  const lowestScore = scores[0].score;
  return sortedScores.filter((score) => score.score === lowestScore);
};

const levenshteinSorter = (a: LevenshteinScore, b: LevenshteinScore): number => a.score - b.score;
