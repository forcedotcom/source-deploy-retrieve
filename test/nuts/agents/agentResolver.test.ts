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

import { join } from 'node:path';
import { expect, config } from 'chai';
import { Connection } from '@salesforce/core';
import { instantiateContext, MockTestOrgData, restoreContext, stubContext } from '@salesforce/core/testSetup';
import { resolveAgentMdEntries } from '../../../src/resolve/pseudoTypes/agentResolver';

config.truncateThreshold = 0;

describe('agentResolver', () => {
  const projectDir = join('test', 'nuts', 'agents', 'agentsProject');
  const projectDir64 = join('test', 'nuts', 'agents', 'agentsProject64');
  const sourceDir = join(projectDir, 'force-app', 'main', 'default');
  const sourceDir64 = join(projectDir64, 'force-app', 'main', 'default');
  const allAgentMetadata = ['Bot', 'GenAiPlanner', 'GenAiPlugin', 'GenAiFunction'];
  const allAgentMetadata64 = ['Bot', 'GenAiPlannerBundle', 'GenAiPlugin', 'GenAiFunction'];
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

  describe('apiVersion 63.0 and lower', () => {
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

  describe('apiVersion 64.0 and higher', () => {
    it('should return all top level agent metadata for wildcard and connection', async () => {
      connection.setApiVersion('64.0');
      const agentPseudoConfig = { botName: '*', connection };
      expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(allAgentMetadata64);
    });

    // Tests correct resolution when Bot API name does not match GenAiPlannerBundle API name.
    it('should return metadata for internal agent and directory', async () => {
      const agentPseudoConfig = { botName: 'Copilot_for_Salesforce', directoryPaths: [sourceDir64] };
      const expectedAgentMdEntries = ['Bot:Copilot_for_Salesforce', 'GenAiPlannerBundle:EmployeeCopilotPlanner'];
      expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
    });

    it('should return metadata for agent (no plugins or functions) and directory', async () => {
      const agentPseudoConfig = { botName: 'My_Macys', directoryPaths: [sourceDir64] };
      const expectedAgentMdEntries = ['Bot:My_Macys', 'GenAiPlannerBundle:My_Macys'];
      expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
    });

    it('should return metadata for agent (with plugins and functions) and directory', async () => {
      const agentPseudoConfig = { botName: 'The_Campus_Assistant', directoryPaths: [sourceDir64] };
      const expectedAgentMdEntries = [
        'Bot:The_Campus_Assistant',
        'GenAiPlannerBundle:The_Campus_Assistant',
        'GenAiPlugin:p_16jQP0000000PG9_Climbing_Routes_Information',
        'GenAiPlugin:p_16jQP0000000PG9_Gym_Hours_and_Schedule',
        'GenAiPlugin:p_16jQP0000000PG9_Membership_Plans',
        'GenAiFunction:CustomKnowledgeAction_1738277095539',
      ];
      expect(await resolveAgentMdEntries(agentPseudoConfig)).to.deep.equal(expectedAgentMdEntries);
    });

    describe('with a connection', () => {
      const genAiPlannerId = '16jWJ000000275RYAQ';

      const plannerIdQuery = "SELECT Id FROM GenAiPlannerDefinition WHERE DeveloperName = 'The_Campus_Assistant'";
      const plannerToPluginsQuery = `SELECT Plugin FROM GenAiPlannerFunctionDef WHERE PlannerId = '${genAiPlannerId}'`;
      let queryStub: sinon.SinonStub;
      let singleRecordQueryStub: sinon.SinonStub;

      beforeEach(() => {
        connection.setApiVersion('64.0');
        singleRecordQueryStub = $$.SANDBOX.stub(connection, 'singleRecordQuery');
        singleRecordQueryStub.withArgs(plannerIdQuery, { tooling: true }).resolves({ Id: genAiPlannerId });
        queryStub = $$.SANDBOX.stub(connection.tooling, 'query');
      });

      it('should return metadata for agent (with plugins) from the org', async () => {
        const pluginIds = ['179WJ0000004VI9YAM', '179WJ0000004VIAYA2', '179WJ0000004VIBYA2', '179WJ0000004VICYA2'];
        const plannerToPlugins = [
          { Plugin: pluginIds[0] },
          { Plugin: pluginIds[1] },
          { Plugin: pluginIds[2] },
          { Plugin: pluginIds[3] },
        ];
        const pluginDeveloperNames = [
          { DeveloperName: 'p_16jQP0000000PG9_Climbing_Routes_Information' },
          { DeveloperName: 'p_16jQP0000000PG9_Gym_Hours_and_Schedule' },
          { DeveloperName: 'p_16jQP0000000PG9_Membership_Plans' },
          { DeveloperName: 'Topic_Goal' },
        ];
        const genAiPluginNamesQuery = `SELECT DeveloperName FROM GenAiPluginDefinition WHERE Id IN ('${pluginIds.join(
          "','"
        )}')`;
        queryStub.withArgs(plannerToPluginsQuery).resolves({ records: plannerToPlugins });
        queryStub.withArgs(genAiPluginNamesQuery).resolves({ records: pluginDeveloperNames });

        const agentPseudoConfig = { botName: 'The_Campus_Assistant', connection };
        const result = await resolveAgentMdEntries(agentPseudoConfig);

        // Should include Bot, Planner, and only the non-p_plannerId plugins
        expect(result).to.deep.equal([
          'Bot:The_Campus_Assistant',
          'GenAiPlannerBundle:The_Campus_Assistant',
          'GenAiPlugin:p_16jQP0000000PG9_Climbing_Routes_Information',
          'GenAiPlugin:p_16jQP0000000PG9_Gym_Hours_and_Schedule',
          'GenAiPlugin:p_16jQP0000000PG9_Membership_Plans',
          'GenAiPlugin:Topic_Goal',
        ]);
      });

      it('should handle the case where the planner has no plugins', async () => {
        queryStub.withArgs(plannerToPluginsQuery).resolves({ records: [] });

        const agentPseudoConfig = { botName: 'The_Campus_Assistant', connection };
        const result = await resolveAgentMdEntries(agentPseudoConfig);

        // Should include Bot, Planner, and only the non-p_plannerId plugins
        expect(result).to.deep.equal(['Bot:The_Campus_Assistant', 'GenAiPlannerBundle:The_Campus_Assistant']);
      });

      it('should handle the case where the planner has global plugins only', async () => {
        const pluginIds = ['someStandardPlugin'];
        const plannerToPlugins = [{ Plugin: pluginIds[0] }];
        const genAiPluginNamesQuery = `SELECT DeveloperName FROM GenAiPluginDefinition WHERE Id IN ('${pluginIds[0]}')`;
        queryStub.withArgs(plannerToPluginsQuery).resolves({ records: plannerToPlugins });
        queryStub.withArgs(genAiPluginNamesQuery).resolves({ records: [] });

        const agentPseudoConfig = { botName: 'The_Campus_Assistant', connection };
        const result = await resolveAgentMdEntries(agentPseudoConfig);

        // Should include Bot, Planner, and only the non-p_plannerId plugins
        expect(result).to.deep.equal(['Bot:The_Campus_Assistant', 'GenAiPlannerBundle:The_Campus_Assistant']);
      });

      it('should list customized plugins only', async () => {
        // in this case, the planner has global plugins and customized plugins
        const pluginIds = ['179WJ0000004VI9YAM', '179WJ0000004VIAYA2', 'someStandardPlugin'];
        const plannerToPlugins = [{ Plugin: pluginIds[0] }, { Plugin: pluginIds[1] }, { Plugin: pluginIds[2] }];
        const pluginDeveloperNames = [
          { DeveloperName: 'p_16jQP0000000PG9_Climbing_Routes_Information' },
          { DeveloperName: 'p_16jQP0000000PG9_Gym_Hours_and_Schedule' },
        ];
        const genAiPluginNamesQuery = `SELECT DeveloperName FROM GenAiPluginDefinition WHERE Id IN ('${pluginIds.join(
          "','"
        )}')`;
        queryStub.withArgs(plannerToPluginsQuery).resolves({ records: plannerToPlugins });
        queryStub.withArgs(genAiPluginNamesQuery).resolves({ records: pluginDeveloperNames });

        const agentPseudoConfig = { botName: 'The_Campus_Assistant', connection };
        const result = await resolveAgentMdEntries(agentPseudoConfig);

        // Should include Bot, Planner, and only the non-p_plannerId plugins
        expect(result).to.deep.equal([
          'Bot:The_Campus_Assistant',
          'GenAiPlannerBundle:The_Campus_Assistant',
          'GenAiPlugin:p_16jQP0000000PG9_Climbing_Routes_Information',
          'GenAiPlugin:p_16jQP0000000PG9_Gym_Hours_and_Schedule',
        ]);
      });
    });
  });
});
