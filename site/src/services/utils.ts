// Basic standalone utility functions that could be reused in any website


export function type_of(value:any){
    // Extend typeof to support null and Array
    if (value === null){
        return 'null'  // typeof null === 'object' (bug since JS v1)
    } else if (Array.isArray(value)){
        return 'array'  // typeof [] === 'object'
    }
    return typeof value
}


export function get_last(array:any[]){
    // Return the last item in the array, or undefined (useful when array name very long)
    return array[array.length-1]
}


export class NestedKeyMissing extends Error {
    name = 'NestedKeyMissing'
}


export class NestedStructureChanged extends Error {
    name = 'NestedStructureChanged'
}


export function catch_only(error_class, error){
    // Rethrow an error if not of the given class
    if (! (error instanceof error_class)){
        throw error
    }
}


export function nested_objects_set(container, keys, value){
    // Set a value in a nested set of objects
    // NOTE Doesn't allow adding new properties (important as Vue wouldn't be able to detect)

    // Avoid changing keys array
    keys = keys.slice()

    // Traverse the container until only one key remains
    while (keys.length > 1){
        const key = keys.shift()
        container = container[key]
        if (container === undefined){
            throw new NestedKeyMissing(key)
        }
    }

    // Set value
    if (keys[0] in container){
        container[keys[0]] = value
    } else {
        throw new NestedKeyMissing(keys[0])
    }
}


export function nested_objects_update(base, update){
    // Do a deep update of a base object by merging in values from the given update object
    // Update can be partial but can't add new keys, and can't change structure of base
    // Intended use case is merging in changes from an API response
    //     If object merely replaced, Vue will rerender DOM even if no values have changed
    //     See https://stackoverflow.com/questions/61653210/

    for (const [key, new_val] of Object.entries(update)){

        // Don't allow adding new keys (bad practice, and Vue won't detect changes)
        const old_val = base[key]
        if (old_val === undefined){
            throw new NestedKeyMissing(key)
        }

        // Skip if value hasn't changed
        if (new_val === old_val){
            continue
        }

        // Don't allow changing structure (replacing an object|array with another type)
        const new_type = type_of(new_val)
        const old_type = type_of(old_val)
        if (new_type !== old_type && ['object', 'array'].includes(old_type)){
            throw new NestedStructureChanged(key)
        }

        // Go deeper if an object, otherwise update the value
        // NOTE Arrays are simply replaced, as too complicated to merge
        if (old_type === 'object'){
            nested_objects_update(base[key], update[key])
        } else {
            base[key] = new_val
        }
    }
}


export function sorted_json(object){
    // Return an idempotent JSON string by ensuring keys are sorted
    // NOTE Does not support objects as values (i.e. nested within root object)

    // Get sorted list of keys
    const keys = Object.keys(object)
    keys.sort()

    // Get jsonified key:value items but without commas or outer braces
    const parts = []
    for (const key of keys){
        const tmp_object = {}
        tmp_object[key] = object[key]
        const naked_kv = JSON.stringify(tmp_object).trim().slice(1, -1)
        parts.push(naked_kv)
    }

    // Join parts to form valid json string
    return '{' + parts.join(',') + '}'
}


