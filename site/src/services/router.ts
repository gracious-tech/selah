
import VueRouter from 'vue-router'

import RouteRoot from '@/components/routes/RouteRoot.vue'
import RouteRoom from '@/components/routes/RouteRoom.vue'
import RouteAbout from '@/components/routes/RouteAbout.vue'
import RouteSettings from '@/components/routes/RouteSettings.vue'
import RouteInstall from '@/components/routes/RouteInstall.vue'
import RouteInvalid from '@/components/routes/RouteInvalid.vue'
import {call_next} from '@/services/utils'


// Route config
const routes = [
    {path: '/', component: RouteRoot},
    {path: '/about/', component: RouteAbout},
    {path: '/install/', component: RouteInstall},
    {path: '/settings/', component: RouteSettings},
    // NOTE Room ids could technically clash with existing paths, but as long as existing paths are
    //      at least 4 chars, the chance is 1 in 16,777,216 (64^4) which is acceptable
    //      and any clashes just mean the room is inaccessible as existing paths take precedance
    {path: '/:room_id/', component: RouteRoom, name: 'room', props: true},
    {path: '*', component: RouteInvalid},
]


// Make all routes strict (don't remove trailing slashes) and case-sensitive
// TODO Refactor after implemented https://github.com/vuejs/vue-router/issues/2404
for (const route of routes){
    (route as any).pathToRegexpOptions = {strict: true, sensitive: true}
}


// Helper to init router once store is ready (as some navigation guards depend on it)
export function get_router(store){

    // Init router
    const router = new VueRouter({mode: 'history', routes})

    // Redirect to root when launching app from homescreen
    // WARN Always redirect for iOS as it will open whatever URL it was first installed under
    // WARN Initial load !== launch (as could refresh page), rather launch is opening when installed
    //      So only redirect if installed so desktop can still link directly somewhere if desired
    // NOTE router.currentRoute doesn't have search params on initial load for some reason...
    if (self._installed && router.currentRoute.path !== '/'){
        router.replace('/')
    }

    // NOTE Navigation guards are applied in order they are created

    // Redirect all non-trailing-slash URLs to trailing-slash version so that ../ etc work correctly
    router.beforeEach(call_next((to, from) => {
        if (! to.path.endsWith('/')){
            if (process.env.NODE_ENV === 'development'){
                // Redirection only for production (in case user modifies the URL themselves)
                throw new Error(`Target URL does not end with a slash: ${to.path}`)
            }
            const new_to = {...to}
            new_to.path += '/'
            return new_to
        }
    }))

    return router
}
