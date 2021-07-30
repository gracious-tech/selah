// App config script that generates data files consumed by app

const yaml = require('js-yaml')  // Couldn't get ES6 import to work
import {resolve} from 'path'
import {writeFileSync, readFileSync} from 'fs'

import {generate_theme} from './theme_generation'
import {generate_manifest} from './manifest'


// Determine env
const site = process.argv[2]
if (!['selah', 'singit'].includes(site)){
    throw 'invalid arg'
}
const deployment = process.argv[3]
if (!['dev', 'prod'].includes(deployment)){
    throw 'invalid arg'
}


// Helper for getting config files as objects
function get_config(name){
    return yaml.load(readFileSync(resolve(__dirname, `${name}.yaml`)))
}


// Import config
const config = get_config('app_config')


// Apply env specific configs over base config
if (site === 'singit'){
    Object.assign(config, get_config('app_config_singit'))
}
Object.assign(config, get_config(`app_config_${site}_${deployment}`))


// Generate colors from codes
generate_theme(config)


// Write config for backend (including secrets)
writeFileSync(resolve(__dirname, '../api/code/app_config.json'), JSON.stringify(config))


// Remove secrets from config before using for frontend
// WARN Never include secrets in frontend!
delete config.secrets


// Write configs for frontend
writeFileSync(resolve(__dirname, '../site/src/app_config.json'), JSON.stringify(config))
writeFileSync(resolve(__dirname, '../site/static/_assets/manifest.json'), generate_manifest(config))
