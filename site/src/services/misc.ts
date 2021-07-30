// Utils that have dependencies or are app-specific

import {debounce} from 'lodash'
import {VSelect} from 'vuetify/lib/components/VSelect'
import {VAutocomplete} from 'vuetify/lib/components/VAutocomplete'

import app_config from '@/app_config.json'


export const version = app_config.version
export const prerelease =
    self.location.hostname.startsWith('test.') ? 'test' : (version.startsWith('0.') ? 'beta' : null)


export const VAutoOrSelect = (() => {
    // Return either an autocomplete or a select component depending on viewport height
    // Autocomplete useful to filter long lists, but opens a keyboard on mobiles resulting in bad UX
    const keyboard_height = 260
    const autocomplete_desired_height = 550
    const required_height = keyboard_height + autocomplete_desired_height
    return self.innerHeight > required_height ? VAutocomplete : VSelect
})()


export function debounce_method(ms){
    // Debounce decorator for methods
    // See https://www.typescriptlang.org/docs/handbook/decorators.html#method-decorators
    return (that, name, descriptor) => {
        descriptor.value = debounce(descriptor.value, ms)
    }
}


export function debounce_set(ms){
    // Debounce decorator for `set` accessors
    // See https://www.typescriptlang.org/docs/handbook/decorators.html#accessor-decorators
    // NOTE Only one decorator can be used for each accessor name (whether get or set)
    return (that, name, descriptor) => {
        descriptor.set = debounce(descriptor.set, ms)
    }
}


export function debug(arg:any){
    // Log a debug message in console if not production (as may be frequent and bad for performance)
    if (process.env.NODE_ENV !== 'production'){
        console.debug(arg)  // tslint:disable-line:no-console
    }
}
