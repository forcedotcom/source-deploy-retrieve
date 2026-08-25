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
import { expect } from 'chai';
import { parseAgentVersionFullName } from '../../../src/resolve/pseudoTypes/agentResolver';

describe('parseAgentVersionFullName', () => {
  it('should parse specific version (AgentName#N)', () => {
    const result = parseAgentVersionFullName('ASA1#3');
    expect(result).to.deep.equal({ agentName: 'ASA1', versionFilter: 3 });
  });

  it('should parse version 1', () => {
    const result = parseAgentVersionFullName('My_Agent#1');
    expect(result).to.deep.equal({ agentName: 'My_Agent', versionFilter: 1 });
  });

  it('should parse high version numbers', () => {
    const result = parseAgentVersionFullName('TestAgent#42');
    expect(result).to.deep.equal({ agentName: 'TestAgent', versionFilter: 42 });
  });

  it('should parse wildcard version (AgentName#*)', () => {
    const result = parseAgentVersionFullName('ASA1#*');
    expect(result).to.deep.equal({ agentName: 'ASA1', versionFilter: 'all' });
  });

  it('should default to highest when no version specified', () => {
    const result = parseAgentVersionFullName('ASA1');
    expect(result).to.deep.equal({ agentName: 'ASA1', versionFilter: 'highest' });
  });

  it('should handle agent names with underscores', () => {
    const result = parseAgentVersionFullName('My_Complex_Agent_Name#5');
    expect(result).to.deep.equal({ agentName: 'My_Complex_Agent_Name', versionFilter: 5 });
  });

  it('should handle agent names containing dots', () => {
    const result = parseAgentVersionFullName('Agent.With.Dots#2');
    expect(result).to.deep.equal({ agentName: 'Agent.With.Dots', versionFilter: 2 });
  });
});
