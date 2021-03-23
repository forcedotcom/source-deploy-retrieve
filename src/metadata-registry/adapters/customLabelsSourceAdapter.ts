/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DefaultSourceAdapter } from './defaultSourceAdapter';
import { SourcePath } from '../../common';
import { SourceComponent } from '../sourceComponent';
import { LabelsIndex } from '../../utils/labelsIndex';

/**
 * TODO
 */
export class CustomLabelsSourceAdapter extends DefaultSourceAdapter {
  protected metadataWithContent = false;

  protected populate(trigger: SourcePath, component: SourceComponent): SourceComponent {
    const index = LabelsIndex.getInstance();
    if (trigger.endsWith('-meta.xml')) {
      index.add(trigger, component);
    }
    return component;
  }
}
