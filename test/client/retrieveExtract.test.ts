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
import { join } from 'node:path';
import { expect } from 'chai';
import { XMLParser } from 'fast-xml-parser';
import { registry, RegistryAccess, SourceComponent, VirtualTreeContainer } from '../../src';
import { BotVersionFilter } from '../../src/client/types';
import { extractVersionNumber, filterAgentComponents, filterBotVersionEntries } from '../../src/client/retrieveExtract';

describe('retrieveExtract - Version Filtering', () => {
  const registryAccess = new RegistryAccess();
  const botType = registryAccess.getTypeByName('Bot');
  const genAiPlannerBundleType = registryAccess.getTypeByName('GenAiPlannerBundle');
  const apexClassType = registry.types.apexclass;

  describe('extractVersionNumber', () => {
    // Access the private function through the module
    // We'll test it indirectly through filterBotVersionEntries
    // But first, let's create a test helper to verify version extraction

    it('should extract version from "v0" format', () => {
      expect(extractVersionNumber('v0')).to.equal(0);
      expect(extractVersionNumber('v1')).to.equal(1);
      expect(extractVersionNumber('v2')).to.equal(2);
    });

    it('should extract version from "0" format (without v prefix)', () => {
      expect(extractVersionNumber('0')).to.equal(0);
      expect(extractVersionNumber('1')).to.equal(1);
      expect(extractVersionNumber('2')).to.equal(2);
    });

    it('should return null for invalid version formats', () => {
      expect(extractVersionNumber('invalid')).to.be.null;
      expect(extractVersionNumber('v')).to.be.null;
      expect(extractVersionNumber('')).to.be.null;
      expect(extractVersionNumber('v1.0')).to.be.null;
      expect(extractVersionNumber('1.0')).to.be.null;
    });
  });

  describe('filterBotVersionEntries', () => {
    it('should return all versions when filter is "all"', () => {
      const botVersions = [{ fullName: 'v0' }, { fullName: 'v1' }, { fullName: 'v2' }, { fullName: 'v3' }];
      const filtered = filterBotVersionEntries(botVersions, 'all');
      expect(filtered).to.have.length(4);
      expect(filtered).to.deep.equal(botVersions);
    });

    it('should return highest version when filter is "highest"', () => {
      const botVersions = [{ fullName: 'v0' }, { fullName: 'v1' }, { fullName: 'v5' }, { fullName: 'v2' }];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('v5');
    });

    it('should return highest version when versions are without v prefix', () => {
      const botVersions = [{ fullName: '0' }, { fullName: '1' }, { fullName: '5' }, { fullName: '2' }];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('5');
    });

    it('should return highest version when mixing v prefix and no prefix', () => {
      const botVersions = [{ fullName: 'v0' }, { fullName: '1' }, { fullName: 'v5' }, { fullName: '2' }];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('v5');
    });

    it('should return empty array when filter is "highest" but no valid versions', () => {
      const botVersions = [{ fullName: 'invalid' }, { fullName: 'v' }];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(0);
    });

    it('should return specific version when filter is a number', () => {
      const botVersions = [{ fullName: 'v0' }, { fullName: 'v1' }, { fullName: 'v2' }, { fullName: 'v3' }];
      const filtered = filterBotVersionEntries(botVersions, 2);
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('v2');
    });

    it('should return specific version when filter is a number (without v prefix)', () => {
      const botVersions = [{ fullName: '0' }, { fullName: '1' }, { fullName: '2' }, { fullName: '3' }];
      const filtered = filterBotVersionEntries(botVersions, 2);
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('2');
    });

    it('should return empty array when specific version does not exist', () => {
      const botVersions = [{ fullName: 'v0' }, { fullName: 'v1' }, { fullName: 'v2' }];
      const filtered = filterBotVersionEntries(botVersions, 5);
      expect(filtered).to.have.length(0);
    });

    it('should handle empty array', () => {
      const botVersions: Array<{ fullName?: string }> = [];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(0);
    });

    it('should handle versions with undefined fullName', () => {
      const botVersions = [{ fullName: 'v0' }, {}, { fullName: 'v2' }];
      const filtered = filterBotVersionEntries(botVersions, 'highest');
      expect(filtered).to.have.length(1);
      expect(filtered[0].fullName).to.equal('v2');
    });
  });

  describe('filterAgentComponents - Bot filtering', () => {
    const createMockBotComponent = (
      botName: string,
      botVersions: Array<{ fullName: string; entryDialog?: string; mainMenuDialog?: string }>
    ): SourceComponent => {
      const botXml = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>${botName}</fullName>
  ${botVersions
    .map(
      (v) => `<botVersions>
    <fullName>${v.fullName}</fullName>
    ${v.entryDialog ? `<entryDialog>${v.entryDialog}</entryDialog>` : ''}
    ${v.mainMenuDialog ? `<mainMenuDialog>${v.mainMenuDialog}</mainMenuDialog>` : ''}
  </botVersions>`
    )
    .join('\n  ')}
</Bot>`;

      const tree = new VirtualTreeContainer([
        {
          dirPath: join('bots', botName),
          children: [`${botName}.bot-meta.xml`],
        },
      ]);

      const component = new SourceComponent(
        {
          name: botName,
          type: botType,
          xml: join('bots', botName, `${botName}.bot-meta.xml`),
        },
        tree
      );

      // Mock the parseXml method and pathContentMap
      const componentWithPrivate = component;
      componentWithPrivate.pathContentMap = new Map();
      componentWithPrivate.pathContentMap.set(component.xml!, botXml);

      // Mock parseXml to read from pathContentMap and parse the XML
      // This allows the filter function to update pathContentMap and we can verify it
      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
      component.parseXml = () => {
        // Read from pathContentMap if available, otherwise use original
        const xmlContent = componentWithPrivate.pathContentMap?.get(component.xml!) ?? botXml;
        // Parse the XML content
        const parsed = parser.parse(xmlContent);
        // Convert XMLParser structure to the structure expected by the function
        // Ensure botVersions is always an array of complete objects
        if (parsed.Bot?.botVersions) {
          if (Array.isArray(parsed.Bot.botVersions)) {
            // Already in array format - keep as is
          } else if (typeof parsed.Bot.botVersions === 'object') {
            // Single botVersions object - convert to array
            parsed.Bot.botVersions = [parsed.Bot.botVersions];
          }
        }
        return parsed;
      };

      return component;
    };

    it('should filter BotVersion entries when filter is "all"', async () => {
      const component = createMockBotComponent('MyBot', [
        { fullName: 'v0', entryDialog: 'Welcome0' },
        { fullName: 'v1', entryDialog: 'Welcome1' },
        { fullName: 'v2', entryDialog: 'Welcome2' },
      ]);
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'all' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      // Check the XML content directly from pathContentMap
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);
      // When filter is "all", all versions should be present
      expect(xmlContent).to.include('<fullName>v0</fullName>');
      expect(xmlContent).to.include('<fullName>v1</fullName>');
      expect(xmlContent).to.include('<fullName>v2</fullName>');
      // Verify that entryDialog fields are preserved
      expect(xmlContent).to.include('<entryDialog>Welcome0</entryDialog>');
      expect(xmlContent).to.include('<entryDialog>Welcome1</entryDialog>');
      expect(xmlContent).to.include('<entryDialog>Welcome2</entryDialog>');
    });

    it('should filter BotVersion entries when filter is "highest"', async () => {
      const component = createMockBotComponent('MyBot', [
        { fullName: 'v0', entryDialog: 'Welcome0' },
        { fullName: 'v1', entryDialog: 'Welcome1' },
        { fullName: 'v5', entryDialog: 'Welcome5', mainMenuDialog: 'MainMenu5' },
        { fullName: 'v2', entryDialog: 'Welcome2' },
      ]);
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      // Check the XML content directly from pathContentMap
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);
      // Only v5 should be present
      expect(xmlContent).to.include('<fullName>v5</fullName>');
      expect(xmlContent).to.not.include('<fullName>v0</fullName>');
      expect(xmlContent).to.not.include('<fullName>v1</fullName>');
      expect(xmlContent).to.not.include('<fullName>v2</fullName>');
      // Critical: Verify that entryDialog and mainMenuDialog are preserved
      expect(xmlContent).to.include('<entryDialog>Welcome5</entryDialog>');
      expect(xmlContent).to.include('<mainMenuDialog>MainMenu5</mainMenuDialog>');
      // Verify other version's fields are not present
      expect(xmlContent).to.not.include('Welcome0');
      expect(xmlContent).to.not.include('Welcome1');
      expect(xmlContent).to.not.include('Welcome2');
    });

    it('should filter BotVersion entries when filter is a specific number', async () => {
      const component = createMockBotComponent('MyBot', [
        { fullName: 'v0', entryDialog: 'Welcome0' },
        { fullName: 'v1', entryDialog: 'Welcome1' },
        { fullName: 'v2', entryDialog: 'Welcome2', mainMenuDialog: 'MainMenu2' },
        { fullName: 'v3', entryDialog: 'Welcome3' },
      ]);
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 2 }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      // Check the XML content directly from pathContentMap
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);
      // Only v2 should be present
      expect(xmlContent).to.include('<fullName>v2</fullName>');
      expect(xmlContent).to.not.include('<fullName>v0</fullName>');
      expect(xmlContent).to.not.include('<fullName>v1</fullName>');
      expect(xmlContent).to.not.include('<fullName>v3</fullName>');
      // Critical: Verify that all fields are preserved for v2
      expect(xmlContent).to.include('<entryDialog>Welcome2</entryDialog>');
      expect(xmlContent).to.include('<mainMenuDialog>MainMenu2</mainMenuDialog>');
    });

    it('should not filter Bot components without matching filter', async () => {
      const component = createMockBotComponent('MyBot', [
        { fullName: 'v0', entryDialog: 'Welcome0' },
        { fullName: 'v1', entryDialog: 'Welcome1' },
        { fullName: 'v2', entryDialog: 'Welcome2' },
      ]);
      const filters: BotVersionFilter[] = [{ botName: 'OtherBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      // Component should remain unchanged - all versions present
      const firstFiltered = filtered[0];
      const xmlContent = firstFiltered.pathContentMap?.get(filtered[0].xml!);
      expect(xmlContent).to.include('<fullName>v0</fullName>');
      expect(xmlContent).to.include('<fullName>v1</fullName>');
      expect(xmlContent).to.include('<fullName>v2</fullName>');
    });

    it('should not modify non-Bot components', async () => {
      const apexComponent = new SourceComponent({
        name: 'MyClass',
        type: apexClassType,
        xml: 'path/to/MyClass.cls-meta.xml',
      });
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([apexComponent], filters);

      expect(filtered).to.have.length(1);
      expect(filtered[0]).to.equal(apexComponent);
    });

    it('should handle Bot components without botVersions', async () => {
      const component = createMockBotComponent('MyBot', []);
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      // Component should remain unchanged when there are no versions to filter
      const componentWithPrivate = filtered[0];
      const xmlContent = componentWithPrivate.pathContentMap?.get(filtered[0].xml!);
      // The Bot's fullName should be present, but no botVersions section
      expect(xmlContent).to.include('<fullName>MyBot</fullName>');
      expect(xmlContent).to.not.include('<botVersions>');
    });

    it('should handle multiple Bot components with different filters', async () => {
      const bot1 = createMockBotComponent('Bot1', [
        { fullName: 'v0', entryDialog: 'Welcome0' },
        { fullName: 'v1', entryDialog: 'Welcome1' },
        { fullName: 'v2', entryDialog: 'Welcome2' },
      ]);
      const bot2 = createMockBotComponent('Bot2', [
        { fullName: 'v0', entryDialog: 'Start0' },
        { fullName: 'v1', entryDialog: 'Start1' },
        { fullName: 'v3', entryDialog: 'Start3' },
      ]);
      const filters: BotVersionFilter[] = [
        { botName: 'Bot1', versionFilter: 'highest' },
        { botName: 'Bot2', versionFilter: 1 },
      ];

      const filtered = await filterAgentComponents([bot1, bot2], filters);

      expect(filtered).to.have.length(2);
      // Check XML content directly for both components
      const componentWithPrivate1 = filtered[0];
      const xmlContent1 = componentWithPrivate1.pathContentMap?.get(filtered[0].xml!);
      const componentWithPrivate2 = filtered[1];
      const xmlContent2 = componentWithPrivate2.pathContentMap?.get(filtered[1].xml!);
      // Bot1 should have v2 with its entryDialog
      expect(xmlContent1).to.include('<fullName>v2</fullName>');
      expect(xmlContent1).to.include('<entryDialog>Welcome2</entryDialog>');
      expect(xmlContent1).to.not.include('Welcome0');
      expect(xmlContent1).to.not.include('Welcome1');
      // Bot2 should have v1 with its entryDialog
      expect(xmlContent2).to.include('<fullName>v1</fullName>');
      expect(xmlContent2).to.include('<entryDialog>Start1</entryDialog>');
      expect(xmlContent2).to.not.include('Start0');
      expect(xmlContent2).to.not.include('Start3');
    });

    it('should preserve complex BotVersion metadata with all fields (regression test for missing entryDialog)', async () => {
      // This test specifically addresses the reported issue where entryDialog and other fields were being lost
      const complexBotXml = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>Agentforce</fullName>
  <botVersions>
    <fullName>v1</fullName>
    <entryDialog>Welcome</entryDialog>
    <mainMenuDialog>Main_Menu</mainMenuDialog>
    <botDialogs>
      <botSteps>
        <botMessages>
          <message>Hi! I'm your helpful bot.</message>
          <messageIdentifier>m1</messageIdentifier>
        </botMessages>
        <stepIdentifier>s1</stepIdentifier>
        <type>Message</type>
      </botSteps>
      <developerName>Welcome</developerName>
      <label>Welcome</label>
    </botDialogs>
    <conversationVariables>
      <dataType>Text</dataType>
      <developerName>currentAppName</developerName>
      <label>Current App Name</label>
    </conversationVariables>
    <conversationSystemDialogs>
      <dialog>Error_Handler</dialog>
      <type>ErrorHandling</type>
    </conversationSystemDialogs>
  </botVersions>
  <botVersions>
    <fullName>v2</fullName>
    <entryDialog>Welcome_v2</entryDialog>
  </botVersions>
</Bot>`;

      const tree = new VirtualTreeContainer([
        {
          dirPath: join('bots', 'Agentforce'),
          children: ['Agentforce.bot-meta.xml'],
        },
      ]);

      const component = new SourceComponent(
        {
          name: 'Agentforce',
          type: botType,
          xml: join('bots', 'Agentforce', 'Agentforce.bot-meta.xml'),
        },
        tree
      );

      component.pathContentMap = new Map();
      component.pathContentMap.set(component.xml!, complexBotXml);

      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
      component.parseXml = () => {
        const xmlContent = component.pathContentMap?.get(component.xml!) ?? complexBotXml;
        const parsed = parser.parse(xmlContent);
        if (parsed.Bot?.botVersions) {
          if (Array.isArray(parsed.Bot.botVersions)) {
            // Already in array format
          } else if (typeof parsed.Bot.botVersions === 'object') {
            parsed.Bot.botVersions = [parsed.Bot.botVersions];
          }
        }
        return parsed;
      };

      const filters: BotVersionFilter[] = [{ botName: 'Agentforce', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);

      // Verify that v2 is selected (highest version)
      expect(xmlContent).to.include('<fullName>v2</fullName>');
      expect(xmlContent).to.not.include('<fullName>v1</fullName>');

      // CRITICAL: Verify that entryDialog is preserved (the reported bug)
      expect(xmlContent).to.include('<entryDialog>Welcome_v2</entryDialog>');

      // Parse the parsed structure to verify it's correctly normalized
      const parsedXml = await filteredComponent.parseXml<{
        Bot?: { botVersions?: Array<{ fullName?: string; entryDialog?: string }> };
      }>();

      expect(parsedXml.Bot?.botVersions).to.be.an('array');
      expect(parsedXml.Bot?.botVersions).to.have.length(1);
      expect(parsedXml.Bot?.botVersions?.[0]).to.have.property('fullName', 'v2');
      expect(parsedXml.Bot?.botVersions?.[0]).to.have.property('entryDialog', 'Welcome_v2');
    });

    it('should preserve all BotVersion fields including botDialogs, conversationVariables, etc.', async () => {
      // Comprehensive test with many fields to ensure nothing is lost
      const complexBotXml = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>ComplexBot</fullName>
  <botVersions>
    <fullName>v1</fullName>
    <entryDialog>Welcome</entryDialog>
    <mainMenuDialog>Main_Menu</mainMenuDialog>
    <nlpProviders>
      <language>en_US</language>
      <nlpProviderType>EinsteinAi</nlpProviderType>
    </nlpProviders>
    <conversationVariables>
      <dataType>Text</dataType>
      <developerName>var1</developerName>
      <label>Variable 1</label>
    </conversationVariables>
    <conversationSystemDialogs>
      <dialog>Transfer_Failed</dialog>
      <type>TransferFailed</type>
    </conversationSystemDialogs>
    <botDialogs>
      <developerName>Welcome</developerName>
      <label>Welcome Dialog</label>
    </botDialogs>
  </botVersions>
  <botVersions>
    <fullName>v3</fullName>
    <entryDialog>Start</entryDialog>
  </botVersions>
</Bot>`;

      const tree = new VirtualTreeContainer([
        {
          dirPath: join('bots', 'ComplexBot'),
          children: ['ComplexBot.bot-meta.xml'],
        },
      ]);

      const component = new SourceComponent(
        {
          name: 'ComplexBot',
          type: botType,
          xml: join('bots', 'ComplexBot', 'ComplexBot.bot-meta.xml'),
        },
        tree
      );

      component.pathContentMap = new Map();
      component.pathContentMap.set(component.xml!, complexBotXml);

      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
      component.parseXml = () => {
        const xmlContent = component.pathContentMap?.get(component.xml!) ?? complexBotXml;
        const parsed = parser.parse(xmlContent);
        if (parsed.Bot?.botVersions) {
          if (Array.isArray(parsed.Bot.botVersions)) {
            // Already in array format
          } else if (typeof parsed.Bot.botVersions === 'object') {
            parsed.Bot.botVersions = [parsed.Bot.botVersions];
          }
        }
        return parsed;
      };

      const filters: BotVersionFilter[] = [{ botName: 'ComplexBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);

      // Should select v3 (highest)
      expect(xmlContent).to.include('<fullName>v3</fullName>');
      expect(xmlContent).to.include('<entryDialog>Start</entryDialog>');
      expect(xmlContent).to.not.include('<fullName>v1</fullName>');

      // Verify v1's fields are NOT present since it was filtered out
      expect(xmlContent).to.not.include('<mainMenuDialog>Main_Menu</mainMenuDialog>');
      expect(xmlContent).to.not.include('<developerName>var1</developerName>');
      expect(xmlContent).to.not.include('<developerName>Welcome</developerName>');
    });

    it('should preserve all fields when filtering to a specific version', async () => {
      // Test filtering to v1 which has many fields
      const complexBotXml = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>SpecificBot</fullName>
  <botVersions>
    <fullName>v1</fullName>
    <entryDialog>Welcome</entryDialog>
    <mainMenuDialog>Main_Menu</mainMenuDialog>
    <conversationVariables>
      <dataType>Text</dataType>
      <developerName>myVar</developerName>
      <label>My Variable</label>
    </conversationVariables>
    <nlpProviders>
      <language>en_US</language>
      <nlpProviderType>EinsteinAi</nlpProviderType>
    </nlpProviders>
  </botVersions>
  <botVersions>
    <fullName>v2</fullName>
    <entryDialog>Start</entryDialog>
  </botVersions>
</Bot>`;

      const tree = new VirtualTreeContainer([
        {
          dirPath: join('bots', 'SpecificBot'),
          children: ['SpecificBot.bot-meta.xml'],
        },
      ]);

      const component = new SourceComponent(
        {
          name: 'SpecificBot',
          type: botType,
          xml: join('bots', 'SpecificBot', 'SpecificBot.bot-meta.xml'),
        },
        tree
      );

      component.pathContentMap = new Map();
      component.pathContentMap.set(component.xml!, complexBotXml);

      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
      component.parseXml = () => {
        const xmlContent = component.pathContentMap?.get(component.xml!) ?? complexBotXml;
        const parsed = parser.parse(xmlContent);
        if (parsed.Bot?.botVersions) {
          if (Array.isArray(parsed.Bot.botVersions)) {
            // Already in array format
          } else if (typeof parsed.Bot.botVersions === 'object') {
            parsed.Bot.botVersions = [parsed.Bot.botVersions];
          }
        }
        return parsed;
      };

      const filters: BotVersionFilter[] = [{ botName: 'SpecificBot', versionFilter: 1 }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];
      const xmlContent = filteredComponent.pathContentMap?.get(filteredComponent.xml!);

      // Should select v1 with ALL its fields
      expect(xmlContent).to.include('<fullName>v1</fullName>');
      expect(xmlContent).to.include('<entryDialog>Welcome</entryDialog>');
      expect(xmlContent).to.include('<mainMenuDialog>Main_Menu</mainMenuDialog>');
      expect(xmlContent).to.include('<developerName>myVar</developerName>');
      expect(xmlContent).to.include('<language>en_US</language>');
      expect(xmlContent).to.include('<nlpProviderType>EinsteinAi</nlpProviderType>');

      // v2 should not be present
      expect(xmlContent).to.not.include('<fullName>v2</fullName>');
      expect(xmlContent).to.not.include('<entryDialog>Start</entryDialog>');
    });
  });

  describe('filterAgentComponents - GenAiPlannerBundle filtering', () => {
    const createMockGenAiPlannerBundle = (fullName: string): SourceComponent =>
      new SourceComponent({
        name: fullName,
        type: genAiPlannerBundleType,
        xml: join('genAiPlannerBundles', fullName, `${fullName}.genAiPlannerBundle-meta.xml`),
      });

    it('should keep all GenAiPlannerBundles when filter is "all"', async () => {
      const components = [
        createMockGenAiPlannerBundle('MyBot_v0'),
        createMockGenAiPlannerBundle('MyBot_v1'),
        createMockGenAiPlannerBundle('MyBot_v2'),
        new SourceComponent({ name: 'OtherComponent', type: apexClassType }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'all' }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(4);
      expect(filtered.filter((c: SourceComponent) => c.type.name === 'GenAiPlannerBundle')).to.have.length(3);
    });

    it('should keep only highest version GenAiPlannerBundle when filter is "highest"', async () => {
      const components = [
        createMockGenAiPlannerBundle('MyBot_v0'),
        createMockGenAiPlannerBundle('MyBot_v1'),
        createMockGenAiPlannerBundle('MyBot_v5'),
        createMockGenAiPlannerBundle('MyBot_v2'),
        new SourceComponent({ name: 'OtherComponent', type: apexClassType }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(2);
      const plannerBundles = filtered.filter((c: SourceComponent) => c.type.name === 'GenAiPlannerBundle');
      expect(plannerBundles).to.have.length(1);
      expect(plannerBundles[0].fullName).to.equal('MyBot_v5');
    });

    it('should keep only specific version GenAiPlannerBundle when filter is a number', async () => {
      const components = [
        createMockGenAiPlannerBundle('MyBot_v0'),
        createMockGenAiPlannerBundle('MyBot_v1'),
        createMockGenAiPlannerBundle('MyBot_v2'),
        createMockGenAiPlannerBundle('MyBot_v3'),
        new SourceComponent({ name: 'OtherComponent', type: apexClassType }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 2 }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(2);
      const plannerBundles = filtered.filter((c: SourceComponent) => c.type.name === 'GenAiPlannerBundle');
      expect(plannerBundles).to.have.length(1);
      expect(plannerBundles[0].fullName).to.equal('MyBot_v2');
    });

    it('should keep all GenAiPlannerBundles when no matching filter exists', async () => {
      const components = [
        createMockGenAiPlannerBundle('MyBot_v0'),
        createMockGenAiPlannerBundle('MyBot_v1'),
        new SourceComponent({ name: 'OtherComponent', type: apexClassType }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'OtherBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(3);
      expect(filtered.filter((c: SourceComponent) => c.type.name === 'GenAiPlannerBundle')).to.have.length(2);
    });

    it('should keep GenAiPlannerBundles that do not match expected pattern', async () => {
      const components = [
        createMockGenAiPlannerBundle('InvalidName'),
        createMockGenAiPlannerBundle('MyBot_v1'),
        new SourceComponent({ name: 'OtherComponent', type: apexClassType }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(3);
      const plannerBundles = filtered.filter((c: SourceComponent) => c.type.name === 'GenAiPlannerBundle');
      expect(plannerBundles).to.have.length(2);
    });

    it('should not modify non-GenAiPlannerBundle components', async () => {
      const components = [
        new SourceComponent({ name: 'MyClass', type: apexClassType }),
        new SourceComponent({ name: 'MyTrigger', type: registry.types.apextrigger }),
      ];
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(2);
      expect(filtered[0].type.name).to.equal('ApexClass');
      expect(filtered[1].type.name).to.equal('ApexTrigger');
    });

    it('should handle multiple bots with different filters', async () => {
      const components = [
        createMockGenAiPlannerBundle('Bot1_v0'),
        createMockGenAiPlannerBundle('Bot1_v2'),
        createMockGenAiPlannerBundle('Bot2_v0'),
        createMockGenAiPlannerBundle('Bot2_v1'),
      ];
      const filters: BotVersionFilter[] = [
        { botName: 'Bot1', versionFilter: 'highest' },
        { botName: 'Bot2', versionFilter: 0 },
      ];

      const filtered = await filterAgentComponents(components, filters);

      expect(filtered).to.have.length(2);
      expect(filtered[0].fullName).to.equal('Bot1_v2');
      expect(filtered[1].fullName).to.equal('Bot2_v0');
    });
  });

  describe('extract function - filtering behavior', () => {
    const createMockBotComponent = (botName: string, botVersions: string[]): SourceComponent => {
      const botXml = `<?xml version="1.0" encoding="UTF-8"?>
<Bot xmlns="http://soap.sforce.com/2006/04/metadata">
  <fullName>${botName}</fullName>
  <botVersions>
    ${botVersions.map((v) => `<fullName>${v}</fullName>`).join('\n    ')}
  </botVersions>
</Bot>`;

      const tree = new VirtualTreeContainer([
        {
          dirPath: join('bots', botName),
          children: [`${botName}.bot-meta.xml`],
        },
      ]);

      const component = new SourceComponent(
        {
          name: botName,
          type: botType,
          xml: join('bots', botName, `${botName}.bot-meta.xml`),
        },
        tree
      );

      // Mock the parseXml method and pathContentMap
      const componentWithPrivate = component;
      componentWithPrivate.pathContentMap = new Map();
      componentWithPrivate.pathContentMap.set(component.xml!, botXml);

      // Mock parseXml to read from pathContentMap and parse the XML
      // This allows the filter function to update pathContentMap and we can verify it
      const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
      component.parseXml = () => {
        // Read from pathContentMap if available, otherwise use original
        const xmlContent = componentWithPrivate.pathContentMap?.get(component.xml!) ?? botXml;
        // Parse the XML content
        const parsed = parser.parse(xmlContent);
        // Convert XMLParser structure to the structure expected by the function
        // XMLParser creates: { Bot: { botVersions: { fullName: ['v0', 'v1', ...] } } }
        // Function expects: { Bot: { botVersions: [{ fullName: 'v0' }, { fullName: 'v1' }, ...] } }
        if (parsed.Bot?.botVersions) {
          if (parsed.Bot.botVersions.fullName) {
            // Convert array of strings to array of objects
            const fullNames = Array.isArray(parsed.Bot.botVersions.fullName)
              ? parsed.Bot.botVersions.fullName
              : [parsed.Bot.botVersions.fullName];
            parsed.Bot.botVersions = fullNames.map((fn: string) => ({ fullName: fn }));
          } else if (Array.isArray(parsed.Bot.botVersions)) {
            // Already in the correct format
            // Do nothing
          } else {
            // Empty botVersions - set to empty array
            parsed.Bot.botVersions = [];
          }
        }
        return parsed;
      };

      return component;
    };

    it('should NOT invoke filtering when botVersionFilters is undefined for non-Bot components', async () => {
      // This test documents that filtering is only applied to Bot and GenAiPlannerBundle components
      // The extract function checks for botVersionFilters before invoking filtering logic
      // Non-Bot/GenAiPlannerBundle components should pass through unchanged
      const apexComponent = new SourceComponent({
        name: 'MyClass',
        type: apexClassType,
        xml: 'path/to/MyClass.cls-meta.xml',
      });
      const filters: BotVersionFilter[] = [];

      const filtered = await filterAgentComponents([apexComponent], filters);
      expect(filtered).to.have.length(1);
      expect(filtered[0]).to.equal(apexComponent);
    });

    it('should NOT invoke filtering when botVersionFilters is empty array', async () => {
      // Empty filters should not trigger filtering - components pass through unchanged
      const botComponent = createMockBotComponent('MyBot', ['v0', 'v1']);
      const filters: BotVersionFilter[] = [];

      // When filters are empty, filterAgentComponents keeps all components
      const filtered = await filterAgentComponents([botComponent], filters);
      expect(filtered).to.have.length(1);
    });

    it('should return normalized botVersions structure when parseXml is called after filtering', async () => {
      // This test verifies the fix for the "Value is not a string" error
      // When XMLParser groups multiple <fullName> elements into { fullName: ['v1', 'v2'] },
      // parseXml should return [{ fullName: 'v1' }, { fullName: 'v2' }] format
      // This is what the transformer expects
      const component = createMockBotComponent('MineToPublish', ['v1', 'v2', 'v3', 'v4']);
      const filters: BotVersionFilter[] = [{ botName: 'MineToPublish', versionFilter: 'all' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];

      // Call parseXml to simulate what the transformer does
      const parsed = await filteredComponent.parseXml<{ Bot?: { botVersions?: Array<{ fullName?: string }> } }>();

      // Verify the structure is normalized (array of objects, not grouped object)
      expect(parsed.Bot).to.exist;
      expect(parsed.Bot?.botVersions).to.exist;
      expect(parsed.Bot?.botVersions).to.be.an('array');
      expect(parsed.Bot?.botVersions).to.have.length(4);

      // Verify each element is an object with fullName property
      const botVersions = parsed.Bot?.botVersions as Array<{ fullName?: string }>;
      expect(botVersions[0]).to.have.property('fullName', 'v1');
      expect(botVersions[1]).to.have.property('fullName', 'v2');
      expect(botVersions[2]).to.have.property('fullName', 'v3');
      expect(botVersions[3]).to.have.property('fullName', 'v4');

      // Verify it's NOT the grouped format { fullName: ['v1', 'v2', 'v3', 'v4'] }
      const botVersionsObj = parsed.Bot?.botVersions as unknown;
      expect(botVersionsObj).to.not.have.property('fullName');
      expect(Array.isArray(botVersionsObj)).to.be.true;
    });

    it('should return normalized botVersions structure for "highest" filter', async () => {
      // Test that normalization works for different filter types
      const component = createMockBotComponent('MyBot', ['v0', 'v1', 'v5', 'v2']);
      const filters: BotVersionFilter[] = [{ botName: 'MyBot', versionFilter: 'highest' }];

      const filtered = await filterAgentComponents([component], filters);

      expect(filtered).to.have.length(1);
      const filteredComponent = filtered[0];

      // Call parseXml to simulate what the transformer does
      const parsed = await filteredComponent.parseXml<{ Bot?: { botVersions?: Array<{ fullName?: string }> } }>();

      // Verify the structure is normalized (array of objects)
      expect(parsed.Bot?.botVersions).to.be.an('array');
      expect(parsed.Bot?.botVersions).to.have.length(1);
      expect((parsed.Bot?.botVersions as Array<{ fullName?: string }>)[0]).to.have.property('fullName', 'v5');
    });
  });
});
