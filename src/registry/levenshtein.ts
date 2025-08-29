/*
 * Copyright 2025, Salesforce, Inc.
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

  const guesses = getLowestScores(scores).map((guess) => guess.registryKey);
  return [
    ...(guesses.length
      ? [
          `Did you mean one of the following types? [${guesses.join(',')}]`,
          '', // Add a blank line for better readability
        ]
      : []),
    messages.getMessage('type_name_suggestions'),
  ];
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
