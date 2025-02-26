/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'node:path';
import { expect, config } from 'chai';
import { Connection } from '@salesforce/core';
import { instantiateContext, MockTestOrgData, restoreContext, stubContext } from '@salesforce/core/testSetup';
import { resolveAgentMdEntries } from '../../../src/resolve/pseudoTypes/agentResolver';

config.truncateThreshold = 0;

describe('agentResolver', () => {
  const projectDir = join('test', 'nuts', 'agents', 'agentsProject');
  const sourceDir = join(projectDir, 'force-app', 'main', 'default');
  const allAgentMetadata = ['Bot', 'GenAiPlanner', 'GenAiPlugin', 'GenAiFunction'];
  const $$ = instantiateContext();
  const testOrg = new MockTestOrgData();
  let connection: Connection;

  beforeEach(async () => {
    stubContext($$);
    await $$.stubAuths(testOrg);
    connection = await testOrg.getConnection();
    $$.SANDBOX.stub(Connection, 'create').resolves(connection);
  });

  afterEach(() => {
    restoreContext($$);
  });

  it('should return all top level agent metadata for wildcard and connection', async () => {
    const agentPseudoConfig = { botName: '*', connection };
    expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(allAgentMetadata);
  });

  it('should return all top level agent metadata for wildcard and directory', async () => {
    const agentPseudoConfig = { botName: '*', directoryPaths: [sourceDir] };
    expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(allAgentMetadata);
  });

  // Tests correct resolution when Bot API name does not match GenAiPlanner API name.
  it('should return metadata for internal agent and directory', async () => {
    const agentPseudoConfig = { botName: 'Copilot_for_Salesforce', directoryPaths: [sourceDir] };
    const expectedAgentMdEntries = ['Bot:Copilot_for_Salesforce', 'GenAiPlanner:EmployeeCopilotPlanner'];
    expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
  });

  it('should return metadata for agent (no plugins or functions) and directory', async () => {
    const agentPseudoConfig = { botName: 'My_Macys', directoryPaths: [sourceDir] };
    const expectedAgentMdEntries = ['Bot:My_Macys', 'GenAiPlanner:My_Macys'];
    expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
  });

  it('should return metadata for agent (with plugins and functions) and directory', async () => {
    const agentPseudoConfig = { botName: 'The_Campus_Assistant', directoryPaths: [sourceDir] };
    const expectedAgentMdEntries = [
      'Bot:The_Campus_Assistant',
      'GenAiPlanner:The_Campus_Assistant',
      'GenAiPlugin:p_16jQP0000000PG9_Climbing_Routes_Information',
      'GenAiPlugin:p_16jQP0000000PG9_Gym_Hours_and_Schedule',
      'GenAiPlugin:p_16jQP0000000PG9_Membership_Plans',
      'GenAiFunction:CustomKnowledgeAction_1738277095539',
    ];
    expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
  });
});
