/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { mockRegistry } from '.';
import { join } from 'path';
import { SourceComponent } from '../../../src/metadata-registry';

// Constants for a type that uses the BaseSourceAdapter
const type = mockRegistry.types.genewilder;

export const GENE_DIR = join('path', 'to', 'genes');
export const GENE_XML_NAME = 'a.gene-meta.xml';
export const GENE_XML_PATH = join(GENE_DIR, GENE_XML_NAME);
export const GENE_COMPONENT = new SourceComponent({
  name: 'a',
  type,
  xml: GENE_XML_PATH
});