export async function urlsafe_hash(array_buffer){
    // Return a urlsafe hash of given binary data
    const subtle = crypto.subtle || (crypto as any).webkitSubtle
    // Generate hash of the given data
    const hash = await subtle.digest('SHA-256', array_buffer)
    // Encode to base64 to make shortest possible urlsafe representation
    // NOTE btoa only works with strings so first form utf8 string
    const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    // Convert to urlsafe base64
    return base64.replace(/\+/g, '-').replace(/\//g, '_')
}


export function generate_uuid(){
    // Return a random unique identifier that is url safe
    // NOTE JS numbers are 64 bit floats, as is returned by random
    return urlsafe_hash(new Float64Array([Math.random()]))
}


export const ios_device = (() => {
    // If iOS, return the device type, else null
    // NOTE This value both tests if iOS and also can be used in templates
    for (const type of ['iPhone', 'iPad', 'iPod']){
        if (self.navigator.platform.includes(type)){
            return type
        }
    }
    return null
})()


// All possible env keys in desired display order
export const install_env_order = ['android_chrome', 'android_samsung', 'android_webview',
    'android_other', 'ios_safari', 'ios_other', 'ios_webview', 'desktop']


export const install_env = (() => {
    // Detect the user's platform/browser for those that are relevant for installing
    // WARN This detection is VERY brittle and should only be used for non-intrusive features
    //      Such as displaying an install banner that can be dismissed

    const ua = self.navigator.userAgent

    // iOS devices
    // NOTE Always catch any iOS browser, as the only option for them is Safari
    if(ios_device){
        // iOS webview doesn't have "Safari" in UA
        // WARN Installed app on iOS 10+ seems to have same UA as webview (so also check standalone)
        //  Technically installed apps in iOS 10+ are basically webviews (different state to Safari)
        //  But for sake of this app, consider installed on iOS as ios_safari
        if (!ua.includes('Safari') && !self.navigator.standalone){
            return 'ios_webview'
        }
        // Rule out Chrome and Firefox
        if (ua.includes('CriOS') || ua.includes('FxiOS')){
            return 'ios_other'
        }
        // Assume Safari (though this will catch other less common browsers too)
        return 'ios_safari'
    }

    // Rest of the rules only apply to Android browsers
    // NOTE `platform` value very unhelpful (unlike with iOS), so using user agent
    if (! /android/i.test(ua)){
        return 'desktop'  // Assume just desktops, but potentially could include unusual mobiles
    }

    // Webview
    if (ua.includes('; wv) ')){
        return 'android_webview'
    }

    // Samsung internet
    // NOTE SamsungBrowser is in UA for at least v4+
    // NOTE Assuming no other browsers are pretending to be Samsung
    // NOTE Also matches Samsung TV but doubt app will be used there
    if (/SamsungBrowser/.test(ua)){
        return 'android_samsung'
    }

    // Chrome android (will probably match many Chromium variations as well but that's ok)
    if ('chrome' in self){
        return 'android_chrome'
    }

    // A less common android browser
    return 'android_other'
})()


export function install_averse(){
    // Return whether browser should support installing (WITH data preservation) but doesn't
    // i.e. Desktop browsers are not averse, nor is Android Chrome, but iOS browsers are
    // WARN This is a function rather than const as `self._installed` not defined when this parsed
    return !self._installed && (install_env.startsWith('ios_') || install_env === 'android_webview')
}


export function call_next(guard){
    // Decorator to allow returning in a guard, rather than calling next()
    // Wrapped guard will only be given (to, from) and not `next`
    // NOTE Couldn't get working as method decorator in components
    return (to, from, next) => {
        next(guard(to, from))
    }
}


export async function fetch_ensure_cached(cache_name, url){
    // Fetch a resource and ensure that it is cached

    // Request resource and resolve to null if network error
    const resp = await fetch(url).catch(() => null)

    // Return null if error
    if (!resp || !resp.ok){
        // Only log if not a network error
        if (resp){
            self._fail_log(`Request failed: ${url} ${resp.status} ${resp.statusText}`)
        }
        return null
    }

    // If SW not yet active then cache manually
    if ('serviceWorker' in self.navigator && !self.navigator.serviceWorker.controller){
        // Don't wait for resp to be cached
        const clone = resp.clone()  // resp body may have been used before async cache happens
        self.caches.open(cache_name).then(cache => {cache.put(url, clone)})
    }

    return resp
}


export function sleep(ms){
    // Await this function to delay execution for given ms
    return new Promise(resolve => setTimeout(resolve, ms))
}


export function display_seconds(seconds:number){
    // Display seconds in format 0:ss, m:ss, mm:ss, or h:mm:ss

    // Work out values
    const secs_in_hour = 60 * 60
    const hours = Math.floor(seconds / secs_in_hour)
    const minutes = Math.floor((seconds % secs_in_hour) / 60)
    seconds = Math.floor(seconds % 60)  // Must also floor in case given seconds is a float

    // Helper for padding a number with zero so always 2 digits
    const pad2 = val => `0${val}`.slice(-2)

    // Work out presentation
    const parts:any = [pad2(seconds)]
    if (hours){
        parts.unshift(hours, pad2(minutes))
    } else {
        parts.unshift(minutes)
    }
    return parts.join(':')
}
