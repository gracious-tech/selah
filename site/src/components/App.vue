
<template lang='pug'>

v-app(:class='app_classes')
    //- v-app will become .v-application > .v-application--wrap > ...
    //- Dialogs etc will be children of .v-application
    //- Transition will not appear in the DOM itself
    transition(:name='transition')
        component(:is='docked' class='docked')

    //- Unlike beta, this banner should appear on every page
    div(v-if='test_release' class='release-banner test') TEST

    v-snackbar(v-model='snackbar') {{ $store.state.tmp.snackbar_text }}
    app-dialog

</template>


<script lang='ts'>

import {Component, Vue, Watch} from 'vue-property-decorator'

import {prerelease} from '@/services/misc'
import {install_env} from '@/services/utils'
import app_config from '@/app_config.json'
import AppDialog from '@/components/dialogs/AppDialog.vue'
import SplashWelcome from '@/components/splash/SplashWelcome.vue'


@Component({
    components: {SplashWelcome, AppDialog},
})
export default class extends Vue {

    route_transition = 'jump'
    test_release = prerelease === 'test'

    mounted(){
        // Process `paid` URL param if present for singit
        // NOTE Placed here so app mounted and can show notification
        if (app_config.domain === 'singit.cloud' && !this.$store.state.singit_paid
                && 'paid' in this.$router.currentRoute.query){
            this.$store.commit('dict_set', ['singit_paid', true])
            this.$store.dispatch('show_notification', "Thanks for your support")
        }
    }

    get docked(){
        // Show first item that wants to be shown
        const items = [
            ['splash-welcome', this.$store.state.show_splash_welcome],
            ['router-view', true],
        ]
        return items.find(([component, show]) => show)[0]
    }

    get transition(){
        // Always jump if transitioning with splashes
        return this.docked === 'router-view' ? this.route_transition : 'jump'
    }

    get app_classes(){
        // Return classes for the component's root
        const classes = []
        if (install_env === 'desktop'){
            classes.push('custom-scroll')
        }
        if (this.$store.state.dark){
            classes.push('dark')
        }
        return classes
    }

    get snackbar(){
        return this.$store.state.tmp.snackbar
    }

    set snackbar(value){
        this.$store.commit('tmp_set', ['snackbar', value])
    }

    @Watch('$route') watch_$route(to, from){
        // Do a different transition depending on which routes going from/to
        if (to.path.startsWith(from.path)){
            this.route_transition = 'deeper'
        } else if (from.path.startsWith(to.path)){
            this.route_transition = 'shallower'
        } else {
            this.route_transition = 'jump'
        }
    }

    @Watch('$store.state.tmp.room.id') watch_room(to, from){
        // Navigate to/away from a room whenever it changes
        const route_room = this.$route.name === 'room' ? this.$route.params.room_id : null
        const state_room = this.$store.state.tmp.room ? this.$store.state.tmp.room.id : null
        if (route_room !== state_room){
            const go_to = state_room ? {name: 'room', params: {room_id: state_room}} : '/'
            this.$router.push(go_to)
        }
    }
}
</script>


<style lang='sass' scoped>

// Give app background a primary color tinge
// NOTE Looks better (especially for dark theme) and helps toolbars etc stand out more


::v-deep .v-application--wrap
    // Add to wrap so complements v-app's default background (works for both light and dark)
    background-color: rgba($primary, 0.08)


// Keyframes for router transition animations

@keyframes slide-left-enter
    from
        transform: translateX(100%)
    to
        transform: translateX(0)

@keyframes slide-left-leave
    from
        transform: translateX(0)
    to
        transform: translateX(-100%)

@keyframes slide-right-enter
    from
        transform: translateX(-100%)
    to
        transform: translateX(0)

@keyframes slide-right-leave
    from
        transform: translateX(0)
    to
        transform: translateX(100%)

@keyframes slide-up-enter
    from
        transform: translateY(100%)
    to
        transform: translateY(0)

@keyframes slide-up-leave
    from
        transform: translateY(0)
    to
        transform: translateY(-100%)


// Route layout and transitions

.docked
    display: flex
    flex-direction: column
    flex-grow: 1
    // Defaults for all transition animations
    animation-duration: 375ms
    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1)

    &.deeper-enter-active
        animation-name: slide-left-enter

    &.deeper-leave-active
        animation-name: slide-left-leave

    &.shallower-enter-active
        animation-name: slide-right-enter

    &.shallower-leave-active
        animation-name: slide-right-leave

    &.jump-enter-active
        animation-name: slide-up-enter

    &.jump-leave-active
        animation-name: slide-up-leave

    // Need to absolute position a route when it's leaving so entering route not displaced
    &.deeper-leave-active, &.shallower-leave-active, &.jump-leave-active
        position: absolute
        width: 100%


// Custom scrollbar


.custom-scroll
    // Make scrollbars more subtle and themed
    // WARN Only apply to desktop, as mobile scrollbars should be hidden (and default to so)
    scrollbar-width: 12px
    scrollbar-color: #0002 transparent  // WARN ::-webkit-scrollbar-thumb must also be changed

    ::-webkit-scrollbar
        width: 12px
        background-color: transparent

    ::-webkit-scrollbar-thumb
        background-color: #0002

    &.dark  // NOTE Not using `themed` as setting on .dark's element (rather than nested element)
        scrollbar-color: #fff2 transparent

        ::-webkit-scrollbar-thumb
            background-color: #fff2


// Snackbar


// Give snackbar more spacing (defaults 8px)
::v-deep .v-snack
    left: 16px
    right: 16px
    bottom: 60px  // Avoid overlapping bottom nav on mobile


// Snackbar doesn't support dark theme (should be light colored to stand out)
.dark ::v-deep .v-snack__wrapper
    background-color: white
    color: rgba(black, map-get($material-light, 'primary-text-percent'))


</style>
