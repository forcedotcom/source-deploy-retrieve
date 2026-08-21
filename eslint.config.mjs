import tsconfigs from 'eslint-config-salesforce-typescript';
import plugin from 'eslint-plugin-sf-plugin';

const configs = [...tsconfigs, ...plugin.configs.library];

export default configs;
